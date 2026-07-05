import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  return proxyBackendJson(`/api/v1/indexing/jobs${query ? `?${query}` : ""}`);
}
