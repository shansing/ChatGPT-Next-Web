import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "../config/server";
import {
  DEFAULT_MODELS,
  OPENAI_BASE_URL,
  GEMINI_BASE_URL,
  ServiceProvider,
} from "../constant";
import { isModelAvailableInServer } from "../utils/model";
import { makeAzurePath } from "../azure";
import { hashUsername } from "@/app/api/shansing";

const serverConfig = getServerSideConfig();

export async function requestOpenai(
  req: NextRequest,
  requestJson: any,
  username: string,
) {
  const controller = new AbortController();

  var authValue,
    authHeaderName = "";
  if (serverConfig.isAzure) {
    authValue =
      req.headers
        .get("Authorization")
        ?.trim()
        .replaceAll("Bearer ", "")
        .trim() ?? "";

    authHeaderName = "api-key";
  } else {
    authValue = req.headers.get("Authorization") ?? "";
    authHeaderName = "Authorization";
  }

  let path = `${req.nextUrl.pathname}${req.nextUrl.search}`.replaceAll(
    "/api/openai/",
    "",
  );

  let baseUrl =
    serverConfig.azureUrl || serverConfig.baseUrl || OPENAI_BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  const apiBaseUrl = baseUrl;
  const onlineSearch = req.headers.get("X-Shansing-Online-Search") == "true";
  if (onlineSearch) {
    baseUrl = serverConfig.shansingOnlineSearchUrl;
  }

  // console.log("[Proxy Path]<" + username + ">", path);
  console.log("[Base Url]<" + username + ">", baseUrl, "(" + apiBaseUrl + ")");

  requestJson.user = hashUsername(username);

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  if (serverConfig.isAzure) {
    if (!serverConfig.azureApiVersion) {
      return NextResponse.json({
        error: true,
        message: `missing AZURE_API_VERSION in server env vars`,
      });
    }
    path = makeAzurePath(path, serverConfig.azureApiVersion);
  }

  const fetchUrl = `${baseUrl}/${path}`;
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      [authHeaderName]: authValue,
      ...(serverConfig.openaiOrgId && {
        "OpenAI-Organization": serverConfig.openaiOrgId,
      }),
      ...(onlineSearch && {
        "X-Shansing-Base-Url": apiBaseUrl,
      }),
    },
    method: req.method,
    body: JSON.stringify(requestJson),
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  // #1815 try to refuse gpt4 request
  // if (serverConfig.customModels && req.body) {
  //   try {
  //     const clonedBody = await req.text();
  //     fetchOptions.body = clonedBody;
  //
  //     const jsonBody = JSON.parse(clonedBody) as { model?: string };
  //
  //     // not undefined and is false
  //     if (
  //       isModelAvailableInServer(
  //         serverConfig.customModels,
  //         jsonBody?.model as string,
  //         ServiceProvider.OpenAI as string,
  //       ) ||
  //       isModelAvailableInServer(
  //         serverConfig.customModels,
  //         jsonBody?.model as string,
  //         ServiceProvider.Azure as string,
  //       )
  //     ) {
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
  //     console.error("[OpenAI] gpt4 filter", e);
  //   }
  // }

  try {
    const res = await fetch(fetchUrl, fetchOptions);

    // Extract the OpenAI-Organization header from the response
    const openaiOrganizationHeader = res.headers.get("OpenAI-Organization");

    // Check if serverConfig.openaiOrgId is defined and not an empty string
    // if (serverConfig.openaiOrgId && serverConfig.openaiOrgId.trim() !== "") {
    //   // If openaiOrganizationHeader is present, log it; otherwise, log that the header is not present
    //   console.log("[Org ID]", openaiOrganizationHeader);
    // } else {
    //   console.log("[Org ID] is not set up.");
    // }

    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    // Conditionally delete the OpenAI-Organization header from the response if [Org ID] is undefined or empty (not setup in ENV)
    // Also, this is to prevent the header from being sent to the client
    if (!serverConfig.openaiOrgId || serverConfig.openaiOrgId.trim() === "") {
      newHeaders.delete("OpenAI-Organization");
    }

    // The latest version of the OpenAI API forced the content-encoding to be "br" in json response
    // So if the streaming is disabled, we need to remove the content-encoding header
    // Because Vercel uses gzip to compress the response, if we don't remove the content-encoding header
    // The browser will try to decode the response with brotli and fail
    newHeaders.delete("content-encoding");

    newHeaders.delete("set-cookie");
    newHeaders.delete("alt-svc");
    newHeaders.delete("strict-transport-security");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requestCompatibleOpenai(
  req: NextRequest,
  requestJson: any,
  username: string,
  baseUrl: string,
) {
  const controller = new AbortController();

  var authValue = req.headers.get("Authorization") ?? "",
    authHeaderName = "Authorization";

  let path = `${req.nextUrl.pathname}${req.nextUrl.search}`.replaceAll(
    "/api/alibaba/",
    "",
  );

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  const apiBaseUrl = baseUrl;
  const onlineSearch = req.headers.get("X-Shansing-Online-Search") == "true";
  if (onlineSearch) {
    baseUrl = serverConfig.shansingOnlineSearchUrl;
  }

  console.log("[Base Url]<" + username + ">", baseUrl, "(" + apiBaseUrl + ")");

  requestJson.user = hashUsername(username);
  // console.log("requestBody", requestBody)

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  const fetchUrl = `${baseUrl}/${path}`;

  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      [authHeaderName]: authValue,
      ...(onlineSearch && {
        "X-Shansing-Base-Url": apiBaseUrl,
      }),
    },
    method: req.method,
    body: JSON.stringify(requestJson),
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  try {
    // console.log("[fetchUrl]", fetchUrl);
    const res = await fetch(fetchUrl, fetchOptions);

    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    // The latest version of the OpenAI API forced the content-encoding to be "br" in json response
    // So if the streaming is disabled, we need to remove the content-encoding header
    // Because Vercel uses gzip to compress the response, if we don't remove the content-encoding header
    // The browser will try to decode the response with brotli and fail
    newHeaders.delete("content-encoding");

    newHeaders.delete("set-cookie");
    newHeaders.delete("alt-svc");
    newHeaders.delete("strict-transport-security");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requestCompatibleOpenaiUploadFile(
  req: NextRequest,
  baseUrl: string,
  username: string,
) {
  const controller = new AbortController();

  var authValue = req.headers.get("Authorization") ?? "",
    authHeaderName = "Authorization";

  let path = `${req.nextUrl.pathname}`.replaceAll("/api/alibaba/", ""); //${req.nextUrl.search}

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  console.log("[Base Url]<" + username + ">", baseUrl);

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  const fetchUrl = `${baseUrl}/${path}`;
  // const formData: FormData = await req.formData()
  // console.log("formData", formData)
  const fetchOptions: RequestInit = {
    headers: {
      // "Content-Type": "multipart/form-data",
      "Content-Type": req.headers.get("Content-Type") ?? "",
      "Cache-Control": "no-store",
      [authHeaderName]: authValue,
    },
    method: req.method,
    // body: formData,
    body: req.body,
    redirect: "follow",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  try {
    // console.log("[fetchUrl]", fetchUrl);
    const res = await fetch(fetchUrl, fetchOptions);

    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    // The latest version of the OpenAI API forced the content-encoding to be "br" in json response
    // So if the streaming is disabled, we need to remove the content-encoding header
    // Because Vercel uses gzip to compress the response, if we don't remove the content-encoding header
    // The browser will try to decode the response with brotli and fail
    // newHeaders.delete("content-encoding");

    newHeaders.delete("set-cookie");
    newHeaders.delete("alt-svc");
    newHeaders.delete("strict-transport-security");

    // console.log("body", await res.clone().json());
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
