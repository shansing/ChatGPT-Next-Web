import { NextRequest, NextResponse } from "next/server";
import {
  changePassword,
  getUsernameFromHttpBasicAuth,
} from "@/app/api/shansing";

async function handle(req: NextRequest) {
  const username = getUsernameFromHttpBasicAuth(req);
  try {
    if (!username) {
      throw Error("http basic auth is needed");
    }
    const requestJson = await req.json();
    await changePassword(username, requestJson.newPassword);
    return NextResponse.json({
      success: true,
      username,
    });
  } catch (e) {
    return NextResponse.json({
      // @ts-ignore
      error: e?.message,
      username,
    });
  }
}

// export const GET = handle;
export const POST = handle;
