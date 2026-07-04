"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import dynamic from "next/dynamic";
const GraphPanel = dynamic(() => import("@/app/GraphPanel").then((mod) => mod.GraphPanel), {
  ssr: false,
});
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

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  return (
    <main className="h-[calc(100dvh-3.5rem)] min-h-0 w-full max-w-full overflow-hidden">
      <GraphPanel
        activeAnswer={activeAnswer}
        fullPage
        initialNodeId={nodeId}
        initialEdgeId={edgeId}
      />
    </main>
  );
}
