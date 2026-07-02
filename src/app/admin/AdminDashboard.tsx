"use client";

import {
  AudioLines,
  BadgeDollarSign,
  BookOpen,
  CheckSquare,
  CircleDot,
  Database,
  ExternalLink,
  FileJson,
  FilterX,
  Folder,
  GitPullRequest,
  History,
  KanbanSquare,
  LoaderCircle,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { appUsers } from "@/lib/users";
import { cn } from "@/lib/utils";
import {
  activityEventTypes,
  buildCogneePreview,
  filterActivityEvents,
  formatEventType,
  formatRelativeTime,
  getActivityEvents,
  getAppCounts,
  getSelectedEvents,
  sourceAppMeta,
  sourceApps,
  useActivityStore,
  type ActivityEvent,
  type ActivityEventType,
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

function userName(userId: string) {
  return appUsers.find((user) => user.id === userId)?.name ?? "Unknown";
}

function userEmail(userId: string) {
  return appUsers.find((user) => user.id === userId)?.email ?? "";
}

function userInitials(userId: string) {
  return appUsers.find((user) => user.id === userId)?.initials ?? "??";
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function updateParams(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  next: Record<string, string | null>,
) {
  const params = new URLSearchParams(searchParams.toString());
  Object.entries(next).forEach(([key, value]) => {
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
  });
  const query = params.toString();
  router.push(query ? `${pathname}?${query}` : pathname);
}

function AppMarker({ app, compact = false }: { app: SourceApp; compact?: boolean }) {
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
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate font-medium">{meta.label}</span>
          <span className="block truncate text-xs text-muted-foreground">{meta.sourceSystem}</span>
        </span>
      )}
    </span>
  );
}

