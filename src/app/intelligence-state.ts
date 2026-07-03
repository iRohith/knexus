"use client";

import { create } from "zustand";

import type { ActivityEvent, SourceApp } from "@/app/admin/activity-state";
import { normalizeCogneeQueryPayload } from "@/lib/cognee-adapter";
import { corpOsActivityEvents } from "@/lib/generated-corp-os-data";
import type {
  CitationRole,
  CogneeQueryPayload,
  IntelligenceAnswer,
} from "@/lib/knowledge-graph-types";

type FixtureKey = "private-upgrades" | "audit-retention" | "runtime-routing" | "rbac-console";

type FixtureEvidence = {
  sourceApp: SourceApp;
  sourceEventId: string;
  sourceUrl: string;
  title: string;
  snippet: string;
  relationship: string;
  role: CitationRole;
  actor?: string;
  occurredAt?: number;
};

type FixtureAnswerTemplate = {
  key: FixtureKey;
  question: string;
  answer: string;
  keywords: string[];
  preferredApps: SourceApp[];
  evidence: FixtureEvidence[];
};

function metadataText(event: ActivityEvent, key: string) {
  const value = event.metadata[key];
  return typeof value === "string" ? value : "";
}

function eventText(event: ActivityEvent) {
  return [
    event.sourceApp,
    event.action,
    event.title,
    event.body,
    event.sourceEntityId,
    event.sourceEntityType,
    metadataText(event, "sourcePath"),
  ]
    .join(" ")
    .toLowerCase();
}

function textSnippet(value: string, fallback: string) {
  const text = (value || fallback).replace(/\s+/g, " ").trim();
  return text.length > 210 ? `${text.slice(0, 207)}...` : text;
}

function scoreEvent(event: ActivityEvent, keywords: string[], preferredApps: SourceApp[]) {
  const text = eventText(event);
  let score = preferredApps.includes(event.sourceApp) ? 8 : 0;
  keywords.forEach((keyword, index) => {
    const normalized = keyword.toLowerCase();
    if (text.includes(normalized)) score += keywords.length - index + 3;
  });
  return score;
}

