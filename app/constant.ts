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

export const CACHE_URL_PREFIX = "/api/cache";
export const UPLOAD_URL = `${CACHE_URL_PREFIX}/upload`;

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

export const REQUEST_TIMEOUT_MS = 60_000;
export const REQUEST_LONG_TIMEOUT_MS = 600_000;

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

export const GPT_MAIN_MODEL = "openai/gpt-5.2";
export const GPT_MAIN_MINI_MODEL = "openai/gpt-4.1-mini";
export const GPT_MAIN_NANO_MODEL = GPT_MAIN_MINI_MODEL; //gpt-5-nano is bad
//temporarily disable claude
export const CLAUDE_SONNET = "anthropic/claude-sonnet-4.5"; //claude-3-5-sonnet-latest
export const CLAUDE_HAIKU = "anthropic/claude-haiku-4.5"; //claude-3-5-haiku-latest
export const QWEN_LONG = "qwen-long";
export const DEEPSEEK_CHAT = "deepseek-chat";
export const DEEPSEEK_REASONER = "deepseek-reasoner";
export const GEMINI_PRO = "gemini-3-pro-preview";
export const GEMINI_FLASH = "gemini-2.5-flash";

export const DEFAULT_MODEL = GEMINI_PRO;
export const SUMMARIZE_MODEL = GEMINI_FLASH; //GPT_MAIN_NANO_MODEL;
export const GEMINI_SUMMARIZE_MODEL = GEMINI_FLASH;
export const CLAUDE_SUMMARIZE_MODEL = CLAUDE_HAIKU;
export const QWEN_SUMMARIZE_MODEL = QWEN_LONG;
export const DEEPSEEK_SUMMARIZE_MODEL = DEEPSEEK_CHAT; //of OpenRouter
export const OPENROUTER_SUMMARIZE_MODEL = GPT_MAIN_MINI_MODEL;

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
  "gpt-4o-search-preview-2025-03-11": "2023-10-01",
  "gpt-4o-mini-search-preview-2025-03-11": "2023-10-01",
  "gpt-4.5-preview": "2023-10",
  "gpt-4.5-preview-2025-02-27": "2023-10",
  "gpt-4.1": "2024-06-01",
  "gpt-4.1-2025-04-14": "2024-06-01",
  "gpt-4.1-mini": "2024-06-01",
  "gpt-4.1-mini-2025-04-14": "2024-06-01",
  "openai/gpt-4.1-mini": "2024-06-01",
  "gpt-4.1-nano": "2024-06-01",
  "gpt-4.1-nano-2025-04-14": "2024-06-01",
  "gpt-5": "2024-09-30",
  "gpt-5-2025-08-07": "2024-09-30",
  "gpt-5-mini": "2024-05-31",
  "openai/gpt-5-mini": "2024-05-31",
  "gpt-5-mini-2025-08-07": "2024-05-31",
  "gpt-5-nano": "2024-05-31",
  "gpt-5-nano-2025-08-07": "2024-05-31",
  "gpt-5-chat-latest": "2024-09-30",
  "gpt-5.1": "2024-09-30",
  "openai/gpt-5.2": "2025-08-31",
  "openai/gpt-5.1": "2024-09-30",
  "gpt-5.1-2025-11-13": "2024-09-30",
  "gpt-5.1-chat-latest": "2024-09-30",
  "chatgpt-4o-latest": "2023-10",
  "o1-preview": "2023-10",
  "o1-preview-2024-09-12": "2023-10",
  "openai/o1-pro": "2023-10",
  o1: "2023-10",
  "o1-2024-12-17": "2023-10",
  "o1-mini": "2023-10",
  "o1-mini-2024-09-12": "2023-10",
  "openai/o3-mini-high": "2023-10",
  "o3-mini": "2023-10",
  "o3-mini-2025-01-31": "2023-10",
  "openai/o4-mini": "2024-06-01",
  // After improvements,
  // it's now easier to add "KnowledgeCutOffDate" instead of stupid hardcoding it, as was done previously.
  "gemini-pro": "2023-12",
  "gemini-pro-vision": "2023-12",
  "gemini-3-pro-preview": "2025-01",
  "gemini-3-pro-image-preview": "2025-01",
  "gemini-2.5-pro": "2025-01",
  "gemini-2.5-flash": "2025-01",
  "gemini-2.5-pro-preview-03-25": "2025-01",
  "gemini-2.5-pro-exp-03-25": "2025-01",
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
  "anthropic/claude-haiku-4.5": "2025-07",
  "anthropic/claude-3.5-haiku": "2024-07",
  "anthropic/claude-sonnet-4": "2025-03",
  "anthropic/claude-sonnet-4.5": "2025-07",
  "anthropic/claude-opus-4.5": "2025-08",
  "x-ai/grok-3-beta": "2024-11-17",
  "x-ai/grok-3-mini-beta": "2024-11-17",
  "x-ai/grok-4": "2024-11",
};

