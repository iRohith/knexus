import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.COGNEE_BASE_URL;
  const apiKey = process.env.COGNEE_API_KEY;
  // If no dataset name provided, fallback to the one in manifest or default
  const datasetName = process.env.COGNEE_DATASET_NAME ?? "knexus-activity";

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: "Missing cognee credentials" }, { status: 500 });
  }

  try {
    // Try to resolve dataset ID first
    const datasetsRes = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/datasets`, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    });

    if (!datasetsRes.ok) throw new Error("Failed to fetch datasets");
    const datasets = await datasetsRes.json();
    const dataset = (datasets as { id: string; name: string }[]).find(
      (d) => d.name === datasetName,
    );
    if (!dataset) throw new Error("Dataset not found");

    const datasetId = dataset.id;

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/datasets/${datasetId}/graph`, {
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch from cognee" }, { status: res.status });
    }

    const graph = await res.json();

    // Wrap to match CogneeGraphSnapshot format
    const snapshot = {
      snapshotId: `live-${Date.now()}`,
      source: "cognee-cloud",
      fetchedAt: new Date().toISOString(),
      datasetName: datasetName,
      datasetId: datasetId,
      graphData: graph,
      readonly: true,
    };

    return NextResponse.json(snapshot);
  } catch (err) {
    console.error("Error fetching live cognee graph:", err);
    return NextResponse.json({ error: "Failed to fetch live graph" }, { status: 500 });
  }
}
