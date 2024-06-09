import Decimal from "decimal.js";
import { getServerSideConfig } from "@/app/config/server";
import { sha256 } from "hash.js";
import fs from "fs/promises";
import AsyncLock from "async-lock";

const kilo = new Decimal("1000");
const serverConfig = getServerSideConfig();
const lock = new AsyncLock();

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

export function hashUsername(username: string): string {
  return sha256()
    .update(username + "|" + serverConfig.shansingUsernameHashKey)
    .digest("hex")
    .substring(0, 16);
}

export async function pay(
  username: string,
  modelChoice: ShansingModelChoice,
  promptTokenNumber: number,
  completionTokenNumber: number,
  extraFee: Decimal,
) {
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
    )
    .plus(extraFee);
  console.log(
    "[pay]",
    "username",
    username,
    "thisBilling",
    thisBilling.toFixed(),
  );
  return decreaseUserQuota(username, thisBilling);
}

export async function payFixed(username: string, fee: Decimal) {
  if (!username) {
    throw Error("Username not found");
  }
  console.log("[payFixed]", "username", username, "fee", fee.toFixed());
  return decreaseUserQuota(username, fee);
}

export async function readUserQuota(username: string): Promise<Decimal> {
  return fs
    .readFile(serverConfig.shansingQuotaPath + "/" + username, "utf8")
    .then((text) => {
      try {
        return new Decimal(text.trim());
      } catch (error) {
        console.error(username + "'s quota is not number", error);
        throw error;
      }
    });
}

export function getUsernameFromHttpBasicAuth(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return null;
  }
  const auth = Buffer.from(authHeader.split(" ")[1] || "", "base64").toString();
  return auth.split(":")[0];
}

async function increaseUserQuota(username: string, delta: Decimal) {
  return lock
    .acquire("QUOTA_" + username, async function () {
      const quota = await readUserQuota(username);
      // console.log(username + '\'s old quota: ' + quota.toFixed())
      const newQuota = quota.plus(delta);
      // console.log(username + '\'s new quota: ' + newQuota.toFixed())
      return fs.writeFile(
        serverConfig.shansingQuotaPath + "/" + username,
        newQuota.toFixed(),
        "utf8",
      );
    })
    .then(() => true);
}
async function decreaseUserQuota(username: string, delta: Decimal) {
  return increaseUserQuota(username, new Decimal(-1).mul(delta));
}
