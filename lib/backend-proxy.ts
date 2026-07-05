import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { BACKEND_URL } from "@/lib/api-client";
import {
  AUTH_REFRESH_TOKEN_COOKIE,
  AUTH_SESSION_MAX_AGE,
  AUTH_TOKEN_COOKIE,
} from "@/lib/auth-session";

type BackendFetchOptions = RequestInit & {
  retryOnUnauthorized?: boolean;
};

function jwtExpiresSoon(token: string, skewSeconds = 60) {
  const [, payload] = token.split(".");
  if (!payload) return true;

  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const json = JSON.parse(
      Buffer.from(normalized, "base64").toString("utf8"),
    ) as { exp?: number };
    if (!json.exp) return true;
    return json.exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}

async function refreshAccessToken() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(AUTH_REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return null;

  const response = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;

  const data = (await response.json()) as { accessToken?: string; refreshToken?: string };
  if (!data.accessToken || !data.refreshToken) return null;

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

async function readAccessToken() {
  return (await cookies()).get(AUTH_TOKEN_COOKIE)?.value ?? null;
}

export async function backendFetch(path: string, options: BackendFetchOptions = {}) {
  let token = await readAccessToken();
  if (!token) return { response: null, refreshedTokens: null };

  let refreshedTokens: { accessToken: string; refreshToken: string } | null = null;
  if (jwtExpiresSoon(token)) {
    refreshedTokens = await refreshAccessToken();
    if (refreshedTokens) token = refreshedTokens.accessToken;
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  let response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (response.status === 401 && options.retryOnUnauthorized !== false) {
    refreshedTokens = await refreshAccessToken();
    if (refreshedTokens) {
      headers.set("Authorization", `Bearer ${refreshedTokens.accessToken}`);
      response = await fetch(`${BACKEND_URL}${path}`, {
        ...options,
        headers,
        cache: "no-store",
      });
    }
  }

  return { response, refreshedTokens };
}

export async function proxyBackendJson(path: string, options: BackendFetchOptions = {}) {
  const { response, refreshedTokens } = await backendFetch(path, options);
  if (!response) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });

  const data = await response.json().catch(() => null);
  const nextResponse = NextResponse.json(data, { status: response.status });
  if (refreshedTokens) {
    const secure = process.env.NODE_ENV === "production";
    nextResponse.cookies.set(AUTH_TOKEN_COOKIE, refreshedTokens.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: AUTH_SESSION_MAX_AGE,
    });
    nextResponse.cookies.set(AUTH_REFRESH_TOKEN_COOKIE, refreshedTokens.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: AUTH_SESSION_MAX_AGE,
    });
  }

  return nextResponse;
}
