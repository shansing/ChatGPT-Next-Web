"use client";
import {
  ALIBABA_BASE_URL,
  AlibabaPath,
  modelMaxTotalTokenNumber,
  REQUEST_TIMEOUT_MS,
  ServiceProvider,
} from "@/app/constant";
import { useAccessStore, useAppConfig, useChatStore } from "@/app/store";

import {
  ChatOptions,
  getHeaders,
  LLMApi,
  LLMModel,
  LLMUsage,
  MultimodalContent,
} from "../api";
import Locale from "../../locales";
import {
  EventStreamContentType,
  fetchEventSource,
} from "@fortaine/fetch-event-source";
import {
  getMessageTextContent,
  getMessageImages,
  isVisionModel,
} from "@/app/utils";
import { showToast } from "@/app/components/ui-lib";

//ref: openai.ts

interface RequestPayload {
  messages: {
    role: "system" | "user" | "assistant";
    content: string | MultimodalContent[];
  }[];
  stream_options?: {
    include_usage?: boolean;
  };
  stream?: boolean;
  model: string;
  temperature?: number;
  presence_penalty: number;
  frequency_penalty: number;
  top_p: number;
  max_tokens?: number;
}

export class AlibabaApi implements LLMApi {
  private disableListModels = true;

  path(path: string): string {
    return "/api/alibaba/" + path;
  }

  extractMessage(res: any) {
    return res.choices?.at(0)?.message?.content ?? "";
  }

  async chat(options: ChatOptions) {
    const visionModel = isVisionModel(options.config.model);
    const messages = options.messages.map((v) => ({
      role: v.role,
      content: visionModel ? v.content : getMessageTextContent(v),
    }));

    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
      },
      ...(options.config.max_tokens && {
        max_tokens: options.config.max_tokens,
      }),
    };

    const requestPayload: RequestPayload = {
      messages,
      stream: options.config.stream,
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      presence_penalty: modelConfig.presence_penalty,
      frequency_penalty: modelConfig.frequency_penalty,
      top_p: modelConfig.top_p,
      //qwen requires <= 2000
      max_tokens:
        modelConfig.max_tokens <= 2000 ? modelConfig.max_tokens : 2000,
    };
    requestPayload["stream_options"] = options.config.stream
      ? {
          include_usage: true,
        }
      : undefined;
    if (requestPayload.top_p >= 1.0) {
      requestPayload.top_p = 0.99;
    }
    if (modelConfig.model.startsWith("qwen-vl")) {
      delete requestPayload.temperature;
      delete requestPayload.max_tokens;
    }

    console.log("[Request] alibaba payload: ", requestPayload);

    const shouldStream = !!options.config.stream;
    const controller = new AbortController();
    options.onController?.(controller);

    try {
      const chatPath = this.path(AlibabaPath.ChatPath);
      const chatPayload = {
        method: "POST",
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
        headers: {
          ...getHeaders(),
          ...(options.config.checkShansingOnlineSearch && {
            "X-Shansing-Online-Search": modelConfig.shansingOnlineSearch + "",
          }),
        },
      };

      // make a fetch request
      const requestTimeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

      if (shouldStream) {
        let responseText = "";
        let finished = false;

        const error = (inError: Error | string) => {
          const error =
            typeof inError === "string" ? new Error(inError) : inError;
          if (!finished) {
            finished = true;
            requestAnimationFrame(() => options.onError?.(error));
          }
        };

        const finish = () => {
          if (!finished) {
            finished = true;
            requestAnimationFrame(() => options.onFinish(responseText));
          }
        };

        controller.signal.onabort = finish;

        fetchEventSource(chatPath, {
          ...chatPayload,
          async onopen(res) {
            clearTimeout(requestTimeoutId);
            const contentType = res.headers.get("content-type");
            console.log(
              "[Alibaba] request response content type: ",
              contentType,
            );

            if (contentType?.startsWith("text/plain")) {
              responseText = await res.clone().text();
              return finish();
            }

            if (
              !res.ok ||
              !res.headers
                .get("content-type")
                ?.startsWith(EventStreamContentType) ||
              res.status !== 200
            ) {
              let responseBody = await res.clone().text();
              if (res.status === 401) {
                return error(Locale.Error.Unauthorized);
              }
              return error("responseBody: " + responseBody);
            }

            const searchCount = parseInt(
              res.headers.get("x-shansing-search-count") ?? "0",
            );
            const newsCount = parseInt(
              res.headers.get("x-shansing-news-count") ?? "0",
            );
            const crawlerCount = parseInt(
              res.headers.get("x-shansing-crawler-count") ?? "0",
            );
            options.onBegin?.(
              searchCount > 0 || newsCount > 0 || crawlerCount > 0,
            );
          },
          onmessage(msg) {
            if (msg.data === "[DONE]" || finished) {
              return finish();
            }
            const text = msg.data;
            try {
              const json = JSON.parse(text);
              if (!json.choices && !json.usage) {
                return error("No choices: " + text);
              }
              const choices = json.choices as Array<{
                delta: { content: string };
              }>;
              const delta = choices[0]?.delta?.content;
              const textmoderation = json?.prompt_filter_results;

              if (delta) {
                responseText += delta;
                requestAnimationFrame(() => options.onUpdate?.(responseText));
              }

              if (
                textmoderation &&
                textmoderation.length > 0 &&
                ServiceProvider.Azure
              ) {
                const contentFilterResults =
                  textmoderation[0]?.content_filter_results;
                console.log(
                  `[${ServiceProvider.Azure}] [Text Moderation] flagged categories result:`,
                  contentFilterResults,
                );
              }
            } catch (e) {
              showToast(Locale.Shansing.messageParseFailure);
              console.error("[Request] parse error", text, msg);
            }
          },
          onclose() {
            finish();
          },
          onerror(e) {
            showToast(Locale.Shansing.messageSendFailure);
            options.onError?.(e);
            throw e;
          },
          openWhenHidden: true,
        });
      } else {
        const res = await fetch(chatPath, chatPayload);
        clearTimeout(requestTimeoutId);

        const resJson = await res.json();
        const message = this.extractMessage(resJson);
        options.onFinish(message);
      }
    } catch (e) {
      console.log("[Request] failed to make a chat request", e);
      options.onError?.(e as Error);
    }
  }

  async uploadFile(file: File): Promise<string> {
    const controller = new AbortController();
    const requestTimeoutId = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    const formData = new FormData();
    formData.append("purpose", "file-extract");
    // formData.append('file',
    //     new Readable({
    //       read() {
    //         this.push(file.stream().getBuffer());
    //         this.push(null);
    //       }
    //     }),
    //     file.name
    // );
    formData.append("file", file, file.name);
    const headers = getHeaders();
    delete headers["Content-Type"];
    delete headers["application/json"];
    const response = await fetch(this.path(AlibabaPath.FilePath), {
      method: "POST",
      body: formData,
      signal: controller.signal,
      headers: {
        ...headers,
      },
    });
    clearTimeout(requestTimeoutId);

    const responseJson = await response.json();
    // @ts-ignore
    return responseJson.id;
  }
}
