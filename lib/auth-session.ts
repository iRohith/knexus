import { appUsers } from "@/lib/users";

export const AUTH_TOKEN_COOKIE = "auth-token";
export const AUTH_SESSION_COOKIE = "auth-session";
export const AUTH_SESSION_MAX_AGE = 60 * 60 * 24;

const encoder = new TextEncoder();

function getSessionSecret() {
  return (
    process.env.AUTH_SESSION_SECRET || process.env.NEXTAUTH_SECRET || "local-dev-session-secret"
  );
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function createSignature(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }

  return diff === 0;
}

export async function createAuthSession(userId: string) {
  const expiresAt = Date.now() + AUTH_SESSION_MAX_AGE * 1000;
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({ userId, expiresAt })));
  const signature = await createSignature(payload);

  return `${payload}.${signature}`;
}

export async function verifyAuthSession(session: string | undefined) {
  if (!session) return null;

  const [payload, signature] = session.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = await createSignature(payload);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as {
      userId?: string;
      expiresAt?: number;
    };

    if (!data.userId || !data.expiresAt || data.expiresAt < Date.now()) {
      return null;
    }

    return appUsers.find((user) => user.id === data.userId) ?? null;
  } catch {
    return null;
  }
}