function AdminActionButton({
  label,
  tooltip,
  icon: Icon,
  disabled,
  variant = "default",
  className,
  iconClassName,
  onClick,
}: {
  label: string;
  tooltip: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
  iconClassName?: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className={cn("cursor-pointer gap-2", className)}
            disabled={disabled}
            variant={variant}
            onClick={onClick}
          >
            <Icon className={cn("size-4", iconClassName)} />
            {label}
          </Button>
        }
      />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const eventsById = useActivityStore((state) => state.events);
  const focusedEventId = useActivityStore((state) => state.focusedEventId);
  const toggleEventSelected = useActivityStore((state) => state.toggleEventSelected);
  const toggleEventsSelected = useActivityStore((state) => state.toggleEventsSelected);
  const setFocusedEvent = useActivityStore((state) => state.setFocusedEvent);
  const clearSessionEvents = useActivityStore((state) => state.clearSessionEvents);
  const resetDefaults = useActivityStore((state) => state.resetDefaults);
  const processEvents = useActivityStore((state) => state.processEvents);
  const processingRuns = useActivityStore((state) => state.processingRuns);

  const isBatchRunning = Object.values(processingRuns).some(
    (run) => run.status !== "completed" && run.status !== "failed",
  );

  const appFilter = (searchParams.get("app") ?? "all") as SourceApp | "all";
  const typeFilter = (searchParams.get("type") ?? "all") as ActivityEventType | "all";
  const actorFilter = searchParams.get("actor") ?? "all";
  const selectedFilter = (searchParams.get("selected") ?? "all") as
    "all" | "selected" | "unchecked";
  const query = searchParams.get("q") ?? "";

  const allEvents = useMemo(() => getActivityEvents(eventsById), [eventsById]);
  const filteredEvents = filterActivityEvents(allEvents, {
    app: appFilter,
    type: typeFilter,
    actor: actorFilter,
    selected: selectedFilter,
    query,
  });
  const selectedEvents = getSelectedEvents(allEvents);
  const selectedVisibleEvents = getSelectedEvents(filteredEvents);
  const liveEventCount = allEvents.filter((event) => event.metadata.seeded !== true).length;
  const uncheckedCount = allEvents.length - selectedEvents.length;
  const focusedEvent = (focusedEventId && eventsById[focusedEventId]) || filteredEvents[0] || null;
  const appCounts = getAppCounts(allEvents).filter((item) => item.count > 0);
  const cogneePreview = buildCogneePreview(selectedVisibleEvents.slice(0, 8));
  const allVisibleChecked =
    filteredEvents.length > 0 && filteredEvents.every((event) => event.selected);

  const setFilter = (next: Record<string, string | null>) =>
    updateParams(router, pathname, searchParams, next);

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col bg-[#f7f9fc] text-sm text-foreground dark:bg-[#0d1117]">
      <header className="shrink-0 border-b bg-background">
        <div className="flex flex-wrap items-center gap-4 px-4 py-4 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[#202938] text-white dark:bg-[#f0f6fc] dark:text-[#0d1117]">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-normal">Activity</h1>
              <p className="truncate text-sm text-muted-foreground">Select events to sync.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminActionButton
              icon={FilterX}
              label={`Clear${liveEventCount > 0 ? ` (${liveEventCount})` : ""}`}
              tooltip="Remove new events."
              variant="outline"
              className="bg-red-50 hover:bg-red-100 text-red-900/80 hover:text-red-900 border-red-200/50 hover:border-red-200 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-300/80 dark:hover:text-red-300 dark:border-red-900/30 dark:hover:border-red-900/50"
              onClick={clearSessionEvents}
            />
            <AdminActionButton
              icon={Database}
              label="Reset"
              tooltip="Restore defaults."
              variant="outline"
              className="bg-red-50 hover:bg-red-100 text-red-900/80 hover:text-red-900 border-red-200/50 hover:border-red-200 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-300/80 dark:hover:text-red-300 dark:border-red-900/30 dark:hover:border-red-900/50"
              onClick={resetDefaults}
            />
            <Separator orientation="vertical" className="mx-1 hidden h-8 sm:block" />
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer gap-2")}
              href="/admin/history"
            >
              <History className="size-4" />
              History
            </Link>
            <AdminActionButton
              icon={isProcessing || isBatchRunning ? LoaderCircle : Sparkles}
              label={isProcessing || isBatchRunning ? "Processing..." : "Process"}
              tooltip="Start a batch from included events."
              disabled={selectedEvents.length === 0 || isProcessing || isBatchRunning}
              iconClassName={isProcessing || isBatchRunning ? "animate-spin" : undefined}
              onClick={() => {
                if (isProcessing || isBatchRunning) return;
                setIsProcessing(true);
                setTimeout(() => {
                  processEvents(selectedEvents.map((event) => event.id));
                  setIsProcessing(false);
                }, 600);
              }}
            />
          </div>
        </div>
        <div className="grid gap-2 px-4 pb-4 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:px-8">
          <div className="relative min-w-0">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Search events"
              value={query}
              onChange={(event) => setFilter({ q: event.target.value || null })}
            />
          </div>
          <FilterSelect
            value={appFilter}
            items={["all", ...sourceApps]}
            renderItem={(value) =>
              value === "all" ? "All apps" : sourceAppMeta[value as SourceApp].label
            }
            onChange={(value) => setFilter({ app: value })}
          />
          <FilterSelect
            value={typeFilter}
            items={["all", ...activityEventTypes]}
            renderItem={(value) =>
              value === "all" ? "All types" : formatEventType(value as ActivityEventType)
            }
            onChange={(value) => setFilter({ type: value })}
          />
          <FilterSelect
            value={actorFilter}
            items={["all", ...appUsers.map((user) => user.id)]}
            renderItem={(value) => (value === "all" ? "All actors" : userName(value))}
            onChange={(value) => setFilter({ actor: value })}
          />
          <FilterSelect
            value={selectedFilter}
            items={["all", "selected", "unchecked"]}
            renderItem={(value) =>
              value === "all" ? "All events" : value === "selected" ? "Included" : "Excluded"
            }
            onChange={(value) => setFilter({ selected: value })}
          />
        </div>
      </header>

      <section className="grid shrink-0 gap-3 border-b bg-background/70 px-4 py-3 lg:grid-cols-5 lg:px-8">
        <Metric icon={MessageSquare} label="Pending" value={formatCount(allEvents.length)} />
        <Metric icon={CheckSquare} label="Included" value={formatCount(selectedEvents.length)} />
        <Metric icon={FilterX} label="Excluded" value={formatCount(uncheckedCount)} />
        <Metric icon={Sparkles} label="Apps" value={formatCount(appCounts.length)} />
      </section>

      <section className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-h-0 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-3 border-b bg-background px-4 lg:px-8">
            <Checkbox
              className="cursor-pointer"
              checked={allVisibleChecked}
              onCheckedChange={(checked) =>
                toggleEventsSelected(
                  filteredEvents.map((event) => event.id),
                  checked === true,
                )
              }
            />
            <span className="text-sm text-muted-foreground">
              Showing {formatCount(filteredEvents.length)} events ·{" "}
              {formatCount(selectedVisibleEvents.length)} included
            </span>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {filteredEvents.length === 0 ? (
              <div className="flex h-96 flex-col items-center justify-center gap-2 text-muted-foreground">
                <MessageSquare className="size-10" />
                <p>
                  {allEvents.length === 0 ? "All caught up." : "No events match these filters."}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredEvents.map((event) => (
                  <ActivityEventRow
                    key={event.id}
                    event={event}
                    focused={focusedEvent?.id === event.id}
                    onFocus={() => setFocusedEvent(event.id)}
                    onSelected={(selected) => toggleEventSelected(event.id, selected)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <aside className="min-h-0 border-t bg-background lg:border-t-0 lg:border-l">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              <section>
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <FileJson className="size-4" />
                  Details
                </div>
                {focusedEvent ? (
                  <EventJson event={focusedEvent} />
                ) : (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Select an event for details.
                  </div>
                )}
              </section>
              <Separator />
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium">Preview</div>
                  <Badge variant="secondary">{selectedVisibleEvents.length} included</Badge>
                </div>
                <pre className="max-h-[30rem] overflow-auto rounded-md border bg-muted/50 p-3 text-xs leading-5">
                  {JSON.stringify(cogneePreview, null, 2)}
                </pre>
              </section>
            </div>
          </ScrollArea>
        </aside>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md border bg-background px-3 py-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
        <span className="block truncate text-base font-semibold">{value}</span>
      </span>
    </div>
  );
}

function ActivityEventRow({
  event,
  focused,
  onFocus,
  onSelected,
}: {
  event: ActivityEvent;
  focused: boolean;
  onFocus: () => void;
  onSelected: (selected: boolean) => void;
}) {
  return (
    <button
      className={cn(
        "grid w-full cursor-pointer gap-3 bg-background px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:grid-cols-[1.75rem_13rem_minmax(0,1fr)_8rem_6rem] lg:px-8",
        focused && "bg-blue-50/70 dark:bg-blue-950/20",
      )}
      onClick={onFocus}
      type="button"
    >
      <span onClick={(event_) => event_.stopPropagation()}>
        <Checkbox
          aria-label={`Include ${event.title}`}
          className="mt-1 cursor-pointer"
          checked={event.selected}
          onCheckedChange={(checked) => onSelected(checked === true)}
        />
      </span>
      <AppMarker app={event.sourceApp} />
      <span className="min-w-0">
        <span className="mb-1 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {formatEventType(event.type)}
          </Badge>
          <span className="text-xs text-muted-foreground">{event.action}</span>
        </span>
        <span className="block truncate font-medium">{event.title}</span>
        <span className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground">
          {event.body}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {event.sourceEntityType} · {event.sourceEntityId}
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <Avatar size="sm">
          <AvatarFallback>{userInitials(event.actorId)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{userName(event.actorId)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {userEmail(event.actorId)}
          </span>
        </span>
      </span>
      <span className="flex items-center justify-between gap-2 lg:block">
        <span className="block text-xs text-muted-foreground">
          {formatRelativeTime(event.occurredAt)}
        </span>
        <Link
          className="mt-0 inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-0 text-sm font-medium text-primary hover:underline lg:mt-2"
          href={event.sourceUrl}
          onClick={(event_) => event_.stopPropagation()}
        >
          Open
          <ExternalLink className="size-3" />
        </Link>
      </span>
    </button>
  );
}

function EventJson({ event }: { event: ActivityEvent }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border p-3">
        <AppMarker app={event.sourceApp} />
        <div className="mt-3 font-medium">{event.title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{event.body}</p>
        <Link
          className="mt-3 inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-sm font-medium hover:bg-muted"
          href={event.sourceUrl}
        >
          Open source
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
      <pre className="max-h-80 overflow-auto rounded-md border bg-muted/50 p-3 text-xs leading-5">
        {JSON.stringify(event, null, 2)}
      </pre>
    </div>
  );
}

function FilterSelect<T extends string>({
  value,
  items,
  renderItem,
  onChange,
}: {
  value: T;
  items: T[];
  renderItem: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger className="h-9 w-full cursor-pointer lg:w-40">
        <SelectValue>{renderItem(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item} value={item} className="cursor-pointer capitalize">
            {renderItem(item)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
