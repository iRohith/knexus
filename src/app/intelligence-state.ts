"use client";

import { create } from "zustand";

import { normalizeCogneeQueryPayload } from "@/lib/cognee-adapter";
import type { CogneeQueryPayload, IntelligenceAnswer } from "@/lib/knowledge-graph-types";

export const EXAMPLE_PROMPTS = [
  "What evidence explains the private-upgrade requirements for enterprise customers?",
  "Which customer signals influenced audit logging and retention work?",
  "How did runtime latency, routing, and dedicated capacity decisions connect across teams?",
  "What source records support the current RBAC and console-query direction?",
];

type IntelligenceState = {
  answers: IntelligenceAnswer[];
  activeAnswerId: string | null;
  isLoading: boolean;
  snapshotPayloads: CogneeQueryPayload[] | null;
  askQuestion: (text: string) => void;
  setActiveAnswer: (id: string | null) => void;
  clearAnswers: () => void;
};

export const useIntelligenceStore = create<IntelligenceState>((set, get) => ({
  answers: [],
  activeAnswerId: null,
  isLoading: false,
  snapshotPayloads: null,

  askQuestion: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().isLoading) return;

    set({ isLoading: true, activeAnswerId: null });

    let payloads = get().snapshotPayloads;
    if (!payloads) {
      try {
        const res = await fetch("/cognee/answers.json", { cache: "no-store" });
        if (res.ok) {
          payloads = await res.json();
          set({ snapshotPayloads: payloads });
        } else {
          payloads = [];
        }
      } catch (err) {
        console.error("Failed to fetch answers snapshot:", err);
        payloads = [];
      }
    }

    const q = trimmed.toLowerCase();
    let match: CogneeQueryPayload | undefined;

    if (q.includes("private") || q.includes("upgrade") || q.includes("enterprise")) {
      match = payloads?.find((p) => p.queryKey === "private-upgrades");
    } else if (q.includes("audit") || q.includes("retention") || q.includes("security")) {
      match = payloads?.find((p) => p.queryKey === "audit-retention");
    } else if (q.includes("runtime") || q.includes("latency") || q.includes("routing")) {
      match = payloads?.find((p) => p.queryKey === "runtime-routing");
    } else if (q.includes("rbac") || q.includes("console") || q.includes("query")) {
      match = payloads?.find((p) => p.queryKey === "rbac-console");
    }

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

    const normalized = normalizeCogneeQueryPayload(match);
    const now = Date.now();
    const answer: IntelligenceAnswer = {
      id: match.queryId,
      queryKey: match.queryKey ?? "unknown",
      question: trimmed,
      answer: normalized.answer,
      createdAt: now,
      source: "cognee",
      responseTimeMs: match.responseTimeMs ?? 0,
      citations: normalized.citations,
      cognee: {
        datasetName: match.datasetName,
        recall: match.raw?.recall ?? [],
        raw: match.raw,
      },
      graph: normalized.graph,
      highlightedNodeIds: normalized.highlightedNodeIds,
      highlightedEdgeIds: normalized.highlightedEdgeIds,
      reasoningSteps: normalized.reasoningSteps,
    };

    set((state) => ({
      isLoading: false,
      answers: [answer, ...state.answers],
      activeAnswerId: answer.id,
    }));
  },

  setActiveAnswer: (id) => set({ activeAnswerId: id }),

  clearAnswers: () => set({ answers: [], activeAnswerId: null }),
}));
