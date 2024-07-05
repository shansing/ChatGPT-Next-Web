import { type OpenAIListModelResponse } from "@/app/client/platforms/openai";
import { getServerSideConfig } from "@/app/config/server";
import { ModelProvider, OpenaiPath } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../auth";
import { requestOpenai } from "../../common";
import {
  getUsernameFromHttpBasicAuth,
  hashUsername,
  parseUsageObj,
  pay,
  readUserQuota,
} from "@/app/api/shansing";

const ALLOWD_PATH = new Set(Object.values(OpenaiPath));
const config = getServerSideConfig();

function getModels(remoteModelRes: OpenAIListModelResponse) {
  if (config.disableGPT4) {
    remoteModelRes.data = remoteModelRes.data.filter(
      (m) => !m.id.startsWith("gpt-4"),
    );
  }

  return remoteModelRes;
}

async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  // console.log("[OpenAI Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const username = getUsernameFromHttpBasicAuth(req);
  if (!username) {
    return NextResponse.json(
      {
        error: true,
        msg: "[We:oh AI] Http basic auth is needed",
      },
      {
        status: 403,
      },
    );
  }

  const subpath = params.path.join("/");

  if (!ALLOWD_PATH.has(subpath)) {
    console.warn("[OpenAI Route]<" + username + "> forbidden path ", subpath);
    return NextResponse.json(
      {
        error: true,
        msg: "[We:oh AI] You are not allowed to request " + subpath,
      },
      {
        status: 403,
      },
    );
  }

  if ((await readUserQuota(username)).lessThanOrEqualTo(0)) {
    return NextResponse.json(
      {
        error: true,
        msg: "[We:oh AI] Insufficient quota | 余额不足",
      },
      {
        status: 403,
      },
    );
  }

  const requestJson = await req.json();
  const modelChoice = config.shansingModelChoices.find(
    (choice) => choice.model === requestJson.model,
  );
  if (!modelChoice) {
    return NextResponse.json(
      {
        error: true,
        msg: "[We:oh AI] Unsupported model | 该模型不再支持",
      },
      {
        status: 401,
      },
    );
  }
  console.log("[OpenAI]<" + username + "> using model " + modelChoice.model);
  if (
    requestJson.stream &&
    (!requestJson.stream_options ||
      requestJson.stream_options.include_usage !== true)
  ) {
    return NextResponse.json(
      {
        error: true,
        msg: "Invalid param (stream_options.include_usage should be true)",
      },
      {
        status: 401,
      },
    );
  }

  const authResult = auth(req, ModelProvider.GPT, username);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    const response = await requestOpenai(req, requestJson, username);

    // list models
    if (subpath === OpenaiPath.ListModelPath && response.status === 200) {
      const resJson = (await response.json()) as OpenAIListModelResponse;
      const availableModels = getModels(resJson);
      return NextResponse.json(availableModels, {
        status: response.status,
      });
    }

    const firstPromptTokenNumber = parseInt(
        response?.headers.get("X-Shansing-First-Prompt-Token-Number") ?? "0",
      ),
      firstCompletionTokenNumber = parseInt(
        response?.headers.get("X-Shansing-First-Completion-Token-Number") ??
          "0",
      ),
      searchCount = parseInt(
        response?.headers.get("X-Shansing-Search-Count") ?? "0",
      ),
      newsCount = parseInt(
        response?.headers.get("X-Shansing-News-Count") ?? "0",
      ),
      crawlerCount = parseInt(
        response?.headers.get("X-Shansing-Crawler-Count") ?? "0",
      );
    response
      .clone()
      .text()
      .then((responseBody) => {
        //console.log("[responseBody]" + responseBody)
        const usage = parseUsageObj(responseBody, "usage", false);
        console.log(
          "[OpenAI Usage]<" + username + ">",
          JSON.stringify(usage),
          JSON.stringify({
            firstPromptTokenNumber,
            firstCompletionTokenNumber,
            searchCount,
            newsCount,
            crawlerCount,
          }),
        );
        if (
          usage &&
          usage.prompt_tokens != null &&
          usage.completion_tokens != null
        ) {
          return {
            promptTokenNumber: usage.prompt_tokens as number,
            completionTokenNumber: usage.completion_tokens as number,
          };
        }
        console.warn(
          "[ATTENTION][openai] unable to find usage, username=" +
            username +
            ", url=" +
            req.url +
            ", responseBody=" +
            responseBody,
        );
      })
      .then((obj) => {
        if (obj) {
          return pay(
            username,
            modelChoice,
            obj.promptTokenNumber + firstPromptTokenNumber,
            obj.completionTokenNumber + firstCompletionTokenNumber,
            config.shansingOnlineSearchSearchPrice
              .mul(searchCount + newsCount)
              .plus(config.shansingOnlineSearchCrawlerPrice.mul(crawlerCount)),
          );
        }
      });

    return response;
  } catch (e) {
    console.error("[OpenAI] ", e);
    return NextResponse.json(prettyObject(e));
  }
}

export const GET = handle;
export const POST = handle;

// export const runtime = "edge";
export const preferredRegion = [
  "arn1",
  "bom1",
  "cdg1",
  "cle1",
  "cpt1",
  "dub1",
  "fra1",
  "gru1",
  "hnd1",
  "iad1",
  "icn1",
  "kix1",
  "lhr1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
];
