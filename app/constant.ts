export const OWNER = "shansing";
export const REPO = "ChatGPT-Next-Web";
export const REPO_URL = `https://github.com/${OWNER}/${REPO}`;
export const ISSUE_URL = `https://github.com/${OWNER}/${REPO}/issues`;
export const UPDATE_URL = `${REPO_URL}#keep-updated`;
export const RELEASE_URL = `${REPO_URL}/releases`;
export const FETCH_COMMIT_URL = `https://api.github.com/repos/${OWNER}/${REPO}/commits?per_page=1`;
export const FETCH_TAG_URL = `https://api.github.com/repos/${OWNER}/${REPO}/tags?per_page=1`;
export const RUNTIME_CONFIG_DOM = "danger-runtime-config";

export const DEFAULT_API_HOST = "https://api.nextchat.dev";
export const OPENAI_BASE_URL = "https://api.openai.com";
export const ANTHROPIC_BASE_URL = "https://api.anthropic.com";

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/";
export const ALIBABA_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode";
export const OPEN_ROUTER_BASE_URL = "https://openrouter.ai/api";
export const DEEP_SEEK_BASE_URL = "https://api.deepseek.com";

export enum Path {
  Home = "/",
  Chat = "/chat",
  Settings = "/settings",
  NewChat = "/new-chat",
  Masks = "/masks",
  Auth = "/auth",
}

export enum ApiPath {
  Cors = "",
  OpenAI = "/api/openai",
  Anthropic = "/api/anthropic",
}

export enum SlotID {
  AppBody = "app-body",
  CustomModel = "custom-model",
}

export enum FileName {
  Masks = "masks.json",
  Prompts = "prompts.json",
}

export enum StoreKey {
  Chat = "chat-next-web-store",
  Access = "access-control",
  Config = "app-config",
  Mask = "mask-store",
  Prompt = "prompt-store",
  Update = "chat-update",
  Sync = "sync",
}

export const DEFAULT_SIDEBAR_WIDTH = 300;
export const MAX_SIDEBAR_WIDTH = 500;
export const MIN_SIDEBAR_WIDTH = 230;
export const NARROW_SIDEBAR_WIDTH = 100;

export const ACCESS_CODE_PREFIX = "nk-";

export const LAST_INPUT_KEY = "last-input";
export const UNFINISHED_INPUT = (id: string) => "unfinished-input-" + id;

export const STORAGE_KEY = "chatgpt-next-web";

export const REQUEST_TIMEOUT_MS = 60000;
export const REQUEST_LONG_TIMEOUT_MS = 1200000;

export const EXPORT_MESSAGE_CLASS_NAME = "export-markdown";

export enum ServiceProvider {
  OpenAI = "OpenAI",
  Azure = "Azure",
  Google = "Google",
  Anthropic = "Anthropic",
  Alibaba = "Alibaba",
  OpenRouter = "OpenRouter",
}

export enum ModelProvider {
  GPT = "GPT",
  GeminiPro = "GeminiPro",
  Claude = "Claude",
  Alibaba = "Alibaba",
  OpenRouter = "OpenRouter",
  DeepSeek = "DeepSeek",
}

export const Anthropic = {
  ChatPath: "v1/messages",
  // ChatPath1: "v1/complete",
  ExampleEndpoint: "https://api.anthropic.com",
  Vision: "2023-06-01",
};

export const OpenaiPath = {
  ChatPath: "v1/chat/completions",
  UsagePath: "dashboard/billing/usage",
  SubsPath: "dashboard/billing/subscription",
  ListModelPath: "v1/models",
};

export const Azure = {
  ExampleEndpoint: "https://{resource-url}/openai/deployments/{deploy-id}",
};

export const Google = {
  ExampleEndpoint: "https://generativelanguage.googleapis.com/",
  ChatPath: (modelName: string) => `v1beta/models/${modelName}:generateContent`,
};

export const AlibabaPath = {
  ChatPath: "v1/chat/completions",
  FilePath: "v1/files",
};

export const OpenRouterPath = {
  ChatPath: "v1/chat/completions",
};

export const DeepSeekPath = {
  ChatPath: "chat/completions",
};