const openaiModels = [
  "gpt-5.1-chat-latest",
  "gpt-5.1",
  "gpt-5.1-2025-11-13",
  "gpt-5-chat-latest",
  "gpt-5",
  "gpt-5-2025-08-07",
  "gpt-5-mini",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano",
  "gpt-5-nano-2025-08-07",
  "gpt-4.1",
  "gpt-4.1-2025-04-14",
  "gpt-4.1-mini",
  "gpt-4.1-mini-2025-04-14",
  "gpt-4.1-nano",
  "gpt-4.1-nano-2025-04-14",
  "chatgpt-4o-latest",
  "gpt-4o",
  "gpt-4o-2024-11-20",
  "gpt-4o-2024-08-06",
  "gpt-4o-2024-05-13",
  "gpt-4o-mini",
  "gpt-4o-mini-2024-07-18",
  "gpt-4o-search-preview",
  "gpt-4o-search-preview-2025-03-11",
  "gpt-4o-mini-search-preview",
  "gpt-4o-mini-search-preview-2025-03-11",
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
  "gemini-3-pro-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-pro-preview-03-25",
  "gemini-2.5-pro-exp-03-25",
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
  "gemini-3-pro-image-preview",
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
  "qwq-plus-latest",
  "qwq-plus",
  "qwq-plus-2025-03-05",
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
  "openai/gpt-5.2",
  "openai/gpt-5.1",
  "openai/gpt-5-mini",
  "openai/gpt-4.1-mini",
  "anthropic/claude-opus-4.5",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-3.5-haiku",
  "anthropic/claude-3.7-sonnet",
  "anthropic/claude-3.7-sonnet:thinking",
  "anthropic/claude-3.5-sonnet",
  "x-ai/grok-4",
  "x-ai/grok-3-beta",
  "x-ai/grok-3-mini-beta",
  "perplexity/sonar-deep-research",
  "qwen/qwq-32b",
  "openai/o1-pro",
  "openai/o4-mini",
  "openai/o3-mini-high",
  "openai/o3-mini",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-r1-0528",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-r1-zero:free",
];

const deepSeekModels = ["deepseek-chat", "deepseek-reasoner"];

