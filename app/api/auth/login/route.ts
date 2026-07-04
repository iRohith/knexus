import { NextResponse } from "next/server";

import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_MAX_AGE,
  AUTH_TOKEN_COOKIE,
  createAuthSession,
} from "@/lib/auth-session";
import { BACKEND_URL } from "@/lib/api-client";
import { appUsers } from "@/lib/users";

export async function POST(request: Request) {
  const body = (await request.json()) as { userId?: string; password?: string };
  const user = appUsers.find((appUser) => appUser.id === body.userId);

  if (!user || !body.password) {
    return NextResponse.json({ message: "Invalid user or password." }, { status: 400 });
  }

  const authResponse = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: body.password }),
    cache: "no-store",
  });

  if (!authResponse.ok) {
    return NextResponse.json(
      { message: "Invalid password or failed to login." },
      { status: authResponse.status },
    );
  }

  const authData = (await authResponse.json()) as { accessToken?: string };
  if (!authData.accessToken) {
    return NextResponse.json(
      { message: "Login response did not include a token." },
      { status: 502 },
    );
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(AUTH_TOKEN_COOKIE, authData.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: AUTH_SESSION_MAX_AGE,
  });
  response.cookies.set(AUTH_SESSION_COOKIE, await createAuthSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: AUTH_SESSION_MAX_AGE,
  });

  return response;
}
