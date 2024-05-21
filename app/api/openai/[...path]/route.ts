import { type OpenAIListModelResponse } from "@/app/client/platforms/openai";
import { getServerSideConfig } from "@/app/config/server";
import { ModelProvider, OpenaiPath } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../auth";
import { requestOpenai } from "../../common";
import {
  getUsernameFromHttpBasicAuth,
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
  console.log("[OpenAI Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  if (!ALLOWD_PATH.has(subpath)) {
    console.log("[OpenAI Route] forbidden path ", subpath);
    return NextResponse.json(
      {
        error: true,
        msg: "you are not allowed to request " + subpath,
      },
      {
        status: 403,
      },
    );
  }

  const username = getUsernameFromHttpBasicAuth(req);
  if (!username) {
    return NextResponse.json(
      {
        error: true,
        msg: "need http basic auth",
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
        msg: "Insufficient quota | 余额不足",
      },
      {
        status: 403,
      },
    );
  }
  const requestJson = await req.clone().json();
  const modelChoice = config.shansingModelChoice.find(
    (choice) => choice.model === requestJson.model,
  );
  if (!modelChoice) {
    return NextResponse.json(
      {
        error: true,
        msg: "Unsupported model",
      },
      {
        status: 401,
      },
    );
  }
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

  const authResult = auth(req, ModelProvider.GPT);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    const response = await requestOpenai(req);

    // list models
    if (subpath === OpenaiPath.ListModelPath && response.status === 200) {
      const resJson = (await response.json()) as OpenAIListModelResponse;
      const availableModels = getModels(resJson);
      return NextResponse.json(availableModels, {
        status: response.status,
      });
    }

    response
      .clone()
      .text()
      .then((responseBody) => {
        //console.log("[responseBody]" + responseBody)
        const usageIndex = responseBody.indexOf('"usage":{');
        if (usageIndex !== -1) {
          const openBracket = responseBody.indexOf("{", usageIndex);
          const closeBracket = responseBody.indexOf("}", openBracket);
          if (openBracket !== -1 && closeBracket !== -1) {
            const jsonString = responseBody.substring(
              openBracket,
              closeBracket + 1,
            );
            console.log("jsonString", jsonString);
            const jsonData = JSON.parse(jsonString);
            if (
              jsonData.prompt_tokens !== undefined &&
              jsonData.completion_tokens !== undefined
            ) {
              return {
                promptTokenNumber: jsonData.prompt_tokens as number,
                completionTokenNumber: jsonData.completion_tokens as number,
              };
            }
          }
        }
      })
      .then((obj) => {
        if (obj) {
          pay(
            username,
            modelChoice,
            obj.promptTokenNumber,
            obj.completionTokenNumber,
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

export const runtime = "edge";
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
