import type { SourceApp } from "@/app/admin/activity-state";
import type {
  AnswerCitation,
  CitationRole,
  CogneeGraphData,
  CogneeGraphEdge,
  CogneeGraphNode,
  CogneeQueryPayload,
  CogneeRecallEntry,
  JsonValue,
  KnowledgeEdge,
  KnowledgeGraph,
  KnowledgeNode,
  ReasoningStep,
} from "@/lib/knowledge-graph-types";

const sourceApps = new Set<SourceApp>([
  "gmail",
  "slack",
  "github",
  "linear",
  "jira",
  "hubspot",
  "google-drive",
  "confluence",
  "fireflies",
]);

function asSourceApp(value: string | undefined): SourceApp | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (normalized === "google-drive" || normalized === "drive") return "google-drive";
  return sourceApps.has(normalized as SourceApp) ? (normalized as SourceApp) : null;
}

function entryText(entry: CogneeRecallEntry) {
  return entry.text ?? entry.content ?? "";
}

function matchField(text: string, label: string) {
  const pattern = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
  return text.match(pattern)?.[1]?.trim();
}

function matchFields(text: string, label: string) {
  const pattern = new RegExp(`${label}:\\s*([^\\n]+)`, "gi");
  return [...text.matchAll(pattern)].map((match) => match[1]?.trim()).filter(Boolean);
}

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

function sourceFromEntry(entry: CogneeRecallEntry) {
  const text = entryText(entry);
  const sourceApp = asSourceApp(matchField(text, "Source app")) ?? "confluence";
  const sourceEventId = matchField(text, "Source event id") ?? `${entry.kind ?? "cognee"}-result`;
  const sourceUrl = matchField(text, "Source URL") ?? "/";
  const actor = matchField(text, "Actor");
  const occurredAt = matchField(text, "Occurred at");
  const content = text.split(/Content:\s*/i)[1]?.trim() ?? text;

  return {
    sourceApp,
    sourceEventId,
    sourceUrl,
    actor,
    occurredAt,
    content,
  };
}

function answerText(payload: CogneeQueryPayload) {
  if (payload.answer) return payload.answer;
  const graphCompletion = payload.raw?.recall?.find(
    (entry) => entry.kind === "graph_completion" || entry.search_type === "GRAPH_COMPLETION",
  );
  return entryText(graphCompletion ?? { source: "graph" });
}

function titleFromSource(sourceEventId: string, content: string) {
  const clean = content.replace(/\s+/g, " ").trim();
  const title = clean.length > 80 ? `${clean.slice(0, 77)}...` : clean;
  return title || sourceEventId;
}

