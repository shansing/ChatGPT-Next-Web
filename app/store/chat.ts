import {
  trimTopic,
  getMessageTextContent,
  isVisionModel,
  isOnlineSearchModel,
  isCodeExecutionModel,
} from "../utils";

import Locale, { getLang } from "../locales";
import { showToast } from "../components/ui-lib";
import { ModelConfig, ModelType, useAppConfig } from "./config";
import { createEmptyMask, Mask } from "./mask";
import {
  DEFAULT_INPUT_TEMPLATE,
  DEFAULT_MODELS,
  DEFAULT_SYSTEM_TEMPLATE,
  KnowledgeCutOffDate,
  ModelProvider,
  StoreKey,
  SUMMARIZE_MODEL,
  GEMINI_SUMMARIZE_MODEL,
  ALIBABA_SUMMARIZE_MODEL,
  uploadFileModels,
  CLAUDE_SUMMARIZE_MODEL,
  ServiceProvider,
} from "../constant";
import { ClientApi, RequestMessage, MultimodalContent } from "../client/api";
import { ChatControllerPool } from "../client/controller";
import { prettyObject } from "../utils/format";
import { estimateTokenLength } from "../utils/token";
import { nanoid } from "nanoid";
import { createPersistStore } from "../utils/store";
import { identifyDefaultClaudeModel } from "../utils/checkers";
import { collectModelsWithDefaultModel } from "../utils/model";
import { useAccessStore } from "./access";
import {
  calculatePromptTokenThreshold,
  extractErrorMessage,
} from "@/app/client/shansing";

export type ChatMessage = RequestMessage & {
  date: string;
  streaming?: boolean;
  isError?: boolean;
  id: string;
  model?: ModelType;
  isOnlineSearch?: boolean;
  isCodeExecution?: boolean;
};

export function createMessage(override: Partial<ChatMessage>): ChatMessage {
  return {
    id: nanoid(),
    date: new Date().toLocaleString(),
    role: "user",
    content: "",
    ...override,
  };
}

export interface ChatStat {
  tokenCount: number;
  wordCount: number;
  charCount: number;
}

export interface ChatSession {
  id: string;
  topic: string;

  memoryPrompt: string;
  messages: ChatMessage[];
  stat: ChatStat;
  lastUpdate: number;
  lastSummarizeIndex: number;
  clearContextIndex?: number;

  mask: Mask;
}

export const DEFAULT_TOPIC = Locale.Store.DefaultTopic;
export const BOT_HELLO: ChatMessage = createMessage({
  role: "assistant",
  content: Locale.Store.BotHello,
});

function createEmptySession(): ChatSession {
  return {
    id: nanoid(),
    topic: DEFAULT_TOPIC,
    memoryPrompt: "",
    messages: [],
    stat: {
      tokenCount: 0,
      wordCount: 0,
      charCount: 0,
    },
    lastUpdate: Date.now(),
    lastSummarizeIndex: 0,

    mask: createEmptyMask(),
  };
}

function getSummarizeModel(currentModel: string) {
  // if it is using gpt-* models, force to use 3.5 to summarize
  if (currentModel.startsWith("gpt")) {
    const configStore = useAppConfig.getState();
    const accessStore = useAccessStore.getState();
    const allModel = collectModelsWithDefaultModel(
      configStore.models,
      [configStore.customModels, accessStore.customModels].join(","),
      accessStore.defaultModel,
    );
    const summarizeModel = allModel.find(
      (m) => m.name === SUMMARIZE_MODEL && m.available,
    );
    return summarizeModel?.name ?? currentModel;
  }
  if (currentModel.startsWith("gemini")) {
    return GEMINI_SUMMARIZE_MODEL;
  }
  if (currentModel.startsWith("claude")) {
    return CLAUDE_SUMMARIZE_MODEL;
  }
  if (currentModel.startsWith("qwen-")) {
    return ALIBABA_SUMMARIZE_MODEL;
  }
  return currentModel;
}

