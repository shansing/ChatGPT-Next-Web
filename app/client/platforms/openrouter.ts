"use client";
import {
  OpenRouterPath,
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
  presence_penalty?: number;
  frequency_penalty?: number;
  top_p?: number;
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
    if (
      options.config.model.includes("deepseek-r1") &&
      shouldInjectSystemPrompts
    ) {
      messages.push({
        role: "user",
        content: "\n<think>\n",
      });
    }

    const requestPayload: RequestPayload = {
      messages: [...messages],
      stream: options.config.stream,
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      presence_penalty: modelConfig.presence_penalty,
      frequency_penalty: modelConfig.frequency_penalty,
      top_p: modelConfig.model.includes("o1") ? undefined : modelConfig.top_p,
      max_tokens: modelConfig.max_tokens,
      include_reasoning: true,
      provider: {
        data_collection: "deny",
        ...((modelConfig.model.includes("deepseek-r1") ||
          modelConfig.model.includes("qwen/qwq-32b")) && {
          order: ["Fireworks"],
          allow_fallbacks: true,
        }),
        // ...(modelConfig.model.includes("grok") && {
        //   order: ["xAI Fast"],
        //   allow_fallbacks: true,
        // }),
      },
    };
    requestPayload["stream_options"] = options.config.stream
      ? {
          include_usage: true,
        }
      : undefined;
    if (requestPayload.top_p && requestPayload.top_p >= 1.0) {
      requestPayload.top_p = 0.99;
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
        modelConfig.model.includes("deepseek-r1") ||
          modelConfig.model.includes("QwQ") ||
          modelConfig.model.includes("perplexity") ||
          modelConfig.model.includes("o1") ||
          modelConfig.model.includes("o3")
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

        let citationsNum = 0;
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
              if (json.citations && json.citations.length > citationsNum) {
                citationsNum = json.citations.length;
                options.onFlag?.(true, undefined);
              }
              if (!json.choices && !json.usage) {
                return error("No choices: " + text);
              }
              const choices = json.choices as Array<{
                delta: { content: string; reasoning: string };
                finish_reason?: string;
              }>;
              const content = choices[0]?.delta?.content;
              const reasonContent = choices[0]?.delta?.reasoning;
              // console.log("content", content, "reasonContent", reasonContent)
              const delta = content;
              const reasonDelta = reasonContent;

              if (delta || reasonDelta) {
                if (delta) {
                  responseText += delta;
                }
                if (reasonDelta) {
                  responseReasoning += reasonDelta;
                  //workaround: 将 `\\n` 替换成 `\n` 并移除首尾多余换行
                  responseReasoning = responseReasoning
                    .replace(/\\n/g, "\n")
                    .replace(/^\n+|\n+$/g, "");
                }
                requestAnimationFrame(() =>
                  options.onUpdate?.(responseText, responseReasoning),
                );
              }

              //for perplexity
              if (
                choices[0]?.finish_reason === "stop" &&
                json.citations &&
                json.citations.length > 0
              ) {
                const citationsMarkdown =
                  "\n\n---\n" +
                  json.citations
                    .map((citation: any, index: number) => {
                      return `[${index + 1}] ${citation}`;
                    })
                    .join("\n");
                responseText += citationsMarkdown;
                requestAnimationFrame(() =>
                  options.onUpdate?.(responseText, responseReasoning),
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
