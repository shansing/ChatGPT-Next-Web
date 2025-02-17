"use client";
import {
  OpenRouterPath,
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
  RequestMessage,
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
import { fitMaxCompletionToken } from "@/app/client/shansing";

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
  include_reasoning?: boolean; //openrouter
  provider?: object; //openrouter
}

export class OpenRouterApi implements LLMApi {
  private disableListModels = true;

  path(path: string): string {
    return "/api/openrouter/" + path;
  }

  extractMessage(res: any) {
    return res.choices?.at(0)?.message?.content ?? "";
  }

  async chat(options: ChatOptions) {
    const visionModel = isVisionModel(options.config.model);
    const messages = options.messages.map((v) => ({
      role:
        options.config.model.startsWith("deepseek") && v.role === "system"
          ? "user"
          : v.role,
      // content: visionModel ? v.content : getMessageTextContent(v),
      content:
        options.config.model.includes("deepseek-r1") && v.role === "user"
          ? getMessageTextContent(v) + "\n<think>\n"
          : getMessageTextContent(v),
    }));

    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
      },
      ...(options.config.max_tokens && {
        max_tokens: fitMaxCompletionToken(
          options.config.model,
          options.config.max_tokens,
        ),
      }),
    };
    console.log("max_tokens", modelConfig.max_tokens);

    // const deepseekR1Message : RequestMessage = {
    //   role: "assistant",
    //   content: "<think>\\n",
    // }
    const requestPayload: RequestPayload = {
      messages: [
        ...messages,
        // ...(modelConfig.model.includes("deepseek-r1") ? [deepseekR1Message] : [])
      ],
      stream: options.config.stream,
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      presence_penalty: modelConfig.presence_penalty,
      frequency_penalty: modelConfig.frequency_penalty,
      top_p: modelConfig.top_p,
      max_tokens: modelConfig.max_tokens,
      include_reasoning: true,
      ...(modelConfig.model.includes("deepseek") && {
        provider: {
          order: ["Fireworks"],
          allow_fallbacks: true,
        },
      }),
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

    console.log("[Request] openrouter payload: ", requestPayload);

    const shouldStream = !!options.config.stream;
    const controller = new AbortController();
    options.onController?.(controller);

    try {
      const chatPath = this.path(OpenRouterPath.ChatPath);
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
        let reasoningStarted = false;
        let reasoningEnded = false;

        fetchEventSource(chatPath, {
          ...chatPayload,
          async onopen(res) {
            clearTimeout(requestTimeoutId);
            const contentType = res.headers.get("content-type");
            console.log(
              "[OpenRouter] request response content type: ",
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
              // if (res.status === 401) {
              //   return error(Locale.Error.Unauthorized);
              // }
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
            options.onFlag?.(
              searchCount > 0 || newsCount > 0 || crawlerCount > 0,
              undefined,
            );
          },
          onmessage(msg) {
            if (msg.data === "") {
              //may be comments
              return;
            }
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
                delta: { content: string; reasoning: string };
              }>;
              const content = choices[0]?.delta?.content;
              const reasonContent = choices[0]?.delta?.reasoning;
              // console.log("content", content, "reasonContent", reasonContent)
              let delta = "";
              if (reasonContent) {
                if (!reasoningStarted && !reasoningEnded) {
                  reasoningStarted = true;
                  // delta = "```text\n" + reasonContent
                  delta = reasonContent;
                } else {
                  delta = delta + reasonContent;
                }
              }
              if (content) {
                if (reasoningStarted && !reasoningEnded) {
                  reasoningEnded = true;
                  // delta = delta + "\n```\n" + content
                  delta = delta + "\n---\n" + content;
                } else {
                  delta = delta + content;
                }
              }
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
    throw Error("Method not implemented");
  }
}