export const DEFAULT_INPUT_TEMPLATE = `{{input}}`; // input / time / model / lang
// export const DEFAULT_SYSTEM_TEMPLATE = `
// You are ChatGPT, a large language model trained by {{ServiceProvider}}.
// Knowledge cutoff: {{cutoff}}
// Current model: {{model}}
// Current time: {{time}}
// Latex inline: $x^2$
// Latex block: $$e=mc^2$$
// `;
export const DEFAULT_SYSTEM_TEMPLATE = `You are {{ShansingHelperProductName}}, a large language model trained by {{ServiceProvider}}, based on the {{model}} architecture.{{ShansingCutoff}}
Current date: {{ShansingHelperUserDate}}
Latex inline: \\(x^2\\) 
Latex block: $$e=mc^2$$
{{ShansingHelperVisionFlag}}{{ShansingHelperCodeExecutionFlag}}{{ShansingHelperOnlineSearchFlag}}{{ShansingHelperClaudeTip}}{{ShansingHelperDeepseekR1Tip}}{{ShansingHelperOpenRouterDeepseekR1Tip}}`;

export const GPT_4_MODEL = "gpt-4o-2024-11-20";
// export const GPT_35_MODEL = "gpt-3.5-turbo-0125";
export const GPT_4_MINI_MODEL = "gpt-4o-mini-2024-07-18";
//temporarily disable claude
export const CLAUDE_SONNET = "anthropic/claude-3.7-sonnet"; //claude-3-5-sonnet-latest
export const CLAUDE_HAIKU = CLAUDE_SONNET; //claude-3-5-haiku-latest
export const QWEN_LONG = "qwen-long";
export const DEEPSEEK_CHAT = "deepseek-chat";
export const DEEPSEEK_REASONER = "deepseek-reasoner";

export const SUMMARIZE_MODEL = GPT_4_MINI_MODEL;
export const GEMINI_SUMMARIZE_MODEL = "gemini-2.0-flash";
export const CLAUDE_SUMMARIZE_MODEL = CLAUDE_HAIKU;
export const QWEN_SUMMARIZE_MODEL = QWEN_LONG;
export const DEEPSEEK_SUMMARIZE_MODEL = DEEPSEEK_CHAT; //of OpenRouter

export const KnowledgeCutOffDate: Record<string, string> = {
  default: "",
  "gpt-3.5-turbo": "2021-09",
  "gpt-3.5-turbo-1106": "2021-09",
  "gpt-3.5-turbo-0125": "2021-09",
  "gpt-4-vision-preview": "2023-04",
  "gpt-4-turbo": "2023-12",
  "gpt-4-turbo-2024-04-09": "2023-12",
  "gpt-4-turbo-preview": "2023-12",
  "gpt-4o": "2023-10",
  "gpt-4o-2024-11-20": "2023-10",
  "gpt-4o-2024-08-06": "2023-10",
  "gpt-4o-2024-05-13": "2023-10",
  "gpt-4o-mini": "2023-10",
  "gpt-4o-mini-2024-07-18": "2023-10",
  "gpt-4.5-preview": "2023-10",
  "gpt-4.5-preview-2025-02-27": "2023-10",
  "chatgpt-4o-latest": "2023-10",
  "o1-preview": "2023-10",
  "o1-preview-2024-09-12": "2023-10",
  o1: "2023-10",
  "o1-2024-12-17": "2023-10",
  "o1-mini": "2023-10",
  "o1-mini-2024-09-12": "2023-10",
  "openai/o3-mini-high": "2023-10",
  "o3-mini": "2023-10",
  "o3-mini-2025-01-31": "2023-10",
  // After improvements,
  // it's now easier to add "KnowledgeCutOffDate" instead of stupid hardcoding it, as was done previously.
  "gemini-pro": "2023-12",
  "gemini-pro-vision": "2023-12",
  "gemini-2.0-flash": "2024-08",
  "gemini-2.0-flash-lite-preview-02-05": "2024-08",
  "claude-3-opus-20240229": "2023-08",
  "claude-3-sonnet-20240229": "2023-08",
  "claude-3-haiku-20240307": "2023-08",
  "claude-3-5-haiku-20241022": "2024-07",
  "claude-3-5-haiku-latest": "2024-07",
  "claude-3-5-sonnet-20240620": "2024-04",
  "claude-3-5-sonnet-20241022": "2024-04",
  "claude-3-5-sonnet-latest": "2024-04",
  "anthropic/claude-3.5-sonnet": "2024-04",
  "anthropic/claude-3.7-sonnet": "2024-10",
  "anthropic/claude-3.7-sonnet:thinking": "2024-10",
};

