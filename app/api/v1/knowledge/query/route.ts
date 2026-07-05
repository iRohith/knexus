import { proxyBackendJson } from "@/lib/backend-proxy";

export async function POST(request: Request) {
  const body = await request.text();
  return proxyBackendJson("/api/v1/knowledge/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
