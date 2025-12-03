"use client";
import {
  DeepSeekPath,
  ReasoningLevel,
  reasoningLevelModels,
  REQUEST_LONG_TIMEOUT_MS,
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
  thinking?: object;
}

export class DeepSeekApi implements LLMApi {
  private disableListModels = true;

  path(path: string): string {
    return "/api/deepseek/" + path;
  }

  extractMessage(res: any) {
    return res.choices?.at(0)?.message?.content ?? "";
  }

  async chat(options: ChatOptions) {
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

    const visionModel = isVisionModel(options.config.model);
    const shouldInjectSystemPrompts = modelConfig.enableInjectSystemPrompts;
    // console.log("shouldInjectSystemPrompts", shouldInjectSystemPrompts);
    let messages = options.messages.map((v) => {
      let content = visionModel ? v.content : getMessageTextContent(v);
      return {
        role:
          options.config.model.startsWith("deepseek") && v.role === "system"
            ? "user"
            : v.role,
        content: content,
      };
    });
    // if (
    //   options.config.model.includes("deepseek-reasoner") &&
    //   shouldInjectSystemPrompts
    // ) {
    //   messages.push({
    //     role: "user",
    //     content: "\n<think>\n",
    //   });
    // }
    // roles must alternate between "user" and "assistant" in deepseek-r1, so combine two or more user messages
    messages = messages.reduce(
      (accumulator: RequestMessage[], current: RequestMessage) => {
        if (
          !accumulator.length ||
          current.role !== accumulator[accumulator.length - 1].role ||
          current.content == null ||
          accumulator[accumulator.length - 1].content == null
        ) {
          accumulator.push(current);
        } else {
          let lastContent = accumulator[accumulator.length - 1].content;
          if (typeof lastContent === "string") {
            lastContent = [
              {
                text: lastContent,
                type: "text",
              },
            ];
          }
          let thisContent = current.content;
          if (typeof thisContent === "string") {
            thisContent = [
              {
                text: thisContent,
                type: "text",
              },
            ];
          }
          accumulator[accumulator.length - 1] = {
            ...accumulator[accumulator.length - 1],
            content: [...lastContent, ...thisContent],
          };
        }
        return accumulator;
      },
      [],
    );

    if (
      options.config.shansingLessThink &&
      modelConfig.shansingReasoningLevel
    ) {
      const reasoningLevels = reasoningLevelModels.find(
        (r) => modelConfig.model === r.name,
      )?.levels;
      if (reasoningLevels) {
        modelConfig.shansingReasoningLevel = reasoningLevels[0];
      }
    }
    const requestPayload: RequestPayload = {
      messages: [...messages],
      stream: options.config.stream,
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      presence_penalty: modelConfig.presence_penalty,
      frequency_penalty: modelConfig.frequency_penalty,
      top_p: modelConfig.top_p,
      max_tokens: modelConfig.max_tokens,
      ...(modelConfig.shansingReasoningLevel &&
        modelConfig.shansingReasoningLevel != ReasoningLevel.None && {
          thinking: { type: "enabled" },
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

    console.log("[Request] deepseek payload: ", requestPayload);

    const shouldStream = !!options.config.stream;
    const controller = new AbortController();
    options.onController?.(controller);

    try {
      const chatPath = this.path(DeepSeekPath.ChatPath);
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
        modelConfig.model.includes("deepseek-reasoner") ||
          (modelConfig.shansingReasoningLevel &&
            modelConfig.shansingReasoningLevel != ReasoningLevel.None)
          ? REQUEST_LONG_TIMEOUT_MS
          : REQUEST_TIMEOUT_MS,
      );

      if (shouldStream) {
        let responseText = "";
        let responseReasoning = "";
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
            requestAnimationFrame(() =>
              options.onFinish(responseText, responseReasoning),
            );
          }
        };

        controller.signal.onabort = finish;

        fetchEventSource(chatPath, {
          ...chatPayload,
          async onopen(res) {
            clearTimeout(requestTimeoutId);
            const contentType = res.headers.get("content-type");
            console.log(
              "[DeepSeek] request response content type: ",
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
                delta: { content: string; reasoning_content: string };
              }>;
              const content = choices[0]?.delta?.content;
              const reasonContent = choices[0]?.delta?.reasoning_content;
              // console.log("content", content, "reasonContent", reasonContent)
              const delta = content;
              const reasonDelta = reasonContent;
              const textmoderation = json?.prompt_filter_results;

              if (delta || reasonDelta) {
                if (delta) {
                  responseText += delta;
                }
                if (reasonDelta) {
                  responseReasoning += reasonDelta;
                  // //workaround: 将 `\\n` 替换成 `\n` 并移除首尾多余换行
                  // responseReasoning = responseReasoning
                  //   .replace(/\\n/g, "\n")
                  //   .replace(/^\n+|\n+$/g, "");
                  options.onFlag?.(undefined, undefined, true);
                }
                requestAnimationFrame(() =>
                  options.onUpdate?.(responseText, responseReasoning),
                );
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
