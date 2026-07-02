"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { BrainCircuit, ExternalLink, LoaderCircle, SendHorizonal, Sparkles, X } from "lucide-react";
import { FaSlack } from "react-icons/fa";
import {
  SiConfluence,
  SiFireflyiii,
  SiGmail,
  SiGoogledrive,
  SiGithub,
  SiHubspot,
  SiJira,
  SiLinear,
} from "react-icons/si";

import { sourceAppMeta, type SourceApp } from "@/app/admin/activity-state";
import { EXAMPLE_PROMPTS, useIntelligenceStore } from "@/app/intelligence-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  AnswerCitation,
  CogneeRecallEntry,
  IntelligenceAnswer,
  ReasoningStep,
} from "@/lib/knowledge-graph-types";

function SourceAppIcon({ app, className }: { app: SourceApp; className?: string }) {
  if (app === "gmail") return <SiGmail className={className} />;
  if (app === "slack") return <FaSlack className={className} />;
  if (app === "github") return <SiGithub className={className} />;
  if (app === "linear") return <SiLinear className={className} />;
  if (app === "jira") return <SiJira className={className} />;
  if (app === "hubspot") return <SiHubspot className={className} />;
  if (app === "google-drive") return <SiGoogledrive className={className} />;
  if (app === "confluence") return <SiConfluence className={className} />;
  return <SiFireflyiii className={className} />;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function CitationCard({ citation }: { citation: AnswerCitation }) {
  const meta = sourceAppMeta[citation.sourceApp];

  return (
    <Link
      href={citation.sourceUrl}
      className="block rounded-md border bg-background p-3 no-underline transition-colors hover:bg-muted/60"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md text-white"
          style={{ backgroundColor: meta.color }}
        >
          <SourceAppIcon app={citation.sourceApp} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{citation.title}</span>
            <Badge variant="outline" className="shrink-0 capitalize">
              {citation.role}
            </Badge>
          </span>
          <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {citation.snippet}
          </span>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
            {meta.label}
            <ExternalLink className="size-3" />
          </span>
        </span>
      </div>
    </Link>
  );
}

function StepCard({ step, index }: { step: ReasoningStep; index: number }) {
  const meta = sourceAppMeta[step.sourceApp];

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[2rem_minmax(0,1fr)]">
      <div
        className="flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ backgroundColor: meta.color }}
      >
        {index + 1}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SourceAppIcon app={step.sourceApp} className="size-3.5" />
          <span className="truncate text-sm font-medium">{step.title}</span>
          <Badge variant="secondary" className="capitalize">
            {step.role}
          </Badge>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.snippet}</p>
        <p className="mt-1 text-xs text-muted-foreground">{step.relationship}</p>
      </div>
    </div>
  );
}

function CogneeResultCard({ entry }: { entry: CogneeRecallEntry }) {
  const text = entry.text ?? entry.content ?? "";

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{entry.kind ?? entry.source}</Badge>
        {entry.search_type && <Badge variant="outline">{entry.search_type}</Badge>}
        {entry.dataset_name && (
          <span className="truncate text-xs text-muted-foreground">{entry.dataset_name}</span>
        )}
      </div>
      {text && <p className="mt-2 line-clamp-4 text-xs leading-5 text-muted-foreground">{text}</p>}
      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
        <pre className="mt-2 max-h-24 overflow-auto rounded border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          {JSON.stringify(entry.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

function AnswerBlock({ answer }: { answer: IntelligenceAnswer }) {
  const graphHref = `/knowledge-graph?query=${encodeURIComponent(answer.id)}`;
  const recall = answer.cognee?.recall ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-background p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="font-medium">Answer</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {answer.source === "fixture" ? "Sample data" : "Cognee"}
            </Badge>
            {answer.cognee?.datasetName && (
              <Badge variant="outline">{answer.cognee.datasetName}</Badge>
            )}
            <Badge variant="outline">{answer.responseTimeMs} ms</Badge>
          </div>
        </div>
        <p className="text-sm leading-7 text-foreground">{answer.answer}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer gap-2")}
            href={graphHref}
          >
            Open graph
            <ExternalLink className="size-3.5" />
          </Link>
          <span className="text-xs text-muted-foreground">
            {answer.citations.length} citations · {answer.reasoningSteps.length} dependency steps ·{" "}
            {formatTime(answer.createdAt)}
          </span>
        </div>
      </div>

      {answer.citations.length > 0 && (
        <section>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Citations
          </div>
          <div className="space-y-2">
            {answer.citations.map((citation) => (
              <CitationCard key={citation.id} citation={citation} />
            ))}
          </div>
        </section>
      )}

      {answer.reasoningSteps.length > 0 && (
        <section>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Evidence Path
          </div>
          <div className="space-y-2">
            {answer.reasoningSteps.map((step, index) => (
              <StepCard key={step.id} step={step} index={index} />
            ))}
          </div>
        </section>
      )}

      {recall.length > 0 && (
        <section>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cognee Recall
          </div>
          <div className="space-y-2">
            {recall.map((entry, index) => (
              <CogneeResultCard key={`${entry.kind ?? entry.source}-${index}`} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { answers, activeAnswerId, isLoading, askQuestion, setActiveAnswer, clearAnswers } =
    useIntelligenceStore();

  const activeAnswer = answers.find((answer) => answer.id === activeAnswerId) ?? null;

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    askQuestion(trimmed);
    setInput("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BrainCircuit className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">Ask Corp OS</h2>
            <p className="truncate text-xs text-muted-foreground">
              Answers show Cognee recall results, citations, and supporting graph context.
            </p>
          </div>
          {answers.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              onClick={clearAnswers}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {answers.length === 0 && !isLoading && (
            <section className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm leading-6">
                  Ask a question about work captured across the Corp OS apps. The sample response
                  uses the same recall-entry shape returned by Cognee Cloud.
                </p>
              </div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Try asking
              </div>
              <div className="grid gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    className="w-full cursor-pointer rounded-md border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                    onClick={() => {
                      setInput(prompt);
                      textareaRef.current?.focus();
                    }}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Querying Cognee-style memory...
            </div>
          )}

          {activeAnswer && !isLoading && (
            <>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {activeAnswer.question}
              </div>
              <AnswerBlock answer={activeAnswer} />
            </>
          )}

          {answers.length > 1 && !isLoading && (
            <>
              <Separator />
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recent
              </div>
              <div className="space-y-1">
                {answers.slice(1).map((answer) => (
                  <button
                    key={answer.id}
                    className="w-full cursor-pointer truncate rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
                    onClick={() => setActiveAnswer(answer.id)}
                    type="button"
                  >
                    {answer.question}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <footer className="shrink-0 border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            rows={2}
            placeholder="Ask a question..."
            className="min-h-0 resize-none text-sm"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="shrink-0 cursor-pointer"
            disabled={!input.trim() || isLoading}
            onClick={handleSubmit}
          >
            {isLoading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <SendHorizonal className="size-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Enter sends. Shift+Enter adds a line.
        </p>
      </footer>
    </div>
  );
}