const openaiModels = [
  "gpt-4o",
  "gpt-4o-2024-11-20",
  "gpt-4o-2024-08-06",
  "gpt-4o-2024-05-13",
  "gpt-4o-mini",
  "gpt-4o-mini-2024-07-18",
  "chatgpt-4o-latest",
  "gpt-4.5-preview",
  "gpt-4.5-preview-2025-02-27",
  "gpt-4",
  "gpt-4-turbo-preview",
  "gpt-4-turbo",
  "gpt-4-vision-preview",
  "gpt-4-turbo-2024-04-09",
  "gpt-4-0613",
  "gpt-4-32k",
  "gpt-4-32k-0613",
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-1106",
  "gpt-3.5-turbo-0125",
  "o3-mini",
  "o3-mini-2025-01-31",
  "o1",
  "o1-2024-12-17",
  "o1-preview",
  "o1-preview-2024-09-12",
  "o1-mini",
  "o1-mini-2024-09-12",
];

const googleModels = [
  "gemini-2.0-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-1.5-pro-latest",
  "gemini-1.5-pro",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b-latest",
  "gemini-1.5-flash-8b",
  "gemini-1.0-pro",
  "gemini-pro-vision",
];

const anthropicModels = [
  "claude-3-5-sonnet-latest",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "claude-3-5-haiku-latest",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
  "claude-2.1",
  "claude-2.0",
  "claude-instant-1.2",
];

const alibabaModels = [
  "qwen-max-latest",
  "qwen-max",
  "qwen-max-0428",
  "qwen-max-0403",
  "qwen-max-0107",
  "qwen-max-longcontext",
  "qwen-plus",
  "qwen-turbo",
  "qwen-vl-max",
  "qwen-vl-plus",
  "qwen-long",
  "qwen1.5-110b-chat",
  "qwen1.5-72b-chat",
  "qwen1.5-32b-chat",
  "qwen1.5-14b-chat",
  "qwen1.5-7b-chat",
  "qwen1.5-1.8b-chat",
  "qwen1.5-0.5b-chat",
  "codeqwen1.5-7b-chat",
  "qwen-72b-chat",
  "qwen-14b-chat",
  "qwen-7b-chat",
  "qwen-1.8b-longcontext-chat",
  "qwen-1.8b-chat",
];

const openRouterModels = [
  "anthropic/claude-3.7-sonnet",
  "anthropic/claude-3.7-sonnet:thinking",
  "anthropic/claude-3.5-sonnet",
  "perplexity/sonar-deep-research",
  "qwen/qwq-32b",
  "openai/o3-mini-high",
  "openai/o3-mini",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-r1-zero:free",
];

const deepSeekModels = ["deepseek-chat", "deepseek-reasoner"];

export const DEFAULT_MODELS = [
  ...openaiModels.map((name) => ({
    name,
    available: true,
    provider: {
      id: "openai",
      providerName: "OpenAI",
      providerType: "openai",
    },
  })),
  ...anthropicModels.map((name) => ({
    name,
    available: true,
    provider: {
      id: "anthropic",
      providerName: "Anthropic",
      providerType: "anthropic",
    },
  })),
  ...deepSeekModels.map((name) => ({
    name,
    available: true,
    provider: {
      id: "deepseek",
      providerName: "DeepSeek",
      providerType: "deepseek",
    },
  })),
  ...googleModels.map((name) => ({
    name,
    available: true,
    provider: {
      id: "google",
      providerName: "Google",
      providerType: "google",
    },
  })),
  ...openRouterModels.map((name) => ({
    name,
    available: true,
    provider: {
      id: "openrouter",
      providerName: "OpenRouter",
      providerType: "openrouter-compatible",
    },
  })),
  ...alibabaModels.map((name) => ({
    name,
    available: true,
    provider: {
      id: "alibaba",
      providerName: "Alibaba",
      providerType: "alibaba-compatible",
    },
  })),
] as const;

