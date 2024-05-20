import { readFileSync, writeFileSync } from "fs";
import Decimal from "decimal.js";
import { getServerSideConfig } from "@/app/config/server";
import { NextRequest } from "next/server";

const kilo = new Decimal("1000");
const serverConfig = getServerSideConfig();

export interface ShansingModelChoice {
  name: string;
  model: string;
  // contextToken1k: number
  // completionToken1k: number
  promptTokenPrice1k: string;
  completionTokenPrice1k: string;
  // knowledgeDate: string
  // api: ChatGPTAPI | ChatGPTUnofficialProxyAPI
  // maxPrice: string
}

export function pay(
  req: NextRequest,
  modelChoice: ShansingModelChoice,
  promptTokenNumber: number,
  completionTokenNumber: number,
) {
  const username = getUsernameFromHttpBasicAuth(req);
  if (!username) {
    throw Error("Username not found");
  }
  if (!modelChoice) {
    throw Error("Unsupported model");
  }
  if (!promptTokenNumber || !completionTokenNumber) {
    throw Error("Usage not found");
  }
  let thisBilling = new Decimal(modelChoice.promptTokenPrice1k)
    .div(kilo)
    .mul(promptTokenNumber)
    .plus(
      new Decimal(modelChoice.completionTokenPrice1k)
        .div(kilo)
        .mul(completionTokenNumber),
    );
  console.log("pay:", "username", username, "thisBilling", thisBilling);
  decreaseUserQuota(username, thisBilling, true);
}

export function readUserQuota(username: string): Decimal {
  let fileContent = readFileSync(
    serverConfig.shansingQuotaPath + "/" + username,
    "utf8",
  );
  try {
    return new Decimal(fileContent.trim());
  } catch (error) {
    globalThis.console.error(username + "'s quota is not number", error);
    throw error;
  }
}

export function getUsernameFromHttpBasicAuth(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return null;
  }
  const auth = Buffer.from(authHeader.split(" ")[1] || "", "base64").toString();
  return auth.split(":")[0];
}

function increaseUserQuota(
  username: string,
  delta: Decimal,
  allowToNegative: boolean,
) {
  let quota = readUserQuota(username);
  // console.log(username + '\'s old quota: ' + quota.toFixed())
  let newQuota = quota.plus(delta);
  // console.log(username + '\'s new quota: ' + newQuota.toFixed())
  if (!allowToNegative && newQuota.lt(0)) {
    return false;
  }
  writeFileSync(
    serverConfig.shansingQuotaPath + "/" + username,
    newQuota.toFixed(),
    "utf8",
  );
  return true;
}
function decreaseUserQuota(
  username: string,
  delta: Decimal,
  allowToNonPositive: boolean,
) {
  return increaseUserQuota(username, new Decimal(-1).mul(delta), true);
}
