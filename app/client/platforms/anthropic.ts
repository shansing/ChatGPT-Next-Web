import {
  ACCESS_CODE_PREFIX,
  Anthropic,
  ApiPath,
  DEFAULT_API_HOST,
  modelMaxTotalTokenNumber,
  REQUEST_TIMEOUT_MS,
} from "@/app/constant";
import { ChatOptions, getHeaders, LLMApi, MultimodalContent } from "../api";
import { useAccessStore, useAppConfig, useChatStore } from "@/app/store";
import { getClientConfig } from "@/app/config/client";
import { RequestMessage } from "@/app/typing";
import {
  EventStreamContentType,
  fetchEventSource,
} from "@fortaine/fetch-event-source";

import Locale from "../../locales";
import { prettyObject } from "@/app/utils/format";
import { getMessageTextContent, isVisionModel } from "@/app/utils";
import context from "react-redux/src/components/Context";

export type MultiBlockContent = {
  type: "image" | "text";
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
  text?: string;
};

export type AnthropicMessage = {
  role: (typeof ClaudeMapper)[keyof typeof ClaudeMapper];
  content: string | MultiBlockContent[];
};

export interface AnthropicChatRequest {
  model: string; // The model that will complete your prompt.
  messages: AnthropicMessage[]; // The prompt that you want Claude to complete.
  max_tokens: number; // The maximum number of tokens to generate before stopping.
  stop_sequences?: string[]; // Sequences that will cause the model to stop generating completion text.
  temperature?: number; // Amount of randomness injected into the response.
  top_p?: number; // Use nucleus sampling.
  top_k?: number; // Only sample from the top K options for each subsequent token.
  metadata?: object; // An object describing metadata about the request.
  stream?: boolean; // Whether to incrementally stream the response using server-sent events.
}

export interface ChatRequest {
  model: string; // The model that will complete your prompt.
  prompt: string; // The prompt that you want Claude to complete.
  max_tokens_to_sample: number; // The maximum number of tokens to generate before stopping.
  stop_sequences?: string[]; // Sequences that will cause the model to stop generating completion text.
  temperature?: number; // Amount of randomness injected into the response.
  top_p?: number; // Use nucleus sampling.
  top_k?: number; // Only sample from the top K options for each subsequent token.
  metadata?: object; // An object describing metadata about the request.
  stream?: boolean; // Whether to incrementally stream the response using server-sent events.
}

export interface ChatResponse {
  completion: string;
  stop_reason: "stop_sequence" | "max_tokens";
  model: string;
}

export type ChatStreamResponse = ChatResponse & {
  stop?: string;
  log_id: string;
};

const ClaudeMapper = {
  assistant: "assistant",
  user: "user",
  system: "user",
} as const;

const keys = ["claude-2, claude-instant-1"];

