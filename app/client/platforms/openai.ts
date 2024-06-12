"use client";
import {
  ApiPath,
  DEFAULT_API_HOST,
  DEFAULT_MODELS,
  modelMaxTotalTokenNumber,
  OpenaiPath,
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
import { prettyObject } from "@/app/utils/format";
import { getClientConfig } from "@/app/config/client";
import { makeAzurePath } from "@/app/azure";
import {
  getMessageTextContent,
  getMessageImages,
  isVisionModel,
} from "@/app/utils";
import { showToast } from "@/app/components/ui-lib";

export interface OpenAIListModelResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    root: string;
  }>;
}

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
  temperature: number;
  presence_penalty: number;
  frequency_penalty: number;
  top_p: number;
  max_tokens?: number;
}

export class ChatGPTApi implements LLMApi {
  private disableListModels = true;

  path(path: string): string {
    const accessStore = useAccessStore.getState();

    let baseUrl = "";

    if (accessStore.useCustomConfig) {
      const isAzure = accessStore.provider === ServiceProvider.Azure;

      if (isAzure && !accessStore.isValidAzure()) {
        throw Error(
          "incomplete azure config, please check it in your settings page",
        );
      }

      if (isAzure) {
        path = makeAzurePath(path, accessStore.azureApiVersion);
      }

      baseUrl = isAzure ? accessStore.azureUrl : accessStore.openaiUrl;
    }

    if (baseUrl.length === 0) {
      const isApp = !!getClientConfig()?.isApp;
      baseUrl = isApp
        ? DEFAULT_API_HOST + "/proxy" + ApiPath.OpenAI
        : ApiPath.OpenAI;
    }

    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, baseUrl.length - 1);
    }
    if (!baseUrl.startsWith("http") && !baseUrl.startsWith(ApiPath.OpenAI)) {
      baseUrl = "https://" + baseUrl;
    }

    console.log("[Proxy Endpoint] ", baseUrl, path);

    return [baseUrl, path].join("/");
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
    };

    let max_tokens: number =
      (modelMaxTotalTokenNumber?.find((obj) =>
        modelConfig.model.startsWith(obj.name),
      )?.number || 4000) -
      modelConfig.compressMessageLengthThreshold -
      1500;
    if (modelConfig.max_tokens < max_tokens) {
      max_tokens = modelConfig.max_tokens;
    }

    const requestPayload: RequestPayload = {
      messages,
      stream: options.config.stream,
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      presence_penalty: modelConfig.presence_penalty,
      frequency_penalty: modelConfig.frequency_penalty,
      top_p: modelConfig.top_p,
      max_tokens: max_tokens,
    };
    requestPayload["stream_options"] = options.config.stream
      ? {
          include_usage: true,
        }
      : undefined;

    console.log("[Request] openai payload: ", requestPayload);

    const shouldStream = !!options.config.stream;
    const controller = new AbortController();
    options.onController?.(controller);

    try {
      const chatPath = this.path(OpenaiPath.ChatPath);
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
            responseText +=
              "\n\n" +
              prettyObject({
                error: true,
                message: error.message,
              });
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
              "[OpenAI] request response content type: ",
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
  async usage() {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
        .getDate()
        .toString()
        .padStart(2, "0")}`;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = formatDate(startOfMonth);
    const endDate = formatDate(new Date(Date.now() + ONE_DAY));

    const [used, subs] = await Promise.all([
      fetch(
        this.path(
          `${OpenaiPath.UsagePath}?start_date=${startDate}&end_date=${endDate}`,
        ),
        {
          method: "GET",
          headers: getHeaders(),
        },
      ),
      fetch(this.path(OpenaiPath.SubsPath), {
        method: "GET",
        headers: getHeaders(),
      }),
    ]);

    if (used.status === 401) {
      throw new Error(Locale.Error.Unauthorized);
    }

    if (!used.ok || !subs.ok) {
      throw new Error("Failed to query usage from openai");
    }

    const response = (await used.json()) as {
      total_usage?: number;
      error?: {
        type: string;
        message: string;
      };
    };

    const total = (await subs.json()) as {
      hard_limit_usd?: number;
    };

    if (response.error && response.error.type) {
      throw Error(response.error.message);
    }

    if (response.total_usage) {
      response.total_usage = Math.round(response.total_usage) / 100;
    }

    if (total.hard_limit_usd) {
      total.hard_limit_usd = Math.round(total.hard_limit_usd * 100) / 100;
    }

    return {
      used: response.total_usage,
      total: total.hard_limit_usd,
    } as LLMUsage;
  }

  async models(): Promise<LLMModel[]> {
    if (this.disableListModels) {
      return DEFAULT_MODELS.slice();
    }

    const res = await fetch(this.path(OpenaiPath.ListModelPath), {
      method: "GET",
      headers: {
        ...getHeaders(),
      },
    });

    const resJson = (await res.json()) as OpenAIListModelResponse;
    const chatModels = resJson.data?.filter((m) => m.id.startsWith("gpt-"));
    console.log("[Models]", chatModels);

    if (!chatModels) {
      return [];
    }

    return chatModels.map((m) => ({
      name: m.id,
      available: true,
      provider: {
        id: "openai",
        providerName: "OpenAI",
        providerType: "openai",
      },
    }));
  }

  uploadFile(file: File): Promise<string> {
    throw Error("Method not implemented");
  }
}
export { OpenaiPath };
