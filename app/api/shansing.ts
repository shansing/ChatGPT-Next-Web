import Decimal from "decimal.js";
import { getServerSideConfig } from "@/app/config/server";
import { NextRequest } from "next/server";

const kilo = new Decimal("1000");
const serverConfig = getServerSideConfig();

const FACTORY_MODE = false;

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

export async function pay(
  username: string,
  modelChoice: ShansingModelChoice,
  promptTokenNumber: number,
  completionTokenNumber: number,
) {
  if (FACTORY_MODE) {
    return true;
  }
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
  console.log(
    "[pay]",
    "username",
    username,
    "thisBilling",
    thisBilling.toFixed(),
  );
  return decreaseUserQuota(username, thisBilling, true);
}

export async function readUserQuota(username: string): Promise<Decimal> {
  if (FACTORY_MODE) {
    return new Decimal(600);
  }
  return fetch(
    serverConfig.shansingQuotaAgentUrl +
      "?userName=" +
      encodeURIComponent(username),
    { method: "get" },
  )
    .then((res) => res.json())
    .then((res) => {
      if (res.error) {
        throw Error(
          "failed to read quota, username=" + username + ", error=" + res.error,
        );
      }
      return res.balance;
    })
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

async function increaseUserQuota(
  username: string,
  delta: Decimal,
  allowToNegative: boolean,
) {
  let quota = await readUserQuota(username);
  // console.log(username + '\'s old quota: ' + quota.toFixed())
  let newQuota = quota.plus(delta);
  // console.log(username + '\'s new quota: ' + newQuota.toFixed())
  if (!allowToNegative && newQuota.lt(0)) {
    return false;
  }
  await fetch(serverConfig.shansingQuotaAgentUrl, {
    method: "post",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body:
      "userName=" +
      encodeURIComponent(username) +
      "&newQuota=" +
      encodeURIComponent(newQuota.toFixed()),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.error) {
        throw Error(
          "failed to write quota, username=" + ", error=" + res.error,
        );
      }
      return res.balance;
    });
  return true;
}
async function decreaseUserQuota(
  username: string,
  delta: Decimal,
  allowToNonPositive: boolean,
) {
  return increaseUserQuota(username, new Decimal(-1).mul(delta), true);
}