export const modelThresholdTokenNumbers = [
  {
    name: "gpt-4o-2024-11-20",
    total: 128_000,
    prompt: null,
    completion: 16_384,
  },
  {
    name: "gpt-4o-2024-08-06",
    total: 128_000,
    prompt: null,
    completion: 16_384,
  },
  { name: "gpt-4o-mini", total: 128_000, prompt: null, completion: 16_384 },
  { name: "gpt-4o", total: 128_000, prompt: null, completion: 4_096 },
  { name: "chatgpt-4o", total: 128_000, prompt: null, completion: 16_384 },
  {
    name: "gpt-4.5",
    total: 128_000,
    prompt: null,
    completion: 16_384,
  },
  { name: "gpt-4-turbo", total: 128_000, prompt: null, completion: 4_096 },
  { name: "gpt-4", total: 8192, prompt: null, completion: 4_096 },
  { name: "gpt-3.5-turbo", total: 16385, prompt: null, completion: 4_096 },
  { name: "o1-preview", total: 128_000, prompt: null, completion: 32_768 },
  { name: "o1-mini", total: 128_000, prompt: null, completion: 65_536 },
  { name: "o1", total: 200_000, prompt: null, completion: 100_000 },
  { name: "o3-mini", total: 200_000, prompt: null, completion: 100_000 },
  { name: "qwen-turbo", total: null, prompt: 6_000, completion: 1500 },
  { name: "qwen-plus", total: null, prompt: 30_000, completion: 2000 },
  {
    name: "qwen-max-longcontext",
    total: null,
    prompt: 28_000,
    completion: 2000,
  },
  { name: "qwen-max-latest", total: null, prompt: 30_720, completion: 8_192 },
  { name: "qwen-max", total: null, prompt: 6_000, completion: 2000 },
  { name: "qwen-long", total: null, prompt: 9_000, completion: 2000 }, // total is not 10_000_000
  { name: "gemini-2.0-", total: null, prompt: 1_048_576, completion: 8192 },
  { name: "gemini-", total: null, prompt: 128_000, completion: 8192 }, //1.5flash 1,048,576;  1.5pro 2,097,152;  but under 128k is cheap
  {
    name: "anthropic/claude-3.7",
    total: 200_000,
    prompt: null,
    completion: 64_000,
  },
  {
    name: "anthropic/claude-3.5-sonnet",
    total: 200_000,
    prompt: null,
    completion: 8_000,
  },
  { name: "claude-3-5-", total: 200_000, prompt: null, completion: 8192 },
  { name: "claude-3-", total: 200_000, prompt: null, completion: 4096 },
  { name: "claude-2.1", total: 200_000, prompt: null, completion: 4096 },
  { name: "claude-", total: 100_000, prompt: null, completion: 4096 },
  {
    name: "deepseek/deepseek-chat",
    total: 64_000,
    prompt: null,
    completion: 8_000,
  },
  {
    name: "deepseek/deepseek-r1",
    total: 64_000,
    prompt: null,
    completion: 64_000,
  },
  {
    name: "deepseek-chat",
    total: 64_000,
    prompt: null,
    completion: 8_000,
  },
  {
    name: "deepseek-reasoner",
    total: 64_000,
    prompt: null,
    completion: 8_000,
  },
  { name: "qwen/qwq-32b", total: 131_000, prompt: null, completion: 131_000 },
  {
    name: "perplexity/sonar-deep-research",
    total: 200_000,
    prompt: null,
    completion: 200_000,
  },
  { name: "", total: 4_000, prompt: null, completion: null }, //default
] as const;

export const CHAT_PAGE_SIZE = 15;
export const MAX_RENDER_MSG_COUNT = 45;

// some famous webdav endpoints
export const internalAllowedWebDavEndpoints = [
  // "https://dav.jianguoyun.com/dav/",
  // "https://dav.dropdav.com/",
  // "https://dav.box.com/dav",
  // "https://nanao.teracloud.jp/dav/",
  // "https://webdav.4shared.com/",
  // "https://dav.idrivesync.com",
  // "https://webdav.yandex.com",
  // "https://app.koofr.net/dav/Koofr",
];

export const visionKeywords = [
  "vision",
  "claude-3-",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-2.0",
  "gpt-4o",
  "gpt-4.5",
  "o1",
  // "o3",
  "-vl",
  // "deepseek",
  "claude-3.",
];

export const onlineSearchKeywords = [
  "gpt-",
  // "qwen-turbo",
  // "qwen-plus",
  // "qwen-max",
  // "qwen-long",
  "gemini-2.0-",
  // "gemini-1.5-",
  // "gemini-1.5-pro",
  // "claude-3-",
];

export const codeExecutionKeywords = ["gemini-1.5-", "gemini-2.0-"];

export const uploadFileModels: {
  name: string;
  accept: string;
  prefix: string;
  split: string;
}[] = [
  {
    name: "qwen-long",
    accept: ".txt,.docx,.pdf,.epub,.mobi,.md",
    prefix: "fileid://",
    split: ",",
  },
];