export class ClaudeApi implements LLMApi {
  extractMessage(res: any) {
    console.log("[Response] claude response: ", res);

    return res?.content?.[0]?.text;
  }
  async chat(options: ChatOptions): Promise<void> {
    const visionModel = isVisionModel(options.config.model);

    const accessStore = useAccessStore.getState();

    const shouldStream = !!options.config.stream;

    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
      },
    };

    const messages = [...options.messages];

    const keys = ["system", "user"];

    // roles must alternate between "user" and "assistant" in claude, so add a fake assistant message between two user messages
    for (let i = 0; i < messages.length - 1; i++) {
      const message = messages[i];
      const nextMessage = messages[i + 1];

      if (keys.includes(message.role) && keys.includes(nextMessage.role)) {
        messages[i] = [
          message,
          {
            role: "assistant",
            content: ";",
          },
        ] as any;
      }
    }

    const prompt = messages
      .flat()
      .filter((v) => {
        if (!v.content) return false;
        if (typeof v.content === "string" && !v.content.trim()) return false;
        return true;
      })
      .map((v) => {
        const { role, content } = v;
        const insideRole = ClaudeMapper[role] ?? "user";

        if (!visionModel || typeof content === "string") {
          return {
            role: insideRole,
            content: getMessageTextContent(v),
          };
        }
        return {
          role: insideRole,
          content: content
            .filter((v) => v.image_url || v.text)
            .map(({ type, text, image_url }) => {
              if (type === "text") {
                return {
                  type,
                  text: text!,
                };
              }
              const { url = "" } = image_url || {};
              const colonIndex = url.indexOf(":");
              const semicolonIndex = url.indexOf(";");
              const comma = url.indexOf(",");

              const mimeType = url.slice(colonIndex + 1, semicolonIndex);
              const encodeType = url.slice(semicolonIndex + 1, comma);
              const data = url.slice(comma + 1);

              return {
                type: "image" as const,
                source: {
                  type: encodeType,
                  media_type: mimeType,
                  data,
                },
              };
            }),
        };
      });

    if (prompt[0]?.role === "assistant") {
      prompt.unshift({
        role: "user",
        content: ";",
      });
    }

    let max_tokens: number =
      (modelMaxTotalTokenNumber?.find((obj) =>
        modelConfig.model.startsWith(obj.name),
      )?.number || 4000) -
      modelConfig.compressMessageLengthThreshold -
      1500;
    if (modelConfig.max_tokens < max_tokens) {
      max_tokens = modelConfig.max_tokens;
    }
    if (max_tokens > 4096) {
      //claude requires
      max_tokens = 4096;
    }

    const requestBody: AnthropicChatRequest = {
      messages: prompt,
      stream: shouldStream,

      model: modelConfig.model,
      max_tokens: max_tokens,
      temperature:
        modelConfig.temperature > 1.0 ? 1.0 : modelConfig.temperature,
      top_p: modelConfig.top_p,
      // top_k: modelConfig.top_k,
    };

    const path = this.path(Anthropic.ChatPath);

    const controller = new AbortController();
    options.onController?.(controller);

    const payload = {
      method: "POST",
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      headers: {
        ...getHeaders(),
        ...(options.config.checkShansingOnlineSearch && {
          "X-Shansing-Online-Search": modelConfig.shansingOnlineSearch + "",
        }),
        "anthropic-version": "2023-06-01",
      },
      // headers: {
      // "Content-Type": "application/json",
      // Accept: "application/json",
      // "x-api-key": accessStore.anthropicApiKey,
      // "anthropic-version": accessStore.anthropicApiVersion,
      // Authorization: getAuthKey(accessStore.anthropicApiKey),
      // },
    };

    try {
      const requestTimeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

      if (shouldStream) {
        let responseText = "";
        let remainText = "";
        let finished = false;

        // animate response to make it looks smooth
        function animateResponseText() {
          if (finished || controller.signal.aborted) {
            responseText += remainText;
            console.log("[Response Animation] finished");
            if (responseText?.length === 0) {
              options.onError?.(new Error("empty response from server"));
            }
            return;
          }

          if (remainText.length > 0) {
            // const fetchCount = Math.max(1, Math.round(remainText.length / 60));
            // const fetchText = remainText.slice(0, fetchCount);
            const fetchText = remainText;
            responseText += fetchText;
            // remainText = remainText.slice(fetchCount);
            remainText = "";
            options.onUpdate?.(responseText, fetchText);
          }

          requestAnimationFrame(animateResponseText);
        }

        // start animaion
        animateResponseText();

        const finish = () => {
          if (!finished) {
            finished = true;
            options.onFinish(responseText + remainText);
          }
        };

        controller.signal.onabort = finish;
        fetchEventSource(path, {
          ...payload,
          async onopen(res) {
            clearTimeout(requestTimeoutId);
            const contentType = res.headers.get("content-type");
            console.log("[Anthropic] response content type: ", contentType);

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
              const responseTexts = [responseText];
              let extraInfo = await res.clone().text();
              try {
                const resJson = await res.clone().json();
                extraInfo = prettyObject(resJson);
              } catch {}

              if (res.status === 401) {
                responseTexts.push(Locale.Error.Unauthorized);
              }

              if (extraInfo) {
                responseTexts.push(extraInfo);
              }

              responseText = responseTexts.join("\n\n");

              return finish();
            }
          },
          onmessage(msg) {
            let chunkJson:
              | undefined
              | {
                  type: "content_block_delta" | "content_block_stop";
                  delta?: {
                    type: "text_delta";
                    text: string;
                  };
                  index: number;
                };
            try {
              chunkJson = JSON.parse(msg.data);
            } catch (e) {
              console.error("[Response] parse error", msg.data);
            }

            if (!chunkJson || chunkJson.type === "content_block_stop") {
              return finish();
            }

            const { delta } = chunkJson;
            if (delta?.text) {
              remainText += delta.text;
            }
          },
          onclose() {
            finish();
          },
          onerror(e) {
            options.onError?.(e);
            throw e;
          },
          openWhenHidden: true,
        });
      } else {
        controller.signal.onabort = () => options.onFinish("");

        const res = await fetch(path, payload);
        const resJson = await res.json();

        const message = this.extractMessage(resJson);
        options.onFinish(message);
      }
    } catch (e) {
      console.error("failed to chat", e);
      options.onError?.(e as Error);
    }
  }
  path(path: string): string {
    const accessStore = useAccessStore.getState();

    let baseUrl: string = "";

    if (accessStore.useCustomConfig) {
      baseUrl = accessStore.anthropicUrl;
    }

    // if endpoint is empty, use default endpoint
    if (baseUrl.trim().length === 0) {
      const isApp = !!getClientConfig()?.isApp;

      baseUrl = isApp
        ? DEFAULT_API_HOST + "/api/proxy/anthropic"
        : ApiPath.Anthropic;
    }

    if (!baseUrl.startsWith("http") && !baseUrl.startsWith("/api")) {
      baseUrl = "https://" + baseUrl;
    }

    baseUrl = trimEnd(baseUrl, "/");

    return `${baseUrl}/${path}`;
  }

  uploadFile(file: File): Promise<string> {
    throw Error("Method not implemented");
  }
}

function trimEnd(s: string, end = " ") {
  if (end.length === 0) return s;

  while (s.endsWith(end)) {
    s = s.slice(0, -end.length);
  }

  return s;
}

function bearer(value: string) {
  return `Bearer ${value.trim()}`;
}

// function getAuthKey(apiKey = "") {
//   const accessStore = useAccessStore.getState();
//   const isApp = !!getClientConfig()?.isApp;
//   let authKey = "";
//
//   if (apiKey) {
//     // use user's api key first
//     authKey = bearer(apiKey);
//   } else if (
//     accessStore.enabledAccessControl() &&
//     !isApp &&
//     !!accessStore.accessCode
//   ) {
//     // or use access code
//     authKey = bearer(ACCESS_CODE_PREFIX + accessStore.accessCode);
//   }
//
//   return authKey;
// }
