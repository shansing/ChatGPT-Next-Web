import {
  Google,
  modelMaxTotalTokenNumber,
  REQUEST_TIMEOUT_MS,
} from "@/app/constant";
import { ChatOptions, getHeaders, LLMApi, LLMModel, LLMUsage } from "../api";
import { useAccessStore, useAppConfig, useChatStore } from "@/app/store";
import { getClientConfig } from "@/app/config/client";
import { DEFAULT_API_HOST } from "@/app/constant";
import {
  getMessageTextContent,
  getMessageImages,
  isVisionModel,
} from "@/app/utils";
import { showToast } from "@/app/components/ui-lib";
import Locale from "@/app/locales";
import { prettyObject } from "@/app/utils/format";

export class GeminiProApi implements LLMApi {
  extractMessage(res: any) {
    console.log("[Response] gemini-pro response: ", res);

    return (
      res?.candidates?.at(0)?.content?.parts.at(0)?.text ||
      res?.error?.message ||
      ""
    );
  }
  async chat(options: ChatOptions): Promise<void> {
    // const apiClient = this;
    let multimodal = false;
    const messages = options.messages.map((v) => {
      let parts: any[] = [{ text: getMessageTextContent(v) }];
      if (isVisionModel(options.config.model)) {
        const images = getMessageImages(v);
        if (images.length > 0) {
          multimodal = true;
          parts = parts.concat(
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
        role: v.role.replace("assistant", "model").replace("system", "user"),
        parts: parts,
      };
    });

    // google requires that role in neighboring messages must not be the same
    for (let i = 0; i < messages.length - 1; ) {
      // Check if current and next item both have the role "model"
      if (messages[i].role === messages[i + 1].role) {
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

    const requestPayload = {
      contents: messages,
      generationConfig: {
        // stopSequences: [
        //   "Title"
        // ],
        temperature: modelConfig.temperature,
        maxOutputTokens: max_tokens,
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
            responseText +=
              "\n\n" +
              prettyObject({
                error: true,
                message: error.message,
              });
            requestAnimationFrame(() => options.onError?.(error));
          }
        };

        let existingTexts: string[] = [];
        const finish = () => {
          finished = true;
          requestAnimationFrame(() => options.onFinish(existingTexts.join("")));
        };

        fetch(
          baseUrl.replace("generateContent", "streamGenerateContent"),
          chatPayload,
        )
          .then((response) => {
            const reader = response?.body?.getReader();
            const decoder = new TextDecoder();
            let partialData = "";

            const searchCount = parseInt(
              response.headers.get("x-shansing-search-count") ?? "0",
            );
            const newsCount = parseInt(
              response.headers.get("x-shansing-news-count") ?? "0",
            );
            const crawlerCount = parseInt(
              response.headers.get("x-shansing-crawler-count") ?? "0",
            );
            options.onBegin?.(
              searchCount > 0 || newsCount > 0 || crawlerCount > 0,
            );

            return reader?.read().then(function processText({
              done,
              value,
            }): Promise<any> {
              if (done) {
                if (response.status !== 200) {
                  try {
                    let data = JSON.parse(ensureProperEnding(partialData));
                    if (data && data[0].error) {
                      options.onError?.(new Error(data[0].error.message));
                    } else {
                      options.onError?.(new Error("Request failed"));
                    }
                  } catch (_) {
                    options.onError?.(new Error("Request failed"));
                  }
                }

                console.log("Stream complete");
                requestAnimationFrame(() => options.onFinish(responseText));
                finished = true;
                return Promise.resolve();
              }

              partialData += decoder.decode(value, { stream: true });

              try {
                let data = JSON.parse(ensureProperEnding(partialData));

                const textArray = data.reduce(
                  (acc: string[], item: { candidates: any[] }) => {
                    const texts = item.candidates.map((candidate) =>
                      candidate.content.parts
                        .map((part: { text: any }) => part.text)
                        .join(""),
                    );
                    return acc.concat(texts);
                  },
                  [],
                );

                if (textArray.length > existingTexts.length) {
                  const deltaArray = textArray.slice(existingTexts.length);
                  existingTexts = textArray;
                  const delta = deltaArray.join("");
                  responseText += delta;
                  requestAnimationFrame(() => options.onUpdate?.(responseText));
                }
              } catch (error) {
                // console.log("[Response Animation] error: ", error,partialData);
                // skip error message when parsing json
                // to do 更严谨的错误检测和处理
                showToast(Locale.Shansing.messageParseFailure);
              }

              return reader.read().then(processText);
            });
          })
          .catch((error) => {
            showToast(Locale.Shansing.messageSendFailure);
            console.error("Error:", error);
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
        const message = this.extractMessage(resJson);
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