function countMessages(msgs: ChatMessage[]) {
  return msgs.reduce(
    (pre, cur) => pre + estimateTokenLength(getMessageTextContent(cur)),
    0,
  );
}

function fillTemplateWith(input: string, modelConfig: ModelConfig) {
  const cutoff =
    KnowledgeCutOffDate[modelConfig.model] ?? KnowledgeCutOffDate.default;
  // Find the model in the DEFAULT_MODELS array that matches the modelConfig.model
  const modelInfo = DEFAULT_MODELS.find((m) => m.name === modelConfig.model);

  var serviceProvider = "OpenAI";
  if (modelInfo) {
    // TODO: auto detect the providerName from the modelConfig.model

    // Directly use the providerName from the modelInfo
    serviceProvider = modelInfo.provider.providerName;
  }

  let productName = "Shansing He2per";
  if (serviceProvider === ServiceProvider.OpenAI) {
    productName = "ChatGPT";
  } else if (serviceProvider === ServiceProvider.Google) {
    productName = "Gemini";
  } else if (serviceProvider === ServiceProvider.Anthropic) {
    productName = "Claude";
  } else if (serviceProvider === ServiceProvider.Alibaba) {
    productName = "Tongyi Qianwen";
  }

  const vars = {
    ServiceProvider: serviceProvider,
    cutoff,
    model: modelConfig.model,
    time: new Date().toString(),
    lang: getLang(),
    input: input,
    ShansingHelperProductName: productName,
    ShansingHelperUserDate: new Date()
      .toLocaleDateString("ISO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, "-"),
    ShansingHelperUserTime: new Date().toLocaleTimeString("UTC"),
    ShansingHelperUserLanguage: navigator.language,
    ShansingHelperVisionFlag: isVisionModel(modelConfig.model)
      ? "Vision (image prompt support): on\n"
      : "",
    ShansingHelperOnlineSearchFlag:
      isOnlineSearchModel(modelConfig.model) && modelConfig.shansingOnlineSearch
        ? "Online Search (search and visit webpages): on\n"
        : "",
    ShansingHelperCodeExecutionFlag:
      isCodeExecutionModel(modelConfig.model) &&
      modelConfig.shansingCodeExecution
        ? "Code Execution: on\n"
        : "",
    ShansingHelperClaudeTip:
      productName === "Claude"
        ? "" //'\nWhen speaking CJK, make sure you write punctuation symbols in FULLWIDTH forms (for example `，` `。` `！` `？` and `「quote」` instead of `"quote"`).\n'
        : "",
  };

  let output = modelConfig.template ?? DEFAULT_INPUT_TEMPLATE;

  // remove duplicate
  if (input.startsWith(output)) {
    output = "";
  }

  // must contains {{input}}
  const inputVar = "{{input}}";
  if (!output.includes(inputVar)) {
    output += "\n" + inputVar;
  }

  Object.entries(vars).forEach(([name, value]) => {
    const regex = new RegExp(`{{${name}}}`, "g");
    output = output.replace(regex, value.toString()); // Ensure value is a string
  });

  return output;
}

const DEFAULT_CHAT_STATE = {
  sessions: [createEmptySession()],
  currentSessionIndex: 0,
};

export const useChatStore = createPersistStore(
  DEFAULT_CHAT_STATE,
  (set, _get) => {
    function get() {
      return {
        ..._get(),
        ...methods,
      };
    }

    const methods = {
      clearSessions() {
        set(() => ({
          sessions: [createEmptySession()],
          currentSessionIndex: 0,
        }));
      },

      selectSession(index: number) {
        set({
          currentSessionIndex: index,
        });
      },

      moveSession(from: number, to: number) {
        set((state) => {
          const { sessions, currentSessionIndex: oldIndex } = state;

          // move the session
          const newSessions = [...sessions];
          const session = newSessions[from];
          newSessions.splice(from, 1);
          newSessions.splice(to, 0, session);

          // modify current session id
          let newIndex = oldIndex === from ? to : oldIndex;
          if (oldIndex > from && oldIndex <= to) {
            newIndex -= 1;
          } else if (oldIndex < from && oldIndex >= to) {
            newIndex += 1;
          }

          return {
            currentSessionIndex: newIndex,
            sessions: newSessions,
          };
        });
      },

      newSession(mask?: Mask) {
        const session = createEmptySession();

        if (mask) {
          const config = useAppConfig.getState();
          const globalModelConfig = config.modelConfig;

          session.mask = {
            ...mask,
            modelConfig: {
              ...globalModelConfig,
              ...mask.modelConfig,
            },
          };
          session.topic = mask.name;
        }

        set((state) => ({
          currentSessionIndex: 0,
          sessions: [session].concat(state.sessions),
        }));
      },

      nextSession(delta: number) {
        const n = get().sessions.length;
        const limit = (x: number) => (x + n) % n;
        const i = get().currentSessionIndex;
        get().selectSession(limit(i + delta));
      },

      deleteSession(index: number) {
        const deletingLastSession = get().sessions.length === 1;
        const deletedSession = get().sessions.at(index);

        if (!deletedSession) return;

        const sessions = get().sessions.slice();
        sessions.splice(index, 1);

        const currentIndex = get().currentSessionIndex;
        let nextIndex = Math.min(
          currentIndex - Number(index < currentIndex),
          sessions.length - 1,
        );

        if (deletingLastSession) {
          nextIndex = 0;
          sessions.push(createEmptySession());
        }

        // for undo delete action
        const restoreState = {
          currentSessionIndex: get().currentSessionIndex,
          sessions: get().sessions.slice(),
        };

        set(() => ({
          currentSessionIndex: nextIndex,
          sessions,
        }));

        showToast(
          Locale.Home.DeleteToast,
          {
            text: Locale.Home.Revert,
            onClick() {
              set(() => restoreState);
            },
          },
          5000,
        );
      },

      currentSession() {
        let index = get().currentSessionIndex;
        const sessions = get().sessions;

        if (index < 0 || index >= sessions.length) {
          index = Math.min(sessions.length - 1, Math.max(0, index));
          set(() => ({ currentSessionIndex: index }));
        }

        const session = sessions[index];

        return session;
      },

      onNewMessage(session: ChatSession, message: ChatMessage) {
        get().updateSpecificSession(session, (session) => {
          session.messages = session.messages.concat();
          session.lastUpdate = Date.now();
        });
        get().updateStat(session, message);
        get().summarizeSession();
      },

      async onUserInput(content: string, attachImages?: string[]) {
        const session = get().currentSession();
        const modelConfig = session.mask.modelConfig;

        const userContent = fillTemplateWith(content, modelConfig);
        console.log("[User Input] after template: ", userContent);

        let mContent: string | MultimodalContent[] = userContent;

        if (attachImages && attachImages.length > 0) {
          mContent = attachImages.map((url) => {
            return {
              type: "image_url",
              image_url: {
                url: url,
              },
            };
          });
          // images first, then text
          mContent.push({
            type: "text",
            text: userContent,
          });
        }
        const userMessage: ChatMessage = createMessage({
          role: "user",
          content: mContent,
        });
        const savedUserMessage = {
          ...userMessage,
          content: mContent,
        };

        const botMessage: ChatMessage = createMessage({
          role: "assistant",
          streaming: true,
          model: modelConfig.model,
        });

        // get recent messages
        const recentMessages = get().getMessagesWithMemory(
          estimateTokenLength(JSON.stringify(userMessage)),
        );
        const sendMessages = recentMessages.concat(userMessage);
        const messageIndex = get().currentSession().messages.length + 1;

        // save user's and bot's message
        get().updateSpecificSession(session, (session) => {
          session.messages = session.messages.concat([
            savedUserMessage,
            botMessage,
          ]);
        });

        const uploadFileModel = uploadFileModels.find(
          (uploadFileModel) => uploadFileModel.name === modelConfig.model,
        );
        //包含文件，目前以qwen模式为准
        if (
          uploadFileModel &&
          modelConfig.shansingFileIds &&
          modelConfig.shansingFileIds.length > 0
        ) {
          console.log("[shansingFileIds]", modelConfig.shansingFileIds);
          if (!sendMessages[0] || sendMessages[0].role !== "system") {
            sendMessages.unshift(
              createMessage({
                role: "system",
                content: fillTemplateWith("", {
                  ...modelConfig,
                  template: DEFAULT_SYSTEM_TEMPLATE,
                }),
              }),
            );
          }
          const content = modelConfig.shansingFileIds
            .map((fileId) => uploadFileModel.prefix + fileId)
            .join(uploadFileModel.split);
          if (!sendMessages[1] || sendMessages[1].role !== "system") {
            sendMessages.splice(
              1,
              0,
              createMessage({
                role: "system",
                content: content,
              }),
            );
          }
        }
        // console.log('sendMessages', sendMessages)

        const api = this.getClientApi(modelConfig.model);

        // make request
        api.llm.chat({
          messages: sendMessages,
          config: {
            ...modelConfig,
            stream: true,
            checkShansingOnlineSearch: true,
          },
          onFlag(isOnlineSearch, isCodeExecution) {
            if (isOnlineSearch != null) {
              botMessage.isOnlineSearch = isOnlineSearch;
            }
            if (isCodeExecution != null) {
              botMessage.isCodeExecution = isCodeExecution;
            }
            get().updateSpecificSession(session, (session) => {
              session.messages = session.messages.concat();
            });
          },
          onUpdate(message) {
            botMessage.streaming = true;
            if (message) {
              botMessage.content = message;
            }
            try {
              get().updateSpecificSession(session, (session) => {
                session.messages = session.messages.concat();
              });
            } catch (err) {
              console.error("updateCurrentSession", err);
            }
          },
          onFinish(message) {
            botMessage.streaming = false;
            if (message) {
              botMessage.content = message;
              get().onNewMessage(session, botMessage);
            }
            ChatControllerPool.remove(session.id, botMessage.id);
          },
          onError(error) {
            const isAborted = error.message.includes("aborted");
            botMessage.content +=
              "\n\n" +
              Locale.Shansing.errorPrefix +
              extractErrorMessage(error.message) +
              "\n" +
              prettyObject({
                error: true,
                message: error.message,
              });
            botMessage.streaming = false;
            userMessage.isError = !isAborted;
            savedUserMessage.isError = userMessage.isError;
            botMessage.isError = !isAborted;
            get().updateSpecificSession(session, (session) => {
              session.messages = session.messages.concat();
            });
            ChatControllerPool.remove(
              session.id,
              botMessage.id ?? messageIndex,
            );

            console.error("[Chat] failed ", error);
          },
          onController(controller) {
            // collect controller for stop/retry
            ChatControllerPool.addController(
              session.id,
              botMessage.id ?? messageIndex,
              controller,
            );
          },
        });
      },

      getMemoryPrompt() {
        const session = get().currentSession();

        if (session.memoryPrompt.length) {
          return {
            role: "system",
            content: Locale.Store.Prompt.History(session.memoryPrompt),
            date: "",
          } as ChatMessage;
        }
      },

      getMessagesWithMemory(userMessageLength: number) {
        const session = get().currentSession();
        const modelConfig = session.mask.modelConfig;
        const clearContextIndex = session.clearContextIndex ?? 0;
        const messages = session.messages.slice();
        const totalMessageCount = session.messages.length;

        // in-context prompts
        const contextPrompts = session.mask.context.slice();

        // system prompts, to get close to OpenAI Web ChatGPT
        const shouldInjectSystemPrompts = modelConfig.enableInjectSystemPrompts;
        // &&session.mask.modelConfig.model.startsWith("gpt-");

        var systemPrompts: ChatMessage[] = [];
        systemPrompts = shouldInjectSystemPrompts
          ? [
              createMessage({
                role: "system",
                content: fillTemplateWith("", {
                  ...modelConfig,
                  template: DEFAULT_SYSTEM_TEMPLATE,
                }),
              }),
            ]
          : [];
        if (shouldInjectSystemPrompts) {
          console.log(
            "[Global System Prompt] ",
            systemPrompts.at(0)?.content ?? "empty",
          );
        }
        const memoryPrompt = get().getMemoryPrompt();
        // long term memory
        const shouldSendLongTermMemory =
          modelConfig.sendMemory &&
          session.memoryPrompt &&
          session.memoryPrompt.length > 0 &&
          session.lastSummarizeIndex > clearContextIndex;
        const longTermMemoryPrompts =
          shouldSendLongTermMemory && memoryPrompt ? [memoryPrompt] : [];
        const longTermMemoryStartIndex = session.lastSummarizeIndex;

        // short term memory
        const shortTermMemoryStartIndex = Math.max(
          0,
          totalMessageCount - modelConfig.historyMessageCount,
        );

        // lets concat send messages, including 4 parts:
        // 0. system prompt: to get close to OpenAI Web ChatGPT
        // 1. long term memory: summarized memory messages
        // 2. pre-defined in-context prompts
        // 3. short term memory: latest n messages
        // 4. newest input message
        const memoryStartIndex = shouldSendLongTermMemory
          ? Math.min(longTermMemoryStartIndex, shortTermMemoryStartIndex)
          : shortTermMemoryStartIndex;
        // and if user has cleared history messages, we should exclude the memory too.
        const contextStartIndex = Math.max(clearContextIndex, memoryStartIndex);
        // const maxTokenThreshold = modelConfig.max_tokens;
        const maxPromptTokenThreshold = calculatePromptTokenThreshold(
          modelConfig.model,
          modelConfig.max_tokens,
          userMessageLength +
            estimateTokenLength(
              JSON.stringify({
                systemPrompts,
                longTermMemoryPrompts,
                contextPrompts,
              }),
            ),
        );
        console.log("maxPromptTokenThreshold", maxPromptTokenThreshold);

        // get recent messages as much as possible
        const reversedRecentMessages = [];
        for (
          let i = totalMessageCount - 1, tokenCount = 0;
          i >= contextStartIndex && tokenCount < maxPromptTokenThreshold;
          i -= 1
        ) {
          const msg = messages[i];
          if (!msg || msg.isError) continue;
          // tokenCount += estimateTokenLength(getMessageTextContent(msg));
          tokenCount += estimateTokenLength(JSON.stringify(msg));
          reversedRecentMessages.push(msg);
        }
        //let recentMessages start with a user message
        let reversedRecentMessageTo = 0;
        for (let i = reversedRecentMessages.length - 1; i >= 0; i -= 1) {
          const message = reversedRecentMessages[i];
          if (message.role === "user") {
            reversedRecentMessageTo = i + 1;
            break;
          }
        }
        console.log("reversedRecentMessageTo", reversedRecentMessageTo);
        // concat all messages
        const recentMessages = [
          ...systemPrompts,
          ...longTermMemoryPrompts,
          ...contextPrompts,
          ...reversedRecentMessages.slice(0, reversedRecentMessageTo).reverse(),
        ];

        return recentMessages;
      },

      updateMessage(
        sessionIndex: number,
        messageIndex: number,
        updater: (message?: ChatMessage) => void,
      ) {
        const sessions = get().sessions;
        const session = sessions.at(sessionIndex);
        const messages = session?.messages;
        updater(messages?.at(messageIndex));
        set(() => ({ sessions }));
      },

      resetSession() {
        get().updateCurrentSessionNow((session) => {
          session.messages = [];
          session.memoryPrompt = "";
        });
      },

      summarizeSession() {
        const config = useAppConfig.getState();
        const session = get().currentSession();
        const modelConfig = session.mask.modelConfig;

        const api = this.getClientApi(modelConfig.model);

        // remove error messages if any
        const messages = session.messages;

        // should summarize topic after chating more than 50 words
        const SUMMARIZE_MIN_LEN = 50;
        if (
          config.enableAutoGenerateTitle &&
          session.topic === DEFAULT_TOPIC &&
          countMessages(messages) >= SUMMARIZE_MIN_LEN
        ) {
          const topicMessages = messages.concat(
            createMessage({
              role: "user",
              content: Locale.Store.Prompt.Topic,
            }),
          );
          api.llm.chat({
            messages: topicMessages,
            config: {
              model: getSummarizeModel(session.mask.modelConfig.model),
              stream: false,
              checkShansingOnlineSearch: false,
            },
            onFinish(message) {
              const topic = message.length > 0 ? trimTopic(message) : "";
              if (topic.length > 0) {
                get().updateSpecificSession(
                  session,
                  (session) => (session.topic = topic),
                );
              }
            },
          });
        }
        const summarizeIndex = Math.max(
          session.lastSummarizeIndex,
          session.clearContextIndex ?? 0,
        );
        let toBeSummarizedMsgs = messages
          .filter((msg) => !msg.isError)
          .slice(summarizeIndex);

        const historyMsgLength = countMessages(toBeSummarizedMsgs);

        if (
          historyMsgLength > modelConfig.compressMessageLengthThreshold &&
          modelConfig.sendMemory
        ) {
          const SUMMARIZE_MAX_TOKENS = 500;

          const summarizeRequestMessage = createMessage({
            role: "user", //modelConfig.model.startsWith("gpt-") ? "system" : "user",
            content: Locale.Store.Prompt.Summarize,
            date: "",
          });
          const memoryPrompt = get().getMemoryPrompt();

          const maxPromptTokenThreshold = calculatePromptTokenThreshold(
            modelConfig.model,
            SUMMARIZE_MAX_TOKENS,
            estimateTokenLength(
              JSON.stringify({ summarizeRequestMessage, memoryPrompt }),
            ),
          );

          if (historyMsgLength > maxPromptTokenThreshold) {
            const n = toBeSummarizedMsgs.length;
            toBeSummarizedMsgs = toBeSummarizedMsgs.slice(
              Math.max(0, n - modelConfig.historyMessageCount),
            );
          }
          if (memoryPrompt) {
            // add memory prompt
            toBeSummarizedMsgs.unshift(memoryPrompt);
          }

          const lastSummarizeIndex = session.messages.length;

          console.log(
            "[Chat History] ",
            toBeSummarizedMsgs,
            historyMsgLength,
            modelConfig.compressMessageLengthThreshold,
          );

          // const { max_tokens, ...modelcfg } = modelConfig;
          api.llm.chat({
            messages: toBeSummarizedMsgs.concat(summarizeRequestMessage),
            config: {
              ...modelConfig,
              max_tokens: SUMMARIZE_MAX_TOKENS,
              stream: true,
              model: getSummarizeModel(session.mask.modelConfig.model),
              checkShansingOnlineSearch: false,
            },
            onUpdate(message) {
              session.memoryPrompt = message;
            },
            onFinish(message) {
              console.log("[Memory] ", message);
              get().updateSpecificSession(session, (session) => {
                session.lastSummarizeIndex = lastSummarizeIndex;
                session.memoryPrompt = message; // Update the memory prompt for stored it in local storage
              });
            },
            onError(err) {
              console.error("[Summarize] ", err);
            },
          });
        }
      },

      async uploadFiles(files: File[]): Promise<string[]> {
        if (files.length <= 0) {
          return [];
        }
        const session = get().currentSession();
        const modelConfig = session.mask.modelConfig;
        const api = this.getClientApi(modelConfig.model);

        const fileIds: string[] = [];
        for (const file of files) {
          const responseBody = await api.llm.uploadFile(file);
          try {
            const obj = JSON.parse(responseBody);
            const fileId: string = obj?.id;
            if (!fileId) {
              throw Error("fileId not found.");
            }
            fileIds.push(fileId);
          } catch (error: any) {
            console.log("[uploadFiles]", error);
            throw Error(
              Locale.Shansing.errorPrefix + extractErrorMessage(responseBody),
            );
          }
        }

        const config = useAppConfig.getState();
        if (config.enableAutoGenerateTitle && session.topic === DEFAULT_TOPIC) {
          const fileName = files[0].name;
          const fileNameWithoutExtension = fileName.includes(".")
            ? fileName.split(".").slice(0, -1).join(".")
            : fileName;
          get().updateSpecificSession(
            session,
            (session) => (session.topic = fileNameWithoutExtension),
          );
        }

        return fileIds;
      },

      getClientApi(model: string) {
        if (model.startsWith("gemini")) {
          return new ClientApi(ModelProvider.GeminiPro);
        } else if (identifyDefaultClaudeModel(model)) {
          return new ClientApi(ModelProvider.Claude);
        } else if (model.startsWith("qwen-")) {
          return new ClientApi(ModelProvider.Alibaba);
        } else {
          return new ClientApi(ModelProvider.GPT);
        }
      },

      updateStat(session: ChatSession, message: ChatMessage) {
        get().updateSpecificSession(session, (session) => {
          session.stat.charCount += message.content.length;
          // TODO: should update chat count and word count
        });
      },

      updateCurrentSessionNow(updater: (session: ChatSession) => void) {
        const sessions = get().sessions;
        const index = get().currentSessionIndex;
        updater(sessions[index]);
        set(() => ({ sessions }));
      },

      updateSpecificSession(
        session: ChatSession,
        updater: (session: ChatSession) => void,
      ) {
        const sessions = get().sessions;
        updater(session);
        set(() => ({ sessions }));
      },

      clearAllData() {
        localStorage.clear();
        location.reload();
      },
    };

    return methods;
  },
  {
    name: StoreKey.Chat,
    version: 3.1,
    migrate(persistedState, version) {
      const state = persistedState as any;
      const newState = JSON.parse(
        JSON.stringify(state),
      ) as typeof DEFAULT_CHAT_STATE;

      if (version < 2) {
        newState.sessions = [];

        const oldSessions = state.sessions;
        for (const oldSession of oldSessions) {
          const newSession = createEmptySession();
          newSession.topic = oldSession.topic;
          newSession.messages = [...oldSession.messages];
          newSession.mask.modelConfig.sendMemory = true;
          newSession.mask.modelConfig.historyMessageCount = 4;
          newSession.mask.modelConfig.compressMessageLengthThreshold = 1000;
          newState.sessions.push(newSession);
        }
      }

      if (version < 3) {
        // migrate id to nanoid
        newState.sessions.forEach((s) => {
          s.id = nanoid();
          s.messages.forEach((m) => (m.id = nanoid()));
        });
      }

      // Enable `enableInjectSystemPrompts` attribute for old sessions.
      // Resolve issue of old sessions not automatically enabling.
      if (version < 3.1) {
        newState.sessions.forEach((s) => {
          if (
            // Exclude those already set by user
            !s.mask.modelConfig.hasOwnProperty("enableInjectSystemPrompts")
          ) {
            // Because users may have changed this configuration,
            // the user's current configuration is used instead of the default
            const config = useAppConfig.getState();
            s.mask.modelConfig.enableInjectSystemPrompts =
              config.modelConfig.enableInjectSystemPrompts;
          }
        });
      }

      return newState as any;
    },
  },
);
