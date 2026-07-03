import { corpOsActivityEvents } from "@/lib/generated-corp-os-data";
import type { KnowledgeGraph, KnowledgeNode } from "@/lib/knowledge-graph-types";

const datasetName = "redwood-corp-os-corpus";

function eventLabel(title: string) {
  const clean = title.replace(/\s+/g, " ").trim();
  return clean.length > 64 ? `${clean.slice(0, 61)}...` : clean;
}

function eventText(body: string) {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length > 420 ? `${clean.slice(0, 417)}...` : clean;
}

export function buildCorpusGraph(): KnowledgeGraph {
  const selectedEvents = [...corpOsActivityEvents]
    .sort((a, b) => b.occurredAt - a.occurredAt)
    .filter(
      (event, index, events) =>
        events.findIndex((item) => item.sourceApp === event.sourceApp) === index,
    )
    .slice(0, 9);

  const answerNode: KnowledgeNode = {
    id: "corpus-answer-root",
    label: "Redwood source corpus",
    type: "answer",
    text: "The graph starts from normalized Redwood activity records and connects the answer surface to source text from each production app replica.",
    sourceApps: [],
    sourceEventIds: [],
    sourceUrl: "/intelligence",
    metadata: {
      kind: "graph_completion",
      searchType: "GRAPH_COMPLETION",
      datasetName,
    },
    cognee: {
      source: "graph",
      kind: "graph_completion",
      searchType: "GRAPH_COMPLETION",
      datasetName,
    },
  };

  return {
    nodes: [
      answerNode,
      ...selectedEvents.map((event, index) => ({
        id: `corpus-node-${event.id}`,
        label: eventLabel(event.title),
        type: "evidence" as const,
        text: [
          `Source event id: ${event.id}`,
          `Source app: ${event.sourceApp}`,
          `Source URL: ${event.sourceUrl}`,
          `Actor: ${
            typeof event.metadata.actorName === "string" ? event.metadata.actorName : event.actorId
          }`,
          `Occurred at: ${new Date(event.occurredAt).toISOString()}`,
          "Content:",
          eventText(event.body),
        ].join("\n"),
        primarySourceApp: event.sourceApp,
        sourceApps: [event.sourceApp],
        sourceEventIds: [event.id],
        sourceUrl: event.sourceUrl,
        metadata: {
          kind: "chunk",
          searchType: "CHUNKS",
          datasetName,
          sourcePath:
            typeof event.metadata.sourcePath === "string" ? event.metadata.sourcePath : null,
          chunk_index: index,
        },
        cognee: {
          source: "graph" as const,
          kind: "chunk",
          searchType: "CHUNKS",
          datasetName,
        },
      })),
    ],
    edges: selectedEvents.map((event) => ({
      id: `corpus-edge-${event.id}`,
      source: answerNode.id,
      target: `corpus-node-${event.id}`,
      label: "supported by",
      type: "supported_by",
      sourceEventIds: [event.id],
    })),
    generatedAt: Date.now(),
    source: "corpus",
  };
}
