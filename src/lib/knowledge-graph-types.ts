import type { SourceApp } from "@/app/admin/activity-state";

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type CogneeSearchType =
  | "SUMMARIES"
  | "CHUNKS"
  | "RAG_COMPLETION"
  | "HYBRID_COMPLETION"
  | "TRIPLET_COMPLETION"
  | "GRAPH_COMPLETION"
  | "GRAPH_COMPLETION_DECOMPOSITION"
  | "GRAPH_SUMMARY_COMPLETION"
  | "CYPHER"
  | "NATURAL_LANGUAGE"
  | "GRAPH_COMPLETION_COT"
  | "GRAPH_COMPLETION_CONTEXT_EXTENSION"
  | "FEELING_LUCKY"
  | "TEMPORAL"
  | "CODING_RULES"
  | "CHUNKS_LEXICAL"
  | "AGENTIC_COMPLETION";

export type CogneeRecallSource =
  "session" | "trace" | "graph_context" | "session_context" | "graph";

export type CogneeRecallEntry = {
  source: CogneeRecallSource;
  kind?: string;
  search_type?: CogneeSearchType | string;
  text?: string;
  content?: string;
  context_profile?: string;
  score?: number | null;
  dataset_id?: string | null;
  dataset_name?: string | null;
  metadata?: Record<string, JsonValue>;
  raw?: JsonValue;
  structured?: JsonValue;
};

export type CogneeQueryPayload = {
  queryId: string;
  question: string;
  answer: string;
  responseTimeMs: number | null;
  timestamp: string;
  source: "cognee-cloud" | "cognee" | "corpus";
  datasetName?: string;
  raw?: {
    remember?: JsonValue;
    recall?: CogneeRecallEntry[];
    graphData?: CogneeGraphData;
  };
};

export type CogneeGraphNode = {
  id: string;
  label?: string;
  type?: string;
  properties?: Record<string, JsonValue>;
};

export type CogneeGraphEdge = {
  id?: string;
  source: string;
  target: string;
  label?: string;
  properties?: Record<string, JsonValue>;
};

export type CogneeGraphData = {
  nodes: CogneeGraphNode[];
  edges: CogneeGraphEdge[];
};

// ---------------------------------------------------------------------------
// Graph data model
// ---------------------------------------------------------------------------

export type KnowledgeNodeType = "answer" | "cognee_result" | "evidence" | "graph_node";

export type KnowledgeEdgeType = "returned" | "supported_by" | "related";

export type KnowledgeNode = {
  id: string;
  label: string;
  type: KnowledgeNodeType;
  text: string;
  primarySourceApp?: SourceApp;
  sourceApps: SourceApp[];
  sourceEventIds: string[];
  sourceUrl: string;
  metadata: Record<string, JsonValue>;
  cognee?: {
    source: CogneeRecallSource;
    kind?: string;
    searchType?: string;
    datasetId?: string | null;
    datasetName?: string | null;
    raw?: JsonValue;
    structured?: JsonValue;
  };
};

export type KnowledgeEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  type: KnowledgeEdgeType;
  sourceEventIds: string[];
};

export type KnowledgeGraph = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  queryId?: string;
  answerId?: string;
  generatedAt: number;
  source: "corpus" | "cognee";
};

// ---------------------------------------------------------------------------
// Intelligence / Q&A model
// ---------------------------------------------------------------------------

export type CitationRole =
  "supports" | "documents" | "implements" | "requested" | "context" | "decided" | "tracks";

export type AnswerCitation = {
  id: string;
  nodeId: string;
  edgeId?: string;
  sourceApp: SourceApp;
  title: string;
  snippet: string;
  sourceEventId: string;
  sourceUrl: string;
  role: CitationRole;
};

export type ReasoningStep = {
  id: string;
  stepNumber: number;
  nodeId: string;
  title: string;
  sourceApp: SourceApp;
  sourceEventId: string;
  sourceUrl: string;
  relationship: string;
  snippet: string;
  role: CitationRole;
};

export type IntelligenceAnswer = {
  id: string;
  queryKey: string;
  question: string;
  answer: string;
  createdAt: number;
  source: "corpus" | "cognee";
  responseTimeMs: number;
  citations: AnswerCitation[];
  cognee?: {
    datasetName?: string;
    recall: CogneeRecallEntry[];
    raw?: CogneeQueryPayload["raw"];
  };
  graph: KnowledgeGraph;
  highlightedNodeIds: string[];
  highlightedEdgeIds: string[];
  reasoningSteps: ReasoningStep[];
};
