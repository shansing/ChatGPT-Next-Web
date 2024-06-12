import { NextRequest, NextResponse } from "next/server";
import {
  changePassword,
  getUsernameFromHttpBasicAuth,
} from "@/app/api/shansing";

async function handle(req: NextRequest) {
  const username = getUsernameFromHttpBasicAuth(req);
  if (!username) {
    return NextResponse.json({
      error: "http basic auth is needed",
      username,
    });
  }
  const requestJson = await req.json();
  return changePassword(username, requestJson.newPassword)
    .then(() =>
      NextResponse.json({
        success: true,
        username,
      }),
    )
    .catch((e) => {
      NextResponse.json({
        error: e.message,
        username,
      });
    });
}

// export const GET = handle;
export const POST = handle;

// export const runtime = "edge";
