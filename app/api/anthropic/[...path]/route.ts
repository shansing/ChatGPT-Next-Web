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
import {
  getUsernameFromHttpBasicAuth,
  hashUsername,
  pay,
  readUserQuota,
} from "@/app/api/shansing";
import { parseUsageObj } from "@/app/api/common";

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
  const usernameHash = hashUsername(username);

  const authResult = auth(req, ModelProvider.Claude);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  const requestJson = await req.json();
  const modelChoice = serverConfig.shansingModelChoices.find(
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
    const response = await request(req, requestJson, usernameHash);

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
        const startUsage = parseUsageObj(responseBody, "usage", true);
        const endUsage = parseUsageObj(responseBody, "usage", false);
        console.log(
          "[usage][anthropic]",
          JSON.stringify({
            firstPromptTokenNumber,
            firstCompletionTokenNumber,
            searchCount,
            newsCount,
            crawlerCount,
          }),
          startUsage,
          endUsage,
        );
        if (endUsage && endUsage.output_tokens != null) {
          const result = {
            promptTokenNumber: endUsage.input_tokens as
              | number
              | null
              | undefined,
            completionTokenNumber: endUsage.output_tokens as number,
          };
          if (
            result.promptTokenNumber == null &&
            startUsage &&
            startUsage.input_tokens != null
          ) {
            result.promptTokenNumber = startUsage.input_tokens as number;
          }
          if (
            result.promptTokenNumber != null &&
            result.completionTokenNumber != null
          ) {
            return {
              promptTokenNumber: result.promptTokenNumber as number,
              completionTokenNumber: result.completionTokenNumber as number,
            };
          }
        }
        console.warn(
          "[ATTENTION][anthropic] unable to find usage, username=" +
            username +
            ", url=" +
            req.url +
            ", responseBody=" +
            responseBody,
        );
      })
      .then((obj) => {
        if (obj) {
          console.log("[usage][anthropic][final]", obj);
          return pay(
            username,
            modelChoice,
            obj.promptTokenNumber + firstPromptTokenNumber,
            obj.completionTokenNumber + firstCompletionTokenNumber,
            serverConfig.shansingOnlineSearchSearchPrice
              .mul(searchCount + newsCount)
              .plus(
                serverConfig.shansingOnlineSearchCrawlerPrice.mul(crawlerCount),
              ),
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

const serverConfig = getServerSideConfig();

async function request(
  req: NextRequest,
  requestJson: any,
  usernameHash: string,
) {
  const controller = new AbortController();

  let authHeaderName = "x-api-key";
  let authValue =
    // req.headers.get(authHeaderName) ||
    // req.headers.get("Authorization")?.replaceAll("Bearer ", "").trim() ||
    serverConfig.anthropicApiKey || "";

  let path = `${req.nextUrl.pathname}`.replaceAll(ApiPath.Anthropic, "");

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  let baseUrl =
    serverConfig.anthropicUrl || serverConfig.baseUrl || ANTHROPIC_BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  console.log("[Base Url]", baseUrl);

  const apiBaseUrl = baseUrl;
  const onlineSearch = req.headers.get("X-Shansing-Online-Search") == "true";
  if (onlineSearch) {
    baseUrl = serverConfig.shansingOnlineSearchUrl;
  }

  console.log("[Proxy] ", path);
  console.log("[Base Url]", baseUrl);
  console.log("[apiBaseUrl]", apiBaseUrl);

  const metadata = requestJson.metadata ?? {};
  requestJson.metadata = {
    ...metadata,
    user_id: usernameHash,
  };

  const fetchUrl = `${baseUrl}${path}`;

  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      [authHeaderName]: authValue,
      "anthropic-version":
        req.headers.get("anthropic-version") ||
        serverConfig.anthropicApiVersion ||
        Anthropic.Vision,
      ...(onlineSearch && {
        "X-Shansing-Base-Url": apiBaseUrl,
      }),
    },
    method: req.method,
    body: JSON.stringify(requestJson),
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  // // #1815 try to refuse some request to some models
  // if (serverConfig.customModels && req.body) {
  //   try {
  //     const modelTable = collectModelTable(DEFAULT_MODELS, serverConfig.customModels);
  //     const clonedBody = await req.text();
  //     fetchOptions.body = clonedBody;
  //
  //     const jsonBody = JSON.parse(clonedBody) as { model?: string };
  //
  //     // not undefined and is false
  //     if (!modelTable[jsonBody?.model ?? ""].available) {
  //       return NextResponse.json(
  //         {
  //           error: true,
  //           message: `you are not allowed to use ${jsonBody?.model} model`,
  //         },
  //         {
  //           status: 403,
  //         },
  //       );
  //     }
  //   } catch (e) {
  //     console.error(`[Anthropic] filter`, e);
  //   }
  // }
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
