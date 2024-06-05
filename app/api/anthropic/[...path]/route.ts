import { getServerSideConfig } from "@/app/config/server";
import {
  ANTHROPIC_BASE_URL,
  Anthropic,
  ApiPath,
  DEFAULT_MODELS,
  ModelProvider,
} from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../auth";
import { collectModelTable } from "@/app/utils/model";
import {
  getUsernameFromHttpBasicAuth,
  pay,
  readUserQuota,
} from "@/app/api/shansing";

const ALLOWD_PATH = new Set([Anthropic.ChatPath]);

async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[Anthropic Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  if (!ALLOWD_PATH.has(subpath)) {
    console.log("[Anthropic Route] forbidden path ", subpath);
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

  const authResult = auth(req, ModelProvider.Claude);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
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

  try {
    const response = await request(req);

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
        const usageIndex = responseBody.lastIndexOf('"usage"');
        if (usageIndex !== -1) {
          const openBracket = responseBody.indexOf("{", usageIndex);
          const closeBracket = responseBody.indexOf("}", openBracket);
          if (openBracket !== -1 && closeBracket !== -1) {
            const jsonString = responseBody.substring(
              openBracket,
              closeBracket + 1,
            );
            console.log(
              "[usage][anthropic]",
              {
                firstPromptTokenNumber,
                firstCompletionTokenNumber,
                searchCount,
                newsCount,
                crawlerCount,
              },
              jsonString,
            );
            const jsonData = JSON.parse(jsonString);
            if (jsonData.output_tokens !== undefined) {
              return {
                promptTokenNumber: jsonData.input_tokens as number,
                completionTokenNumber: jsonData.output_tokens as number,
                responseBody,
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
        if (obj && obj.promptTokenNumber == null) {
          const responseBody = obj.responseBody;
          //console.log("[responseBody]" + responseBody)
          const usageIndex = responseBody.indexOf('"usage"');
          if (usageIndex !== -1) {
            const openBracket = responseBody.indexOf("{", usageIndex);
            const closeBracket = responseBody.indexOf("}", openBracket);
            if (openBracket !== -1 && closeBracket !== -1) {
              const jsonString = responseBody.substring(
                openBracket,
                closeBracket + 1,
              );
              console.log("[usage][anthropic][fromStart]", jsonString);
              const jsonData = JSON.parse(jsonString);
              if (jsonData.input_tokens !== undefined) {
                return {
                  promptTokenNumber: jsonData.input_tokens as number,
                  completionTokenNumber: obj.completionTokenNumber,
                };
              }
            }
          }
          console.warn(
            "[ATTENTION] unable to find usage (fromStart), username=" +
              username +
              ", url=" +
              req.url +
              ", responseBody=" +
              responseBody,
          );
        }
        return obj;
      })
      .then((obj) => {
        if (obj) {
          console.log("[usage][anthropic][final]", obj);
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
    console.error("[Anthropic] ", e);
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

const config = getServerSideConfig();

async function request(req: NextRequest) {
  const controller = new AbortController();

  let authHeaderName = "x-api-key";
  let authValue =
    req.headers.get(authHeaderName) ||
    req.headers.get("Authorization")?.replaceAll("Bearer ", "").trim() ||
    config.anthropicApiKey ||
    "";

  let path = `${req.nextUrl.pathname}`.replaceAll(ApiPath.Anthropic, "");

  let baseUrl = config.anthropicUrl || config.baseUrl || ANTHROPIC_BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  console.log("[Proxy] ", path);
  console.log("[Base Url]", baseUrl);

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  const fetchUrl = `${baseUrl}${path}`;

  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      [authHeaderName]: authValue,
      "anthropic-version":
        req.headers.get("anthropic-version") ||
        config.anthropicApiVersion ||
        Anthropic.Vision,
    },
    method: req.method,
    body: req.body,
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  // #1815 try to refuse some request to some models
  if (config.customModels && req.body) {
    try {
      const modelTable = collectModelTable(DEFAULT_MODELS, config.customModels);
      const clonedBody = await req.text();
      fetchOptions.body = clonedBody;

      const jsonBody = JSON.parse(clonedBody) as { model?: string };

      // not undefined and is false
      if (modelTable[jsonBody?.model ?? ""].available === false) {
        return NextResponse.json(
          {
            error: true,
            message: `you are not allowed to use ${jsonBody?.model} model`,
          },
          {
            status: 403,
          },
        );
      }
    } catch (e) {
      console.error(`[Anthropic] filter`, e);
    }
  }
  // console.log("[Anthropic request]", fetchOptions.headers, req.method);
  try {
    const res = await fetch(fetchUrl, fetchOptions);

    // console.log(
    //   "[Anthropic response]",
    //   res.status,
    //   "   ",
    //   res.headers,
    //   res.url,
    // );
    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
