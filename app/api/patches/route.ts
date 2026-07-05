import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return proxyBackendJson(`/api/v1/patches${query}`);
}

export async function POST(request: Request) {
  const body = await request.json();
  return proxyBackendJson("/api/v1/patches/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
