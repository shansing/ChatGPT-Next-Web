import { Google, REQUEST_TIMEOUT_MS } from "@/app/constant";
import { ChatOptions, getHeaders, LLMApi, LLMModel, LLMUsage } from "../api";
import { useAccessStore, useAppConfig, useChatStore } from "@/app/store";
import { getClientConfig } from "@/app/config/client";
import { DEFAULT_API_HOST } from "@/app/constant";
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
import Locale from "@/app/locales";
import { prettyObject } from "@/app/utils/format";
import { fitMaxCompletionToken, trimNewline } from "@/app/client/shansing";

export class GeminiProApi implements LLMApi {
  extractMessage(res: any) {
    // console.log("[Response] gemini-pro response: ", res);
    const result = {
      message: "",
      isCodeExecution: false,
    };
    const parts = res?.candidates?.at(0)?.content?.parts;
    if (!parts) {
      return result;
    }
    for (const part of parts) {
      if (part?.text) {
        result.message += part.text;
      }
      // || res?.error?.message

      if (part?.executableCode) {
        result.message +=
          "\n```" +
          (part.executableCode?.language?.toLowerCase() ?? "") +
          "\n" +
          trimNewline(part.executableCode?.code ?? "") +
          "\n```\n";
        result.isCodeExecution = true;
      }

      if (part?.codeExecutionResult) {
        result.message +=
          "\nOutput: \n```\n" +
          (part.codeExecutionResult?.output ?? "") +
          "\n```\n";
        result.isCodeExecution = true;
      }
    }
    return result;
  }
  async chat(options: ChatOptions): Promise<void> {
    const apiClient = this;
    // let multimodal = false;
    const messages = options.messages.map((v) => {
      let parts: any[] = [{ text: getMessageTextContent(v) }];
      if (isVisionModel(options.config.model)) {
        const images = getMessageImages(v);
        if (images.length > 0) {
          // multimodal = true;
          parts.unshift(
            images.map((image) => {
              const imageType = image.split(";")[0].split(":")[1];
              const imageData = image.split(",")[1];
              return {
                inline_data: {
                  mime_type: imageType,
                  data: imageData,
                },
              };
            }),
          );
        }
      }
      return {
        role: v.role.replace("assistant", "model"),
        parts: parts,
      };
    });

    let systemMessage: string | undefined = messages
      .filter((v) => v.role === "system" && v?.parts)
      .flatMap((v) =>
        v.parts.filter((part) => part?.text).map((part) => part?.text),
      )
      .filter((text) => !!text)
      .join("\n\n");
    if (systemMessage && !systemMessage.trim()) {
      systemMessage = undefined;
    }

    // google requires that role in neighboring messages must not be the same
    for (let i = 0; i < messages.length - 1; ) {
      if (messages[i].role === "system") {
        messages.splice(i, 1);
      }
      // Check if current and next item both have the role "model"
      else if (messages[i].role === messages[i + 1].role) {
        // Concatenate the 'parts' of the current and next item
        messages[i].parts = messages[i].parts.concat(messages[i + 1].parts);
        // Remove the next item
        messages.splice(i + 1, 1);
      } else {
        // Move to the next item
        i++;
      }
    }
    // if (visionModel && messages.length > 1) {
    //   options.onError?.(new Error("Multiturn chat is not enabled for models/gemini-pro-vision"));
    // }
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

    const requestPayload = {
      contents: messages,
      generationConfig: {
        // stopSequences: [
        //   "Title"
        // ],
        temperature: modelConfig.temperature,
        maxOutputTokens: modelConfig.max_tokens,
        topP: modelConfig.top_p,
        // "topK": modelConfig.top_k,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
      ],
      ...(systemMessage && {
        systemInstruction: {
          parts: {
            text: systemMessage,
          },
        },
      }),
      ...(modelConfig.shansingCodeExecution && {
        tools: [
          {
            codeExecution: {},
          },
        ],
      }),
    };

    const accessStore = useAccessStore.getState();

    let baseUrl = "";

    if (accessStore.useCustomConfig) {
      baseUrl = accessStore.googleUrl;
    }

    const isApp = !!getClientConfig()?.isApp;

    let shouldStream = !!options.config.stream;
    const controller = new AbortController();
    options.onController?.(controller);
    try {
      // let baseUrl = accessStore.googleUrl;

      if (!baseUrl) {
        baseUrl = isApp
          ? DEFAULT_API_HOST +
            "/api/proxy/google/" +
            Google.ChatPath(modelConfig.model)
          : this.path(Google.ChatPath(modelConfig.model));
      }

      if (isApp) {
        baseUrl += `?key=${accessStore.googleApiKey}`;
      }
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

        // https://github.com/google-gemini/cookbook/blob/main/quickstarts/rest/Streaming_REST.ipynb
        const chatPath =
          baseUrl.replace("generateContent", "streamGenerateContent") +
          (baseUrl.indexOf("?") > -1 ? "&alt=sse" : "?alt=sse");
        fetchEventSource(chatPath, {
          ...chatPayload,
          async onopen(res) {
            clearTimeout(requestTimeoutId);
            const contentType = res.headers.get("content-type");
            console.log(
              "[Gemini] request response content type: ",
              contentType,
            );
            // to do 更严谨的错误检测和处理

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
            options.onFlag?.(
              searchCount > 0 || newsCount > 0 || crawlerCount > 0,
              undefined,
            );
          },
          onmessage(msg) {
            if (msg.data === "[DONE]" || finished) {
              return finish();
            }
            // console.log("msg", msg);
            const text = msg.data;
            try {
              const json = JSON.parse(text);
              if (!json?.candidates?.at(0)?.content?.parts) {
                return error("No candidate parts: " + text);
              }
              const result = apiClient.extractMessage(json);
              const delta = result.message;
              if (result.isCodeExecution) {
                options.onFlag?.(undefined, true);
              }

              if (delta) {
                responseText += delta;
                // console.log("delta", delta)
                requestAnimationFrame(() => options.onUpdate?.(responseText));
              }

              // const blockReason = json?.promptFeedback?.blockReason;
              // if (blockReason) {
              //   // being blocked
              //   console.log(`[Google] [Safety Ratings] result:`, blockReason);
              // }
            } catch (e) {
              console.error("[Request] parse error", text, msg);
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
        const res = await fetch(baseUrl, chatPayload);
        clearTimeout(requestTimeoutId);
        const resJson = await res.json();
        if (resJson?.promptFeedback?.blockReason) {
          // being blocked
          options.onError?.(
            new Error(
              "Message is being blocked for reason: " +
                resJson.promptFeedback.blockReason,
            ),
          );
        }
        const result = apiClient.extractMessage(resJson);
        const message = result.message;
        options.onFinish(message);
      }
    } catch (e) {
      console.log("[Request] failed to make a chat request", e);
      options.onError?.(e as Error);
    }
  }
  path(path: string): string {
    return "/api/google/" + path;
  }
  uploadFile(file: File): Promise<string> {
    throw Error("Method not implemented");
  }
}

function ensureProperEnding(str: string) {
  if (str.startsWith("[") && !str.endsWith("]")) {
    return str + "]";
  }
  return str;
}
