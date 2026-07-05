import { proxyBackendJson } from "@/lib/backend-proxy";

export async function POST(request: Request) {
  const text = await request.text();
  return proxyBackendJson("/api/v1/indexing/jobs/trigger-bulk-ingestion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: text || undefined,
  });
}
