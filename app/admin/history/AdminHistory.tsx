"use client";

import {
  ArrowLeft,
  AudioLines,
  BadgeDollarSign,
  BookOpen,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  FilterX,
  Folder,
  GitPullRequest,
  KanbanSquare,
  LoaderCircle,
  Mail,
  MessageSquare,
  Clock3,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { appUsers } from "@/lib/users";
import { cn } from "@/lib/utils";
import {
  formatRelativeTime,
  getProcessingRuns,
  sourceAppMeta,
  useActivityStore,
  type ProcessingRunStatus,
  type SourceApp,
} from "@/app/admin/activity-state";

const appIconMap = {
  mail: Mail,
  "message-square": MessageSquare,
  "git-pull-request": GitPullRequest,
  "circle-dot": CircleDot,
  kanban: KanbanSquare,
  "badge-dollar-sign": BadgeDollarSign,
  folder: Folder,
  "book-open": BookOpen,
  "audio-lines": AudioLines,
} as const;

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function userName(userId: string) {
  return appUsers.find((user) => user.id === userId)?.name ?? "Unknown";
}

function AppMarker({ app }: { app: SourceApp }) {
  const meta = sourceAppMeta[app];
  const Icon = appIconMap[meta.iconKey as keyof typeof appIconMap] ?? Sparkles;

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-white"
        style={{ backgroundColor: meta.color }}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{meta.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta.sourceSystem}</span>
      </span>
    </span>
  );
}

function statusLabel(status: ProcessingRunStatus) {
  const labels: Record<ProcessingRunStatus, string> = {
    queued: "Queued",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
  };
  return labels[status];
}

function StatusIcon({ status, className }: { status: ProcessingRunStatus; className?: string }) {
  if (status === "queued") return <Clock3 className={className} />;
  if (status === "processing") return <LoaderCircle className={className} />;
  if (status === "completed") return <CheckCircle2 className={className} />;
  return <FilterX className={className} />;
}

function statusTone(status: ProcessingRunStatus) {
  if (status === "completed")
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (status === "processing")
    return "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  if (status === "failed") return "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
}

function progressValue(status: ProcessingRunStatus) {
  if (status === "queued") return 12;
  if (status === "processing") return 62;
  return 100;
}

export function AdminHistory() {
  const processingRunsById = useActivityStore((state) => state.processingRuns);
  const loadProcessingRuns = useActivityStore((state) => state.loadProcessingRuns);
  const hydrateProcessingRunItems = useActivityStore((state) => state.hydrateProcessingRunItems);
  const retryProcessingRun = useActivityStore((state) => state.retryProcessingRun);
  const retryProcessingRunItem = useActivityStore((state) => state.retryProcessingRunItem);
  const runs = getProcessingRuns(processingRunsById);

  const loadCorpusPage = useActivityStore((state) => state.loadCorpusPage);

  useEffect(() => {
    void loadCorpusPage();
    void loadProcessingRuns();
  }, [loadCorpusPage, loadProcessingRuns]);

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col bg-[#f7f9fc] text-sm text-foreground dark:bg-[#0d1117]">
      <header className="shrink-0 border-b bg-background px-4 py-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href="/admin"
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0")}
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-normal">Audit Log</h1>
              <p className="truncate text-sm text-muted-foreground">
                Processing batches and their source events.
              </p>
            </div>
          </div>
          <Link
            className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer gap-2")}
            href="/admin"
          >
            <MessageSquare className="size-4" />
            Activity
          </Link>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <section className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 lg:px-8">
          {runs.length === 0 ? (
            <div className="flex h-96 flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-background text-muted-foreground">
              <Clock3 className="size-10" />
              <p>No batches yet.</p>
            </div>
          ) : (
            <Accordion className="gap-3">
              {runs.map((run, index) => {
                const progress = progressValue(run.status);

                return (
                  <AccordionItem
                    key={run.id}
                    value={run.id}
                    className="rounded-md border bg-background"
                  >
                    <AccordionTrigger
                      className="px-4 py-4 no-underline hover:no-underline"
                      onClick={() => hydrateProcessingRunItems(run.id)}
                    >
                      <span className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3 pr-4">
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <StatusIcon
                              status={run.status}
                              className={cn(
                                "size-4",
                                run.status === "processing" && "animate-spin",
                              )}
                            />
                            <span className="font-semibold">Batch {runs.length - index}</span>
                            <Badge className={statusTone(run.status)}>
                              {statusLabel(run.status)}
                            </Badge>
                            {run.status === "failed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void retryProcessingRun(run.id);
                                }}
                              >
                                <RefreshCw className="mr-1 size-3" />
                                Retry
                              </Button>
                            )}
                          </span>
                          <span className="mt-1 block text-xs font-normal text-muted-foreground">
                            {formatCount(run.eventIds.length)} events · Started{" "}
                            {formatRelativeTime(run.createdAt)}
                          </span>
                        </span>
                        <span className="w-full min-w-44 max-w-64">
                          <span className="mb-1 flex justify-between text-xs font-normal text-muted-foreground">
                            <span>Progress</span>
                            <span>{progress}%</span>
                          </span>
                          <Progress value={progress} />
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      <div className="divide-y border-t">
                        {run.items.map((item) => {
                          const job = run.backendJobs?.[item.id];
                          const isFailed = job?.status === "FAILED";
                          const isProcessing = job?.status === "IN_PROGRESS";

                          return (
                            <div
                              key={item.id}
                              className="grid min-w-0 gap-3 p-4 hover:bg-muted/60 lg:grid-cols-[14rem_minmax(0,1fr)_14rem]"
                            >
                              <Link
                                href={item.sourceUrl}
                                className="flex items-center no-underline"
                              >
                                <AppMarker app={item.sourceApp} />
                              </Link>
                              <Link
                                href={item.sourceUrl}
                                className="flex min-w-0 flex-col justify-center no-underline"
                              >
                                <span className="block truncate font-medium">{item.title}</span>
                                <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                                  {item.action} · {userName(item.actorId)}
                                </span>
                              </Link>
                              <div className="flex items-center justify-end gap-3">
                                {isFailed && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    onClick={() => void retryProcessingRunItem(run.id, item.id)}
                                  >
                                    <RefreshCw className="mr-1.5 size-3" />
                                    Retry
                                  </Button>
                                )}
                                {isProcessing && (
                                  <Badge
                                    variant="secondary"
                                    className="h-8 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                                  >
                                    <LoaderCircle className="mr-1.5 size-3 animate-spin" />
                                    Retrying...
                                  </Badge>
                                )}
                                <Link
                                  href={item.sourceUrl}
                                  className="flex items-center gap-1 text-sm font-medium text-primary no-underline hover:underline"
                                >
                                  Open
                                  <ExternalLink className="size-3" />
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </section>
      </ScrollArea>
    </main>
  );
}
