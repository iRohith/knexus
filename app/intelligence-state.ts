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

let consecutiveAuthErrors = 0;

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

    try {
      const res = await fetch("/api/v1/knowledge/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          consecutiveAuthErrors++;
          if (consecutiveAuthErrors >= 3) {
            consecutiveAuthErrors = 0;
            await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
            window.location.href = "/login";
            return;
          }
        } else {
          consecutiveAuthErrors = 0;
        }
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }

      consecutiveAuthErrors = 0;
      const backendResponse = (await res.json()) as CogneeQueryPayload & {
        reasoningPath?: CogneeQueryPayload["raw"];
      };

      // backendResponse is KnowledgeQueryResponse
      // map it to IntelligenceAnswer

      const normalized = normalizeCogneeQueryPayload(backendResponse);
      const now = Date.now();

      const answer: IntelligenceAnswer = {
        id: backendResponse.queryId || `answer-${now}`,
        queryKey: backendResponse.queryKey ?? "unknown",
        question: trimmed,
        answer: backendResponse.answer || normalized.answer,
        createdAt: now,
        source: "cognee",
        responseTimeMs: backendResponse.responseTimeMs ?? 0,
        citations: normalized.citations,
        cognee: {
          datasetName: backendResponse.datasetName || "corp-os",
          recall: backendResponse.raw?.recall ?? [],
          raw: backendResponse.raw || backendResponse.reasoningPath,
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
    } catch (err) {
      console.warn("Failed to query backend, falling back to static answers...", err);
      try {
        const fallbackRes = await fetch("/cognee/answers.json");
        if (!fallbackRes.ok) throw new Error("Fallback static answers not found");
        
        const fallbackAnswers = await fallbackRes.json();
        
        const matchedFallback = fallbackAnswers.find(
          (a: any) => a.question.toLowerCase().includes(trimmed.toLowerCase()) || 
                      trimmed.toLowerCase().includes(a.question.toLowerCase()) ||
                      trimmed.toLowerCase().includes(a.queryKey.toLowerCase().replace(/-/g, " "))
        ) || fallbackAnswers[0];

        if (!matchedFallback) throw new Error("No fallback answers available");

        const normalized = normalizeCogneeQueryPayload(matchedFallback.raw);
        const now = Date.now();

        const answer: IntelligenceAnswer = {
          id: `fallback-${now}`,
          queryKey: matchedFallback.queryKey,
          question: trimmed,
          answer: matchedFallback.answer || normalized.answer,
          createdAt: now,
          source: "cognee",
          responseTimeMs: matchedFallback.responseTimeMs ?? 0,
          citations: normalized.citations,
          cognee: {
            datasetName: matchedFallback.datasetName || "corp-os",
            recall: matchedFallback.raw?.recall ?? [],
            raw: matchedFallback.raw,
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
      } catch (fallbackErr) {
        console.error("Fallback also failed:", fallbackErr);
        const now = Date.now();
        const answer: IntelligenceAnswer = {
          id: `answer-empty-${now}`,
          queryKey: "error",
          question: trimmed,
          answer: "Failed to connect to the backend knowledge graph and no fallback was available.",
          createdAt: now,
          source: "corpus",
          responseTimeMs: 0,
          citations: [],
          cognee: { recall: [], raw: {} },
          graph: { nodes: [], edges: [], generatedAt: now, source: "corpus" },
          highlightedNodeIds: [],
          highlightedEdgeIds: [],
          reasoningSteps: [],
        };
        set((state) => ({
          isLoading: false,
          answers: [answer, ...state.answers],
          activeAnswerId: answer.id,
        }));
      }
    }
  },

  setActiveAnswer: (id) => set({ activeAnswerId: id }),

  clearAnswers: () => set({ answers: [], activeAnswerId: null }),
}));
