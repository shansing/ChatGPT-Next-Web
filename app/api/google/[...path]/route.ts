import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../auth";
import { getServerSideConfig } from "@/app/config/server";
import { GEMINI_BASE_URL, Google, ModelProvider } from "@/app/constant";
import {
  getUsernameFromHttpBasicAuth,
  hashUsername,
  parseUsageObj,
  pay,
  readUserQuota,
} from "@/app/api/shansing";

async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  // console.log("[Google Route] params ", params);

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

  const controller = new AbortController();

  //to do forbidden route?

  const serverConfig = getServerSideConfig();
  const config = serverConfig;

  let baseUrl = serverConfig.googleUrl || GEMINI_BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  let path = `${req.nextUrl.pathname}`.replaceAll("/api/google/", "");

  const apiBaseUrl = baseUrl;
  const onlineSearch = req.headers.get("X-Shansing-Online-Search") == "true";
  if (onlineSearch) {
    baseUrl = serverConfig.shansingOnlineSearchUrl;
  }

  // console.log("[Proxy Path]<" + username + ">", path);
  console.log("[Base Url]<" + username + ">", baseUrl, "(" + apiBaseUrl + ")");

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

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
  let modelGuess = path.split("/")?.slice(2).join("/");
  if (modelGuess == null || modelGuess.includes("/")) {
    return NextResponse.json(
      {
        error: true,
        msg: "[We:oh AI] Unable to match model",
      },
      {
        status: 401,
      },
    );
  }
  modelGuess = modelGuess.split(":")[0];

  const modelChoice = config.shansingModelChoices.find(
    (choice) => modelGuess === choice.model,
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
  console.log("[Google]<" + username + "> using model " + modelChoice.model);

  const authResult = auth(req, ModelProvider.GeminiPro, username);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  const bearToken = req.headers.get("Authorization") ?? "";
  const token = bearToken.trim().replaceAll("Bearer ", "").trim();

  const key = token ? token : serverConfig.googleApiKey;

  if (!key) {
    return NextResponse.json(
      {
        error: true,
        message: `missing GOOGLE_API_KEY in server env vars`,
      },
      {
        status: 401,
      },
    );
  }

  const fetchUrl = `${baseUrl}/${path}?key=${key}${
    req?.nextUrl?.searchParams?.get("alt") == "sse" ? "&alt=sse" : ""
  }`;
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(onlineSearch && {
        "X-Shansing-Base-Url": apiBaseUrl,
      }),
    },
    method: req.method,
    body: req.body,
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  try {
    const response = await fetch(fetchUrl, fetchOptions);

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
        const usageMetadata = parseUsageObj(
          responseBody,
          "usageMetadata",
          false,
        );
        console.log(
          "[Google Usage]<" + username + ">",
          JSON.stringify(usageMetadata),
          JSON.stringify({
            firstPromptTokenNumber,
            firstCompletionTokenNumber,
            searchCount,
            newsCount,
            crawlerCount,
          }),
        );
        if (
          usageMetadata &&
          usageMetadata.promptTokenCount != null &&
          usageMetadata.candidatesTokenCount != null
        ) {
          return {
            promptTokenNumber: usageMetadata.promptTokenCount as number,
            completionTokenNumber: usageMetadata.candidatesTokenCount as number,
          };
        }
        console.warn(
          "[ATTENTION][google] unable to find usage, username=" +
            username +
            ", url=" +
            req.url +
            ", responseBody=" +
            responseBody,
        );
      })
      .then((obj) => {
        if (obj) {
          const prompt = obj.promptTokenNumber + firstPromptTokenNumber;
          const completion =
            obj.completionTokenNumber + firstCompletionTokenNumber;
          return pay(
            username,
            modelChoice,
            prompt <= 128_000 ? prompt : prompt * 2,
            completion <= 128_000 ? completion : completion * 2,
            config.shansingOnlineSearchSearchPrice
              .mul(searchCount + newsCount)
              .plus(config.shansingOnlineSearchCrawlerPrice.mul(crawlerCount)),
          );
        }
      });

    // to prevent browser prompt for credentials
    const newHeaders = new Headers(response.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    newHeaders.delete("set-cookie");
    newHeaders.delete("alt-svc");
    newHeaders.delete("strict-transport-security");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const GET = handle;
export const POST = handle;

// export const runtime = "edge";
export const preferredRegion = [
  "bom1",
  "cle1",
  "cpt1",
  "gru1",
  "hnd1",
  "iad1",
  "icn1",
  "kix1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
];
