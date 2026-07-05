import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyBackendJson(`/api/v1/indexing/jobs/${id}`);
}
