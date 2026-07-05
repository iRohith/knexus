import { normalizeCogneeGraphData } from "@/lib/cognee-adapter";
import type { CogneeGraphData, JsonValue, KnowledgeGraph } from "@/lib/knowledge-graph-types";

export type CogneeGraphSnapshot = {
  snapshotId: string;
  source: "cognee-cloud";
  fetchedAt: string;
  datasetName: string;
  datasetId: string;
  dataset?: Record<string, JsonValue>;
  sourceGraphUrl?: string;
  fullGraph?: {
    nodeCount: number;
    edgeCount: number;
  };
  renderedGraph?: {
    nodeCount: number;
    edgeCount: number;
    selection: string;
    maxNodes: number;
    maxEdges: number;
  };
  graphData: CogneeGraphData;
  schemaInventory?: JsonValue;
  readonly: true;
};

export const cogneeGraphSnapshotUrl = "/cognee/graph-subset.json";

let snapshotPromise: Promise<CogneeGraphSnapshot | null> | null = null;
const defaultMaxRenderNodes = 650;
const defaultMaxRenderEdges = 1800;

export async function loadCogneeGraphSnapshot() {
  if (!snapshotPromise) {
    snapshotPromise = fetch(cogneeGraphSnapshotUrl, { cache: "no-store" })
      .then((response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Unable to load Cognee graph: ${response.status}`);
        return response.json() as Promise<CogneeGraphSnapshot>;
      })
      .catch((error) => {
        console.warn(error);
        return null;
      });
  }
  return snapshotPromise;
}

export function resetCogneeGraphSnapshotCache() {
  snapshotPromise = null;
}

function renderableGraphData(graphData: CogneeGraphData, maxNodes: number, maxEdges: number) {
  if (graphData.nodes.length <= maxNodes) return graphData;

  const degree = new Map<string, number>();
  graphData.nodes.forEach((node) => degree.set(String(node.id), 0));
  graphData.edges.forEach((edge) => {
    const source = String(edge.source);
    const target = String(edge.target);
    degree.set(source, (degree.get(source) ?? 0) + 1);
    degree.set(target, (degree.get(target) ?? 0) + 1);
  });

  const keptNodes = [...graphData.nodes]
    .sort((a, b) => (degree.get(String(b.id)) ?? 0) - (degree.get(String(a.id)) ?? 0))
    .slice(0, maxNodes);
  const keptIds = new Set(keptNodes.map((node) => String(node.id)));
  const keptEdges = graphData.edges
    .filter((edge) => keptIds.has(String(edge.source)) && keptIds.has(String(edge.target)))
    .slice(0, maxEdges);

  return { nodes: keptNodes, edges: keptEdges };
}

export async function loadCogneeKnowledgeGraph(
  options: { maxNodes?: number; maxEdges?: number } = {},
): Promise<KnowledgeGraph | null> {
  const snapshot = await loadCogneeGraphSnapshot();
  if (!snapshot?.graphData?.nodes?.length) return null;
  const graphData = renderableGraphData(
    snapshot.graphData,
    options.maxNodes ?? defaultMaxRenderNodes,
    options.maxEdges ?? defaultMaxRenderEdges,
  );

  const graph = normalizeCogneeGraphData(graphData, {
    datasetName: snapshot.datasetName,
    datasetId: snapshot.datasetId,
    generatedAt: Date.parse(snapshot.fetchedAt) || Date.now(),
  });
  graph.nodes.unshift({
    id: "cognee-snapshot-summary",
    label: `${snapshot.datasetName}`,
    type: "answer",
    text: `Saved Cognee graph snapshot fetched ${snapshot.fetchedAt}. The full source graph contains ${(snapshot.fullGraph?.nodeCount ?? snapshot.graphData.nodes.length).toLocaleString("en-US")} nodes and ${(snapshot.fullGraph?.edgeCount ?? snapshot.graphData.edges.length).toLocaleString("en-US")} relationships. This view uses the saved subset for browser performance.`,
    sourceApps: [],
    sourceEventIds: [],
    sourceUrl: "/",
    metadata: {
      snapshotId: snapshot.snapshotId,
      datasetName: snapshot.datasetName,
      datasetId: snapshot.datasetId,
      fetchedAt: snapshot.fetchedAt,
      sourceGraphUrl: snapshot.sourceGraphUrl ?? null,
      totalNodes: snapshot.fullGraph?.nodeCount ?? snapshot.graphData.nodes.length,
      totalEdges: snapshot.fullGraph?.edgeCount ?? snapshot.graphData.edges.length,
      renderedNodes: snapshot.renderedGraph?.nodeCount ?? graphData.nodes.length,
      renderedEdges: snapshot.renderedGraph?.edgeCount ?? graphData.edges.length,
    },
    cognee: {
      source: "graph",
      kind: "snapshot",
      datasetId: snapshot.datasetId,
      datasetName: snapshot.datasetName,
    },
  });
  graph.edges.unshift(
    ...graph.nodes.slice(1).map((node) => ({
      id: `cognee-snapshot-summary-${node.id}`,
      source: "cognee-snapshot-summary",
      target: node.id,
      label: "contains",
      type: "related" as const,
      sourceEventIds: [],
    })),
  );
  return graph;
}