export const DEFAULT_MODELS = [
  ...anthropicModels.map((name) => ({
    name,
    available: true,
    provider: {
      id: "anthropic",
      providerName: "Anthropic",
      providerType: "anthropic",
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
  ...deepSeekModels.map((name) => ({
    name,
    available: true,
    provider: {
      id: "deepseek",
      providerName: "DeepSeek",
      providerType: "deepseek",
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
  ...openaiModels.map((name) => ({
    name,
    available: true,
    provider: {
      id: "openai",
      providerName: "OpenAI",
      providerType: "openai",
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
] as const;

export const modelThresholdTokenNumbers = [
  { name: "gpt-5.1-chat", total: 128_000, prompt: null, completion: 16_384 },
  { name: "gpt-5.1", total: 400_000, prompt: null, completion: 128_000 },
  { name: "openai/gpt-5.", total: 400_000, prompt: null, completion: 128_000 },
  { name: "openai/gpt-5", total: 400_000, prompt: null, completion: 128_000 },
  { name: "gpt-5-chat", total: 128_000, prompt: null, completion: 16_384 },
  { name: "gpt-5", total: 400_000, prompt: null, completion: 128_000 },
  { name: "gpt-4.1", total: 1_047_576, prompt: null, completion: 32_768 },
  {
    name: "openai/gpt-4.1-mini",
    total: 1_047_576,
    prompt: null,
    completion: 32_768,
  },
  {
    name: "gpt-4o-search",
    total: 128_000,
    prompt: null,
    completion: 16_384,
  },
  {
    name: "gpt-4o-mini-search",
    total: 128_000,
    prompt: null,
    completion: 16_384,
  },
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
  { name: "o4-mini", total: 200_000, prompt: null, completion: 100_000 },
  { name: "qwq-plus", total: 131_072, prompt: 98_304, completion: 8_192 },
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
  {
    name: "gemini-3-pro-image",
    total: null,
    prompt: 65_000,
    completion: 32_000,
  },
  { name: "gemini-3-", total: null, prompt: 200_000, completion: 65_536 }, //prompt under 200k is cheap
  { name: "gemini-2.5-", total: null, prompt: 200_000, completion: 65_536 }, //prompt under 200k is cheap
  { name: "gemini-2.0-", total: null, prompt: 1_048_576, completion: 8192 },
  { name: "gemini-", total: null, prompt: 128_000, completion: 8192 }, //1.5flash 1,048,576;  1.5pro 2,097,152;  but under 128k is cheap
  {
    name: "anthropic/claude-3.5-haiku",
    total: 200_000,
    prompt: null,
    completion: 8200,
  },
  {
    name: "anthropic/claude-haiku-4",
    total: 200_000,
    prompt: null,
    completion: 64_000,
  },
  {
    name: "anthropic/claude-sonnet-4",
    total: 200_000,
    prompt: null,
    completion: 64_000,
  },
  {
    name: "anthropic/claude-opus-4",
    total: 200_000,
    prompt: null,
    completion: 64_000,
  },
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
    name: "deepseek/deepseek-r1-0528",
    total: 163_000,
    prompt: null,
    completion: 32_000,
  },
  {
    name: "deepseek/deepseek-r1",
    total: 64_000,
    prompt: null,
    completion: 64_000,
  },
  {
    name: "deepseek-chat",
    total: 128_000,
    prompt: null,
    completion: 8_000,
  },
  {
    name: "deepseek-reasoner",
    total: 128_000,
    prompt: null,
    completion: 64_000,
  },
  { name: "qwen/qwq-32b", total: 131_000, prompt: null, completion: 131_000 },
  {
    name: "perplexity/sonar-deep-research",
    total: 200_000,
    prompt: null,
    completion: 200_000,
  },
  { name: "grok-4", total: 128_000, prompt: null, completion: 128_000 }, //under 128k is cheap
  { name: "grok-3", total: 131_000, prompt: null, completion: 131_000 },
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
  "gemini-2.5",
  "gemini-3",
  "gpt-4o",
  "gpt-4.5",
  "gpt-4.1",
  "gpt-5",
  "gpt-5.1",
  "o1",
  // "o3",
  "-vl",
  // "deepseek",
  "claude-3.",
  "claude-opus-4",
  "claude-sonnet-4",
  "claude-haiku-4",
  "grok-4",
];

export const onlineSearchKeywords = [
  "gpt-",
  // "qwen-turbo",
  // "qwen-plus",
  // "qwen-max",
  // "qwen-long",
  "gemini-2.0-",
  "gemini-2.5-",
  "gemini-3-",
  // "gemini-1.5-",
  // "gemini-1.5-pro",
  // "claude-3-",
  // "deepseek-chat",
];

export const codeExecutionKeywords = [
  "gemini-1.5-",
  "gemini-2.0-",
  "gemini-2.5-",
  "gemini-3-",
];

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

export enum ReasoningLevel {
  Unspecific = "",
  None = "none",
  Low = "low",
  Medium = "medium",
  High = "high",
  Auto = "auto",
}
export const reasoningLevelModels: {
  name: string;
  levels: ReasoningLevel[];
}[] = [
  {
    name: "gemini-3-pro-preview",
    levels: [ReasoningLevel.Low, ReasoningLevel.High],
  },
  {
    name: "gemini-3-pro-image-preview",
    levels: [ReasoningLevel.Auto],
  },
  {
    name: "gemini-2.5-pro",
    levels: [ReasoningLevel.Auto],
  },
  {
    name: "gemini-2.5-flash",
    levels: [ReasoningLevel.None, ReasoningLevel.Auto],
  },
  {
    name: "openai/gpt-5.1",
    levels: [
      ReasoningLevel.None,
      ReasoningLevel.Low,
      ReasoningLevel.Medium,
      ReasoningLevel.High,
    ],
  },
  {
    name: "openai/gpt-5.2",
    levels: [
      ReasoningLevel.None,
      ReasoningLevel.Low,
      ReasoningLevel.Medium,
      ReasoningLevel.High,
    ],
  },
  {
    name: "openai/gpt-5-mini",
    levels: [ReasoningLevel.Low, ReasoningLevel.Medium, ReasoningLevel.High],
  },
  {
    name: "anthropic/claude-sonnet-4.5",
    levels: [ReasoningLevel.Low, ReasoningLevel.Medium, ReasoningLevel.High],
  },
  {
    name: "anthropic/claude-haiku-4.5",
    levels: [ReasoningLevel.Low, ReasoningLevel.Medium, ReasoningLevel.High],
  },
  {
    name: "anthropic/claude-opus-4.5",
    levels: [ReasoningLevel.Low, ReasoningLevel.Medium, ReasoningLevel.High],
  },
  {
    name: "deepseek-reasoner",
    levels: [ReasoningLevel.Auto],
  },
  {
    name: "x-ai/grok-4",
    levels: [ReasoningLevel.Auto],
  },
  {
    name: "perplexity/sonar-deep-research",
    levels: [ReasoningLevel.Low, ReasoningLevel.Medium, ReasoningLevel.High],
  },
  {
    name: "deepseek/deepseek-r1-0528",
    levels: [ReasoningLevel.Auto],
  },
  {
    name: "deepseek-chat",
    levels: [ReasoningLevel.None, ReasoningLevel.Auto],
  },
];
