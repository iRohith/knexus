import { NextResponse } from "next/server";

import { AUTH_REFRESH_TOKEN_COOKIE, AUTH_SESSION_COOKIE, AUTH_TOKEN_COOKIE } from "@/lib/auth-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.delete(AUTH_TOKEN_COOKIE);
  response.cookies.delete(AUTH_REFRESH_TOKEN_COOKIE);
  response.cookies.delete(AUTH_SESSION_COOKIE);

  return response;
}
