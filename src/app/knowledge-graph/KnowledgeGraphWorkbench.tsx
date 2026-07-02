"use client";

import { useSearchParams } from "next/navigation";

import { GraphPanel } from "@/app/GraphPanel";
import { useIntelligenceStore } from "@/app/intelligence-state";

export function KnowledgeGraphWorkbench() {
  const searchParams = useSearchParams();
  const queryId = searchParams.get("query");
  const nodeId = searchParams.get("node");
  const edgeId = searchParams.get("edge");
  const { answers, activeAnswerId } = useIntelligenceStore();

  const activeAnswer =
    (queryId && answers.find((answer) => answer.id === queryId || answer.queryKey === queryId)) ||
    answers.find((answer) => answer.id === activeAnswerId) ||
    null;

  return (
    <GraphPanel
      activeAnswer={activeAnswer}
      fullPage
      initialNodeId={nodeId}
      initialEdgeId={edgeId}
    />
  );
}