function stringValue(value: JsonValue | undefined, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function stringArrayValue(value: JsonValue | undefined) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function sourceAppsFromProperties(properties: Record<string, JsonValue> | undefined) {
  if (!properties) return [];
  const explicit =
    asSourceApp(stringValue(properties.sourceApp)) ??
    asSourceApp(stringValue(properties.source_app));
  if (explicit) return [explicit];
  return stringArrayValue(properties.sourceApps)
    .map((app) => asSourceApp(app))
    .filter((app): app is SourceApp => Boolean(app));
}

function sourceAppsFromNode(node: CogneeGraphNode, properties: Record<string, JsonValue>) {
  const explicit = sourceAppsFromProperties(properties);
  if (explicit.length > 0) return explicit;

  const sourceAppsFromText = [
    ...matchFields(stringValue(properties.text), "Source app"),
    ...matchFields(stringValue(properties.content), "Source app"),
    ...matchFields(stringValue(properties.description), "Source app"),
    stringValue(properties.document_name),
  ]
    .map((app) => asSourceApp(app))
    .filter((app): app is SourceApp => Boolean(app));
  if (sourceAppsFromText.length > 0) return uniqueValues(sourceAppsFromText);

  const labelMatch = asSourceApp(graphNodeLabel(node));
  if (labelMatch) return [labelMatch];

  const nameMatch = asSourceApp(stringValue(properties.name));
  return nameMatch ? [nameMatch] : [];
}

function sourceEventIdsFromProperties(properties: Record<string, JsonValue> | undefined) {
  if (!properties) return [];
  const explicit =
    stringValue(properties.sourceEventId) ||
    stringValue(properties.source_event_id) ||
    stringValue(properties.source_event);
  if (explicit) return [explicit];
  return uniqueValues([
    ...stringArrayValue(properties.sourceEventIds),
    ...matchFields(stringValue(properties.text), "Source event id"),
    ...matchFields(stringValue(properties.content), "Source event id"),
    ...matchFields(stringValue(properties.description), "Source event id"),
  ]);
}

function graphNodeLabel(node: CogneeGraphNode) {
  return (
    node.label ||
    stringValue(node.properties?.name) ||
    stringValue(node.properties?.title) ||
    stringValue(node.properties?.text) ||
    node.id
  );
}

function graphNodeText(node: CogneeGraphNode) {
  return (
    stringValue(node.properties?.description) ||
    stringValue(node.properties?.text) ||
    stringValue(node.properties?.content) ||
    graphNodeLabel(node)
  );
}

function graphSourceUrl(properties: Record<string, JsonValue> | undefined) {
  return (
    stringValue(properties?.sourceUrl) ||
    stringValue(properties?.source_url) ||
    stringValue(properties?.url) ||
    matchField(stringValue(properties?.text), "Source URL") ||
    matchField(stringValue(properties?.content), "Source URL") ||
    matchField(stringValue(properties?.description), "Source URL") ||
    "/"
  );
}

export function normalizeCogneeGraphData(
  graphData: CogneeGraphData,
  options: {
    datasetName?: string;
    datasetId?: string;
    generatedAt?: number;
    queryId?: string;
  } = {},
): KnowledgeGraph {
  const nodes: KnowledgeNode[] = graphData.nodes.map((node) => {
    const properties = node.properties ?? {};
    const sourceApps = sourceAppsFromNode(node, properties);
    const sourceEventIds = sourceEventIdsFromProperties(properties);

    return {
      id: String(node.id),
      label: graphNodeLabel(node),
      type: "graph_node",
      text: graphNodeText(node),
      primarySourceApp: sourceApps[0],
      sourceApps,
      sourceEventIds,
      sourceUrl: graphSourceUrl(properties),
      metadata: {
        ...properties,
        cogneeType: node.type ?? null,
        datasetId: options.datasetId ?? null,
        datasetName: options.datasetName ?? null,
      },
      cognee: {
        source: "graph",
        kind: node.type ?? "graph_node",
        datasetId: options.datasetId,
        datasetName: options.datasetName,
        raw: node,
      },
    };
  });

  const edges: KnowledgeEdge[] = graphData.edges.map((edge: CogneeGraphEdge, index) => ({
    id: edge.id ?? `cognee-edge-${edge.source}-${edge.target}-${index}`,
    source: String(edge.source),
    target: String(edge.target),
    label: edge.label || "related",
    type: "related",
    sourceEventIds: stringArrayValue(edge.properties?.sourceEventIds),
  }));

  return {
    nodes,
    edges,
    queryId: options.queryId,
    generatedAt: options.generatedAt ?? Date.now(),
    source: "cognee",
  };
}

export function normalizeCogneeQueryPayload(payload: CogneeQueryPayload) {
  const recall = payload.raw?.recall ?? [];
  const answer = answerText(payload);
  const answerNodeId = `answer-${payload.queryId}`;
  const nodes: KnowledgeNode[] = [
    {
      id: answerNodeId,
      label: payload.question,
      type: "answer",
      text: answer,
      sourceApps: [],
      sourceEventIds: [],
      sourceUrl: "/intelligence",
      metadata: {
        queryId: payload.queryId,
        datasetName: payload.datasetName ?? null,
        responseTimeMs: payload.responseTimeMs,
      },
      cognee: {
        source: "graph",
        kind: "answer",
        datasetName: payload.datasetName,
      },
    },
  ];
  const edges: KnowledgeEdge[] = [];
  const citations: AnswerCitation[] = [];
  const reasoningSteps: ReasoningStep[] = [];

  recall
    .filter((entry) => entry.kind !== "graph_completion")
    .forEach((entry, index) => {
      const text = entryText(entry);
      if (!text) return;

      const source = sourceFromEntry(entry);
      const nodeId =
        typeof entry.metadata?.chunk_id === "string"
          ? `cognee-chunk-${entry.metadata.chunk_id}`
          : `cognee-result-${payload.queryId}-${index + 1}`;
      const edgeId = `edge-${nodeId}-${answerNodeId}`;
      const title = titleFromSource(source.sourceEventId, source.content);
      const snippet =
        source.content.length > 220 ? `${source.content.slice(0, 217)}...` : source.content;

      nodes.push({
        id: nodeId,
        label: title,
        type: entry.kind === "chunk" ? "evidence" : "cognee_result",
        text,
        primarySourceApp: source.sourceApp,
        sourceApps: [source.sourceApp],
        sourceEventIds: [source.sourceEventId],
        sourceUrl: source.sourceUrl,
        metadata: {
          ...entry.metadata,
          actor: source.actor ?? null,
          occurredAt: source.occurredAt ?? null,
          kind: entry.kind ?? null,
          searchType: entry.search_type ?? null,
          datasetId: entry.dataset_id ?? null,
          datasetName: entry.dataset_name ?? null,
        },
        cognee: {
          source: entry.source,
          kind: entry.kind,
          searchType: entry.search_type,
          datasetId: entry.dataset_id,
          datasetName: entry.dataset_name,
          raw: entry.raw,
          structured: entry.structured,
        },
      });

      edges.push({
        id: edgeId,
        source: answerNodeId,
        target: nodeId,
        label: "supported by",
        type: "supported_by",
        sourceEventIds: [source.sourceEventId],
      });

      citations.push({
        id: `${payload.queryId}-citation-${index + 1}`,
        nodeId,
        edgeId,
        sourceApp: source.sourceApp,
        title,
        snippet,
        sourceEventId: source.sourceEventId,
        sourceUrl: source.sourceUrl,
        role: "supports",
      });

      reasoningSteps.push({
        id: `${payload.queryId}-step-${index + 1}`,
        stepNumber: index + 1,
        nodeId,
        title,
        sourceApp: source.sourceApp,
        sourceEventId: source.sourceEventId,
        sourceUrl: source.sourceUrl,
        relationship: `${entry.search_type ?? "Cognee"} ${entry.kind ?? "result"}`,
        snippet,
        role: "supports" satisfies CitationRole,
      });
    });

  const graph: KnowledgeGraph = {
    nodes,
    edges,
    queryId: payload.queryId,
    answerId: answerNodeId,
    generatedAt: Date.parse(payload.timestamp) || Date.now(),
    source: payload.source === "corpus" ? "corpus" : "cognee",
  };

  return {
    answer,
    citations,
    graph,
    highlightedNodeIds: nodes.map((node) => node.id),
    highlightedEdgeIds: edges.map((edge) => edge.id),
    reasoningSteps,
  };
}
