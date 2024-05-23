import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../auth";
import { getServerSideConfig } from "@/app/config/server";
import { GEMINI_BASE_URL, Google, ModelProvider } from "@/app/constant";
import {
  getUsernameFromHttpBasicAuth,
  pay,
  readUserQuota,
} from "@/app/api/shansing";

async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[Google Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const controller = new AbortController();

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

  console.log("[Proxy] ", path);
  console.log("[Base Url]", baseUrl);

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

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
  const modelGuess = path.split("/")?.slice(2).join("/");
  if (modelGuess == null || modelGuess.includes("/")) {
    return NextResponse.json(
      {
        error: true,
        msg: "[Shansing He2per] Unable to match model",
      },
      {
        status: 401,
      },
    );
  }
  const modelChoice = config.shansingModelChoices.find((choice) =>
    modelGuess.includes(choice.model),
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

  const authResult = auth(req, ModelProvider.GeminiPro);
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

  const fetchUrl = `${baseUrl}/${path}?key=${key}`;
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
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
    const res = await fetch(fetchUrl, fetchOptions);

    res
      .clone()
      .text()
      .then((responseBody) => {
        //console.log("[responseBody]" + responseBody)
        const usageIndex = responseBody.lastIndexOf('"usageMetadata"');
        if (usageIndex !== -1) {
          const openBracket = responseBody.indexOf("{", usageIndex);
          const closeBracket = responseBody.indexOf("}", openBracket);
          if (openBracket !== -1 && closeBracket !== -1) {
            const jsonString = responseBody.substring(
              openBracket,
              closeBracket + 1,
            );
            console.log("[usage][google]", jsonString);
            const jsonData = JSON.parse(jsonString);
            if (
              jsonData.promptTokenCount !== undefined &&
              jsonData.candidatesTokenCount !== undefined
            ) {
              return {
                promptTokenNumber: jsonData.promptTokenCount as number,
                completionTokenNumber: jsonData.totalTokenCount as number,
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
            obj.promptTokenNumber <= 128_000
              ? obj.promptTokenNumber
              : obj.promptTokenNumber * 2,
            obj.completionTokenNumber <= 128_000
              ? obj.completionTokenNumber
              : obj.completionTokenNumber * 2,
          );
        }
      });

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

export const GET = handle;
export const POST = handle;

export const runtime = "edge";
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
