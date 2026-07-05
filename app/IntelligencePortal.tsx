"use client";

import { useEffect } from "react";
import { BrainCircuit, Network } from "lucide-react";

import { ChatPanel } from "@/app/ChatPanel";
import dynamic from "next/dynamic";
const GraphPanel = dynamic(() => import("@/app/GraphPanel").then((mod) => mod.GraphPanel), {
  ssr: false,
});
import { useIntelligenceStore } from "@/app/intelligence-state";
import { Badge } from "@/components/ui/badge";

export function IntelligencePortal() {
  const { answers, activeAnswerId } = useIntelligenceStore();
  const activeAnswer = answers.find((answer) => answer.id === activeAnswerId) ?? null;

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
    <main className="flex h-[calc(100dvh-3.5rem)] min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f7f9fc] text-foreground dark:bg-[#0d1117]">
      <header className="shrink-0 border-b bg-background px-4 py-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BrainCircuit className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-normal">Enterprise Memory</h1>
              <p className="truncate text-sm text-muted-foreground">
                Ask questions and inspect the evidence path behind each answer.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Cognee Cloud snapshot</Badge>
            <Badge variant="outline" className="gap-1">
              <Network className="size-3" />
              Read-only graph
            </Badge>
          </div>
        </div>
      </header>

      <section className="grid min-h-0 min-w-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.08fr)_minmax(25rem,0.92fr)]">
        <div className="min-h-[28rem] min-w-0 overflow-hidden border-b lg:min-h-0 lg:border-r lg:border-b-0">
          <GraphPanel activeAnswer={activeAnswer} />
        </div>
        <div className="min-h-0 min-w-0 overflow-hidden">
          <ChatPanel />
        </div>
      </section>
    </main>
  );
}
