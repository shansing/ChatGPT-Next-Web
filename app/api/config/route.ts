import { NextRequest, NextResponse } from "next/server";

import { getServerSideConfig } from "../../config/server";
import {
  getUsernameFromHttpBasicAuth,
  readUserQuota,
  ShansingModelChoice,
} from "@/app/api/shansing";
import Decimal from "decimal.js";

const serverConfig = getServerSideConfig();

// Danger! Do not hard code any secret value here!
// 警告！不要在这里写入任何敏感信息！
const DANGER_CONFIG = {
  needCode: serverConfig.needCode,
  hideUserApiKey: serverConfig.hideUserApiKey,
  disableGPT4: serverConfig.disableGPT4,
  hideBalanceQuery: serverConfig.hideBalanceQuery,
  disableFastLink: serverConfig.disableFastLink,
  customModels: serverConfig.customModels,
  defaultModel: serverConfig.defaultModel,

  aboutHtml: serverConfig.shansingAboutHtml,
  modelChoices: serverConfig.shansingModelChoices,
  userName: "",
  userQuota: "",
  shansingOnlineSearchSearchPrice:
    serverConfig.shansingOnlineSearchSearchPrice.toFixed(),
  shansingOnlineSearchCrawlerPrice:
    serverConfig.shansingOnlineSearchCrawlerPrice.toFixed(),
  shansingUploadFilePrice: serverConfig.shansingUploadFilePrice.toFixed(),
};

declare global {
  type DangerConfig = typeof DANGER_CONFIG;
}

async function handle(req: NextRequest) {
  const username = getUsernameFromHttpBasicAuth(req);
  return NextResponse.json({
    ...DANGER_CONFIG,
    userName: username,
    userQuota: username ? await readUserQuota(username) : null,
  });
}

export const GET = handle;
export const POST = handle;

export const runtime = "edge";
