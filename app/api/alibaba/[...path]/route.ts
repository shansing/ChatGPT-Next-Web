import { getServerSideConfig } from "@/app/config/server";
import { ModelProvider, AlibabaPath, ALIBABA_BASE_URL } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../auth";
import {
  getUsernameFromHttpBasicAuth,
  pay,
  readUserQuota,
} from "@/app/api/shansing";
import { requestCompatibleOpenai } from "@/app/api/common";

const ALLOWD_PATH = new Set(Object.values(AlibabaPath));
const config = getServerSideConfig();

async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[Alibaba Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  if (!ALLOWD_PATH.has(subpath)) {
    console.log("[Alibaba Route] forbidden path ", subpath);
    return NextResponse.json(
      {
        error: true,
        msg: "[Shansing He2per] You are not allowed to request " + subpath,
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
        msg: "[Shansing He2per] Http basic auth is needed",
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
        msg: "[Shansing He2per] Insufficient quota | 余额不足",
      },
      {
        status: 403,
      },
    );
  }
  const requestJson = await req.clone().json();
  const modelChoice = config.shansingModelChoices.find(
    (choice) => choice.model === requestJson.model,
  );
  if (!modelChoice) {
    return NextResponse.json(
      {
        error: true,
        msg: "[Shansing He2per] Unsupported model | 该模型不再支持",
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

  const authResult = auth(req, ModelProvider.Alibaba);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    const response = await requestCompatibleOpenai(
      req,
      ALIBABA_BASE_URL,
      config.shansingChinaSocksProxy,
    );

    response
      .clone()
      .text()
      .then((responseBody) => {
        //console.log("[responseBody]" + responseBody)
        const usageIndex = responseBody.lastIndexOf('"usage"');
        if (usageIndex !== -1) {
          const openBracket = responseBody.indexOf("{", usageIndex);
          const closeBracket = responseBody.indexOf("}", openBracket);
          if (openBracket !== -1 && closeBracket !== -1) {
            const jsonString = responseBody.substring(
              openBracket,
              closeBracket + 1,
            );
            console.log("[usage][alibaba]", jsonString);
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
        console.warn(
          "[ATTENTION] unable to find usage, username=" +
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
            obj.promptTokenNumber,
            obj.completionTokenNumber,
          );
        }
      });

    return response;
  } catch (e) {
    console.error("[Alibaba]compatible ", e);
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
