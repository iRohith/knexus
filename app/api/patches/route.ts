import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { BACKEND_URL } from "@/lib/api-client";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth-session";

async function authHeaders() {
  const token = (await cookies()).get(AUTH_TOKEN_COOKIE)?.value;
  if (!token) return null;

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function GET(request: Request) {
  const headers = await authHeaders();
  if (!headers) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const backendUrl = new URL(`${BACKEND_URL}/api/v1/patches`);
  if (since) backendUrl.searchParams.set("since", since);

  const response = await fetch(backendUrl, {
    headers,
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  return NextResponse.json(data, { status: response.status });
}

export async function POST(request: Request) {
  const headers = await authHeaders();
  if (!headers) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const response = await fetch(`${BACKEND_URL}/api/v1/patches/batches`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  return NextResponse.json(data, { status: response.status });
}