function selectEvidence(
  keywords: string[],
  preferredApps: SourceApp[],
  relationships: string[],
  roles: CitationRole[],
) {
  const seenApps = new Set<SourceApp>();
  const ranked = [...corpOsActivityEvents]
    .map((event) => ({ event, score: scoreEvent(event, keywords, preferredApps) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.event.occurredAt - a.event.occurredAt);

  const selected: ActivityEvent[] = [];
  for (const app of preferredApps) {
    const match = ranked.find((item) => item.event.sourceApp === app && !seenApps.has(app));
    if (match) {
      selected.push(match.event);
      seenApps.add(app);
    }
  }
  ranked.forEach(({ event }) => {
    if (selected.length >= 6) return;
    if (!selected.some((item) => item.id === event.id)) selected.push(event);
  });

  return selected.slice(0, 6).map((event, index) => ({
    sourceApp: event.sourceApp,
    sourceEventId: event.id,
    sourceUrl: event.sourceUrl,
    title: event.title,
    snippet: textSnippet(event.body, event.title),
    relationship: relationships[index] ?? "supports the answer",
    role: roles[index] ?? "supports",
    actor: metadataText(event, "actorName") || event.actorId,
    occurredAt: event.occurredAt,
  }));
}

function buildTemplate(
  key: FixtureKey,
  question: string,
  answer: string,
  keywords: string[],
  preferredApps: SourceApp[],
  relationships: string[],
  roles: CitationRole[],
): FixtureAnswerTemplate {
  return {
    key,
    question,
    answer,
    keywords,
    preferredApps,
    evidence: selectEvidence(keywords, preferredApps, relationships, roles),
  };
}

function buildFixtureTemplates(): FixtureAnswerTemplate[] {
  return [
    buildTemplate(
      "private-upgrades",
      "What evidence explains the private-upgrade requirements for enterprise customers?",
      "The selected Redwood activity shows private-upgrade requirements emerging from customer-facing signals, meeting evidence, working documents, support tickets, and implementation records. Cognee is useful here because the answer depends on semantically related text across apps, not a single source record.",
      [
        "private upgrade",
        "private deployment",
        "rollback",
        "audit log",
        "enterprise",
        "customer",
        "design partner",
      ],
      ["gmail", "fireflies", "google-drive", "jira", "linear", "github"],
      [
        "captures the customer-facing request",
        "adds meeting context",
        "documents working requirements",
        "tracks support pressure",
        "turns the ask into implementation work",
        "records code-level follow-through",
      ],
      ["requested", "supports", "documents", "tracks", "tracks", "implements"],
    ),
    buildTemplate(
      "audit-retention",
      "Which customer signals influenced audit logging and retention work?",
      "The audit logging and retention thread is supported by security-oriented Slack discussion, Gmail escalation context, meeting notes, formal documentation, and support artifacts. The graph should make those dependency links visible so the final answer can be traced back to source text.",
      ["audit log", "retention", "security", "siem", "compliance", "kms", "export"],
      ["slack", "gmail", "fireflies", "confluence", "jira", "hubspot"],
      [
        "raises the operational question",
        "captures stakeholder requirements",
        "adds customer meeting evidence",
        "documents the retained policy",
        "tracks follow-up work",
        "anchors the account context",
      ],
      ["supports", "requested", "supports", "documents", "tracks", "context"],
    ),
    buildTemplate(
      "runtime-routing",
      "How did runtime latency, routing, and dedicated capacity decisions connect across teams?",
      "The runtime routing answer connects customer performance concerns with product planning, SRE/runtime implementation, and documentation. This is the kind of cross-app reasoning path Cognee should expose: the answer is a dependency graph over related text fragments.",
      ["runtime", "latency", "routing", "dedicated", "gpu", "capacity", "cost", "observability"],
      ["slack", "google-drive", "linear", "github", "confluence", "hubspot"],
      [
        "surfaces the operational pressure",
        "summarizes customer/product asks",
        "tracks the planned work",
        "implements runtime changes",
        "documents the decision",
        "keeps customer context attached",
      ],
      ["supports", "documents", "tracks", "implements", "documents", "context"],
    ),
    buildTemplate(
      "rbac-console",
      "What source records support the current RBAC and console-query direction?",
      "The RBAC and console-query direction is supported by discussion threads, formal pages, implementation tickets, and pull requests. The important product behavior is not just retrieval, but making each source dependency inspectable in the graph.",
      ["rbac", "console", "query", "permission", "access", "audit", "control plane"],
      ["slack", "confluence", "linear", "github", "jira", "google-drive"],
      [
        "frames the RBAC tradeoff",
        "documents the direction",
        "tracks implementation",
        "shows code follow-through",
        "captures support constraints",
        "keeps planning notes attached",
      ],
      ["supports", "documents", "tracks", "implements", "tracks", "context"],
    ),
  ];
}

function matchFixture(question: string): FixtureAnswerTemplate | null {
  const q = question.toLowerCase();
  const templates = buildFixtureTemplates();

  if (q.includes("private") || q.includes("upgrade") || q.includes("enterprise")) {
    return templates.find((template) => template.key === "private-upgrades") ?? null;
  }
  if (q.includes("audit") || q.includes("retention") || q.includes("security")) {
    return templates.find((template) => template.key === "audit-retention") ?? null;
  }
  if (q.includes("runtime") || q.includes("latency") || q.includes("routing")) {
    return templates.find((template) => template.key === "runtime-routing") ?? null;
  }
  if (q.includes("rbac") || q.includes("console") || q.includes("query")) {
    return templates.find((template) => template.key === "rbac-console") ?? null;
  }

  const fallback = templates
    .map((template) => ({
      template,
      score: template.keywords.filter((keyword) => q.includes(keyword)).length,
    }))
    .sort((a, b) => b.score - a.score)[0];

  return fallback?.score > 0 ? fallback.template : null;
}

function toCogneeFixturePayload(
  template: FixtureAnswerTemplate,
  question: string,
  now: number,
): CogneeQueryPayload {
  const datasetName = "redwood-corp-os-corpus";

  return {
    queryId: `corpus-${template.key}-${now}`,
    question,
    answer: template.answer,
    responseTimeMs: 640,
    timestamp: new Date(now).toISOString(),
    source: "corpus",
    datasetName,
    raw: {
      remember: {
        status: "completed",
        dataset_name: datasetName,
        note: "Generated from EnterpriseRAG-Bench Redwood activity records.",
      },
      recall: [
        {
          source: "graph",
          kind: "graph_completion",
          search_type: "GRAPH_COMPLETION",
          text: template.answer,
          dataset_name: datasetName,
          dataset_id: "corpus-redwood-dataset",
          metadata: {},
          raw: { value: template.answer },
          structured: null,
        },
        ...template.evidence.map((item, index) => ({
          source: "graph" as const,
          kind: "chunk",
          search_type: "CHUNKS" as const,
          text: [
            `Source event id: ${item.sourceEventId}`,
            `Source app: ${item.sourceApp}`,
            `Source URL: ${item.sourceUrl}`,
            `Actor: ${item.actor ?? "Redwood"}`,
            item.occurredAt ? `Occurred at: ${new Date(item.occurredAt).toISOString()}` : null,
            "Content:",
            item.snippet,
          ]
            .filter(Boolean)
            .join("\n"),
          dataset_name: datasetName,
          dataset_id: "corpus-redwood-dataset",
          metadata: {
            data_id: `${template.key}-data-${index + 1}`,
            chunk_id: `${template.key}-chunk-${index + 1}`,
            chunk_index: index,
            document_name: item.title,
            relationship: item.relationship,
            role: item.role,
          },
          raw: {
            text: item.snippet,
            document_name: item.title,
            chunk_index: index,
          },
          structured: null,
        })),
      ],
    },
  };
}

function toAnswer(template: FixtureAnswerTemplate, question: string): IntelligenceAnswer {
  const now = Date.now();
  const payload = toCogneeFixturePayload(template, question, now);
  const normalized = normalizeCogneeQueryPayload(payload);

  return {
    id: payload.queryId,
    queryKey: template.key,
    question,
    answer: normalized.answer,
    createdAt: now,
    source: "corpus",
    responseTimeMs: payload.responseTimeMs ?? 0,
    citations: normalized.citations,
    cognee: {
      datasetName: payload.datasetName,
      recall: payload.raw?.recall ?? [],
      raw: payload.raw,
    },
    graph: normalized.graph,
    highlightedNodeIds: normalized.highlightedNodeIds,
    highlightedEdgeIds: normalized.highlightedEdgeIds,
    reasoningSteps: normalized.reasoningSteps,
  };
}

type IntelligenceState = {
  answers: IntelligenceAnswer[];
  activeAnswerId: string | null;
  isLoading: boolean;
  askQuestion: (text: string) => void;
  setActiveAnswer: (id: string | null) => void;
  clearAnswers: () => void;
};

export const EXAMPLE_PROMPTS = [
  "What evidence explains the private-upgrade requirements for enterprise customers?",
  "Which customer signals influenced audit logging and retention work?",
  "How did runtime latency, routing, and dedicated capacity decisions connect across teams?",
  "What source records support the current RBAC and console-query direction?",
];

export const useIntelligenceStore = create<IntelligenceState>((set, get) => ({
  answers: [],
  activeAnswerId: null,
  isLoading: false,

  askQuestion: (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().isLoading) return;

    set({ isLoading: true, activeAnswerId: null });

    window.setTimeout(() => {
      const match = matchFixture(trimmed);

      if (!match) {
        const now = Date.now();
        const answer: IntelligenceAnswer = {
          id: `answer-empty-${now}`,
          queryKey: "no-match",
          question: trimmed,
          answer:
            "No local corpus answer matches this question yet. When Cognee is connected, this surface will show the returned answer, source citations, and graph path.",
          createdAt: now,
          source: "corpus",
          responseTimeMs: 520,
          citations: [],
          cognee: { recall: [], raw: {} },
          graph: {
            nodes: [],
            edges: [],
            generatedAt: now,
            source: "corpus",
          },
          highlightedNodeIds: [],
          highlightedEdgeIds: [],
          reasoningSteps: [],
        };

        set((state) => ({
          isLoading: false,
          answers: [answer, ...state.answers],
          activeAnswerId: answer.id,
        }));
        return;
      }

      const answer = toAnswer(match, trimmed);
      set((state) => ({
        isLoading: false,
        answers: [answer, ...state.answers],
        activeAnswerId: answer.id,
      }));
    }, 650);
  },

  setActiveAnswer: (id) => set({ activeAnswerId: id }),

  clearAnswers: () => set({ answers: [], activeAnswerId: null }),
}));
