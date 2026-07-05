import { proxyBackendJson } from "@/lib/backend-proxy";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = params.id;

  return proxyBackendJson(`/api/v1/indexing/jobs/${id}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}
