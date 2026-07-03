import type { SourceApp } from "@/app/admin/activity-state";
import type {
  AnswerCitation,
  CitationRole,
  CogneeQueryPayload,
  CogneeRecallEntry,
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
  return sourceApps.has(value as SourceApp) ? (value as SourceApp) : null;
}

function entryText(entry: CogneeRecallEntry) {
  return entry.text ?? entry.content ?? "";
}

function matchField(text: string, label: string) {
  const pattern = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
  return text.match(pattern)?.[1]?.trim();
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
  const graphCompletion = payload.raw?.recall?.find(
    (entry) => entry.kind === "graph_completion" || entry.search_type === "GRAPH_COMPLETION",
  );
  return (
    entryText(graphCompletion ?? payload.raw?.recall?.[0] ?? { source: "graph" }) || payload.answer
  );
}

function titleFromSource(sourceEventId: string, content: string) {
  const clean = content.replace(/\s+/g, " ").trim();
  const title = clean.length > 80 ? `${clean.slice(0, 77)}...` : clean;
  return title || sourceEventId;
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
