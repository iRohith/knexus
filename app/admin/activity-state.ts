"use client";

import { create } from "zustand";

import { loadAppCorpus, type SeedApp, type SeedCard } from "@/lib/seed-data";
import { appUsers } from "@/lib/users";
import { usePatchStore } from "@/lib/stores/patch-store";

function buildSourceUrl(app: SourceApp, card: SeedCard): string {
  const id = card.id;
  // routeKey is a full path like "apps/slack/channels/all-hands" — last segment is the actual ID
  const routeLastSegment = (card.routeKey || "").split("/").pop() || "";

  switch (app) {
    case "gmail":
      // Gmail uses ?id=<card.id> — conversations are keyed by card.id directly
      return `/gmail?id=${id}`;

    case "slack": {
      // Channel name is extracted from card title: "#channel-name: thread_ts"
      const channelName = card.title.match(/^#([^:]+):/)?.[1] ?? routeLastSegment ?? "all-hands";
      // Open the channel; ?thread shows the thread sidebar, ?message highlights the specific message
      return `/slack?channel=${channelName}&thread=${id}&message=${id}`;
    }

    case "github":
      // repoId = last segment of routeKey (e.g. "apps/github/repos/redwood" → "redwood")
      if (card.entityType === "pull_request")
        return `/github?repo=${routeLastSegment}&pr=${id}&tab=pulls`;
      return `/github?repo=${routeLastSegment}&issue=${id}&tab=issues`;

    case "linear": {
      // Replicate the exact teamId logic from linear-state.ts buildInitialSnapshot
      const text = `${card.title} ${card.text || ""}`.toLowerCase();
      const teamId = text.includes("design")
        ? "design"
        : text.includes("runtime")
          ? "engineering"
          : "product-management";
      return `/linear?team=${teamId}&issue=${id}`;
    }

    case "jira": {
      // Replicate jira-state logic: issues are assigned to projects by their position in the loaded array.
      // Since we can't know the index here, navigate to the issue — the app will show it in context.
      // customer-support is the majority project (2 out of 3 issues).
      return `/jira?issue=${id}`;
    }

    case "hubspot":
      // companyId = card.id, contactId = "${card.id}-contact", dealId = "${card.id}-deal"
      if (card.entityType === "deal") return `/hubspot?deal=${id}-deal`;
      if (card.entityType === "company") return `/hubspot?company=${id}`;
      return `/hubspot?contact=${id}-contact`;

    case "google-drive":
      // Items are keyed by card.id directly
      if (card.entityType === "folder") return `/google-drive?folder=${id}`;
      return `/google-drive?file=${id}`;

    case "confluence":
      // spaceId = last segment of routeKey (e.g. "apps/confluence/spaces/engineering" → "engineering")
      return `/confluence?space=${routeLastSegment}&page=${id}`;

    case "fireflies":
      // Meetings are keyed by card.id directly
      return `/fireflies?meeting=${id}`;

    default:
      return `/${app}`;
  }
}

// ---------------------------------------------------------------------------
// Normalize arbitrary seed timestamps into a realistic recent window.
// Seed data spans 2023–2228; we remap the whole range into the last 90 days
// so events look recent. Patch events use real Date.now() and always appear
// newer.
// ---------------------------------------------------------------------------
const WINDOW_DAYS = 90;
const WINDOW_END = Date.now() - 60 * 60 * 1000; // 1 hour ago so patches appear first
const WINDOW_START = WINDOW_END - WINDOW_DAYS * 24 * 60 * 60 * 1000;

// Per-app, we track [minSeed, maxSeed] so we remap consistently
const seedRangeCache = new Map<string, { min: number; max: number }>();

function normalizeTimestamp(app: string, rawTs: number): number {
  const range = seedRangeCache.get(app);
  if (!range || rawTs < range.min || rawTs > range.max) {
    // Expand the range as we see more data
    const cur = seedRangeCache.get(app) ?? { min: rawTs, max: rawTs };
    seedRangeCache.set(app, {
      min: Math.min(cur.min, rawTs),
      max: Math.max(cur.max, rawTs),
    });
  }
  const { min, max } = seedRangeCache.get(app)!;
  if (min === max) return WINDOW_START + (WINDOW_END - WINDOW_START) / 2;
  const ratio = (rawTs - min) / (max - min);
  return Math.round(WINDOW_START + ratio * (WINDOW_END - WINDOW_START));
}

async function loadCorpusEventsFor(app: SourceApp): Promise<ActivityEvent[]> {
  const cards = await loadAppCorpus(app as SeedApp, appUsers[0].id);

  // First pass: seed the range so normalization is consistent within the batch
  for (const card of cards) {
    if (card.occurredAt) normalizeTimestamp(app, card.occurredAt);
  }

  return cards.map((card) => {
    return {
      id: card.id,
      sourceApp: app,
      actorId: card.peopleIds?.[0] || appUsers[0].id,
      occurredAt: card.occurredAt
        ? normalizeTimestamp(app, card.occurredAt)
        : Date.now() - Math.random() * WINDOW_DAYS * 24 * 60 * 60 * 1000,
      type: "create",
      action: "created",
      title: card.title || "",
      body: card.text || card.preview || "",
      sourceEntityId: card.id,
      sourceEntityType: card.entityType || "document",
      sourceUrl: buildSourceUrl(app, card),
      selected: true,
      metadata: (card.source as Record<string, unknown>) || {},
    } as ActivityEvent;
  });
}

export type SourceApp =
  | "gmail"
  | "slack"
  | "github"
  | "linear"
  | "jira"
  | "hubspot"
  | "google-drive"
  | "confluence"
  | "fireflies";

export type ActivityEventType =
  | "message"
  | "comment"
  | "reply"
  | "create"
  | "update"
  | "status_change"
  | "share"
  | "file_action"
  | "meeting_action"
  | "crm_action"
  | "mail_action";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;

export type ActivityEvent = {
  id: string;
  sourceApp: SourceApp;
  actorId: string;
  occurredAt: number;
  type: ActivityEventType;
  action: string;
  title: string;
  body: string;
  sourceEntityId: string;
  sourceEntityType: string;
  sourceUrl: string;
  selected: boolean;
  metadata: JsonRecord;
};

export type SourceAppMeta = {
  app: SourceApp;
  label: string;
  shortCode: string;
  route: string;
  color: string;
  iconKey: string;
  sourceSystem: string;
};

export type ActivityFilters = {
  app?: SourceApp | "all";
  type?: ActivityEventType | "all";
  actor?: string | "all";
  selected?: "all" | "selected" | "unchecked";
  query?: string;
};

export type CogneeActivityInput = {
  datasetName: string;
  text: string;
  source: {
    app: SourceApp;
    entityId: string;
    entityType: string;
    url: string;
    occurredAt: number;
    actorId: string;
  };
  metadata: JsonRecord;
};

export type ProcessingRunStatus = "queued" | "processing" | "completed" | "failed";

export type ProcessingRunItem = Pick<
  ActivityEvent,
  "id" | "sourceApp" | "actorId" | "occurredAt" | "action" | "title" | "sourceUrl"
>;

export type ProcessingRun = {
  id: string;
  status: ProcessingRunStatus;
  eventIds: string[];
  items: ProcessingRunItem[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

export type ActivityEventInput = Omit<ActivityEvent, "id" | "occurredAt" | "selected"> & {
  id?: string;
  occurredAt?: number;
  selected?: boolean;
};

type ActivityState = {
  events: Record<string, ActivityEvent>;
  focusedEventId: string | null;
  processingRuns: Record<string, ProcessingRun>;
  loadProcessingRuns: () => Promise<void>;
  loadCorpusPage: () => Promise<void>;
  loadCorpusAppPage: (app: SourceApp) => Promise<void>;
  syncGlobalEvents: (app?: SourceApp) => Promise<void>;
  appendEvent: (input: ActivityEventInput) => string;
  syncPatches: () => void;
  toggleEventSelected: (eventId: string, selected: boolean) => void;
  toggleEventsSelected: (eventIds: string[], selected: boolean) => void;
  processEvents: (eventIds: string[]) => Promise<string>;
  updateProcessingRun: (runId: string, status: ProcessingRunStatus) => void;
  setFocusedEvent: (eventId: string | null) => void;
  clearSessionEvents: () => void;
  resetDefaults: () => void;
};

export const sourceApps: SourceApp[] = [
  "gmail",
  "slack",
  "github",
  "linear",
  "jira",
  "hubspot",
  "google-drive",
  "confluence",
  "fireflies",
];

export const activityEventTypes: ActivityEventType[] = [
  "message",
  "comment",
  "reply",
  "create",
  "update",
  "status_change",
  "share",
  "file_action",
  "meeting_action",
  "crm_action",
  "mail_action",
];

export const sourceAppMeta: Record<SourceApp, SourceAppMeta> = {
  gmail: {
    app: "gmail",
    label: "Gmail",
    shortCode: "GM",
    route: "/gmail",
    color: "#ea4335",
    iconKey: "mail",
    sourceSystem: "Gmail Mail",
  },
  slack: {
    app: "slack",
    label: "Slack",
    shortCode: "SL",
    route: "/slack",
    color: "#611f69",
    iconKey: "message-square",
    sourceSystem: "Slack Workspace",
  },
  github: {
    app: "github",
    label: "GitHub",
    shortCode: "GH",
    route: "/github",
    color: "#24292f",
    iconKey: "git-pull-request",
    sourceSystem: "GitHub Repositories",
  },
  linear: {
    app: "linear",
    label: "Linear",
    shortCode: "LN",
    route: "/linear",
    color: "#5e6ad2",
    iconKey: "circle-dot",
    sourceSystem: "Linear Teams",
  },
  jira: {
    app: "jira",
    label: "Jira",
    shortCode: "JR",
    route: "/jira",
    color: "#0c66e4",
    iconKey: "kanban",
    sourceSystem: "Jira Projects",
  },
  hubspot: {
    app: "hubspot",
    label: "HubSpot",
    shortCode: "HS",
    route: "/hubspot",
    color: "#ff5c35",
    iconKey: "badge-dollar-sign",
    sourceSystem: "HubSpot CRM",
  },
  "google-drive": {
    app: "google-drive",
    label: "Google Drive",
    shortCode: "GD",
    route: "/google-drive",
    color: "#1a73e8",
    iconKey: "folder",
    sourceSystem: "Google Drive",
  },
  confluence: {
    app: "confluence",
    label: "Confluence",
    shortCode: "CF",
    route: "/confluence",
    color: "#0c66e4",
    iconKey: "book-open",
    sourceSystem: "Confluence Spaces",
  },
  fireflies: {
    app: "fireflies",
    label: "Fireflies",
    shortCode: "FF",
    route: "/fireflies",
    color: "#6d5dfc",
    iconKey: "audio-lines",
    sourceSystem: "Fireflies Meetings",
  },
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDefaults() {
  return {};
}

const initialCorpusEvents = buildDefaults();

function markCorpusEvent(event: ActivityEvent): ActivityEvent {
  return {
    ...event,
    selected: true,
    metadata: {
      ...event.metadata,
      seeded: true,
      generatedDataset: true,
    },
  };
}

function mergeCorpusEvents(events: ActivityEvent[]) {
  return Object.fromEntries(events.map((event) => [event.id, markCorpusEvent(event)]));
}

function searchableMetadataText(metadata: JsonRecord) {
  return [
    metadata.actorName,
    metadata.actorEmail,
    metadata.actorInitials,
    metadata.sourcePath,
    metadata.cleanBody,
    metadata.repository,
    metadata.project,
    metadata.channel,
    metadata.threadTitle,
    metadata.customer,
    metadata.company,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

export const useActivityStore = create<ActivityState>((set) => ({
  events: initialCorpusEvents,
  focusedEventId: null,
  processingRuns: {},
  loadProcessingRuns: async () => {
    try {
      const res = await fetch("/corp-os-data/processing_runs.json");
      if (res.ok) {
        const runs = (await res.json()) as Record<string, ProcessingRun>;
        set((state) => ({
          processingRuns: { ...state.processingRuns, ...runs },
        }));
      }
    } catch {
      // Ignored if file doesn't exist
    }
  },
  loadCorpusPage: async () => {
    const pages = await Promise.all(
      sourceApps.map(async (app) => {
        return await loadCorpusEventsFor(app);
      }),
    );
    const events = mergeCorpusEvents(pages.flat());
    set((state) => ({
      events: { ...state.events, ...events },
    }));

    useActivityStore.getState().syncPatches();

    const allEvents = useActivityStore.getState().events;
    const mockRuns = buildMockProcessingRuns(allEvents);

    set((state) => ({
      processingRuns: { ...state.processingRuns, ...mockRuns },
    }));
  },
  loadCorpusAppPage: async (app) => {
    const events = mergeCorpusEvents(await loadCorpusEventsFor(app));
    set((state) => ({
      events: { ...state.events, ...events },
    }));
    useActivityStore.getState().syncPatches();

    const allEvents = useActivityStore.getState().events;
    const mockRuns = buildMockProcessingRuns(allEvents);

    set((state) => ({
      processingRuns: { ...state.processingRuns, ...mockRuns },
    }));
  },
  syncGlobalEvents: async (app?: SourceApp) => {
    try {
      const endpoint = app ? `/api/v1/events?sourceApp=${app}` : "/api/v1/events";
      const res = await fetch(endpoint, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const newEvents: ActivityEvent[] = await res.json();
      if (newEvents && newEvents.length > 0) {
        set((state) => {
          const events = { ...state.events };
          let changed = false;
          newEvents.forEach((ev) => {
            if (!events[ev.id]) {
              // Backend IngestedDocument mapping to ActivityEvent
              events[ev.id] = {
                ...ev,
                occurredAt: new Date(ev.occurredAt).getTime(),
                selected: true,
                metadata: ev.metadata || {},
              } as unknown as ActivityEvent;
              changed = true;
            }
          });
          return changed ? { events } : state;
        });
      }
    } catch (e) {
      console.error("Failed to sync global events:", e);
    }
  },
  appendEvent: (input) => {
    const id = input.id ?? makeId(`activity-${input.sourceApp}`);
    const event: ActivityEvent = {
      ...input,
      id,
      occurredAt: input.occurredAt ?? Date.now(),
      selected: input.selected ?? true,
      metadata: input.metadata ?? {},
    };

    set((state) => ({
      events: { ...state.events, [id]: event },
      focusedEventId: id,
    }));

    return id;
  },
  syncPatches: () => {
    set((state) => {
      const events = { ...state.events };
      const allPatches = usePatchStore
        .getState()
        .batches.flatMap((b) => b.patches)
        .sort((a, b) => a.occurredAt - b.occurredAt);

      let changed = false;

      for (const patch of allPatches) {
        // Already-tracked events: just handle explicit activity patches
        if (patch.scope === "activity") {
          if (patch.op === "create" || patch.op === "update") {
            const existing = events[patch.targetId] || {};
            events[patch.targetId] = {
              ...existing,
              ...(patch.payload as unknown as ActivityEvent),
            };
            changed = true;
          } else if (patch.op === "delete") {
            delete events[patch.targetId];
            changed = true;
          }
          continue;
        }

        // Skip updates/deletes to entities that are already tracked by corpus
        // (those are seed data — we don't want to duplicate them)
        if (patch.op === "update" || patch.op === "delete") continue;

        // Convert CREATE patches from app scopes into new ActivityEvents
        const app = patch.app as SourceApp;
        if (!sourceApps.includes(app)) continue;

        // Don't create duplicate events
        if (events[patch.targetId]) continue;

        const payload = patch.payload as Record<string, unknown>;
        const title = patchTitle(patch);
        const sourceUrl = patchSourceUrl(patch);

        events[patch.targetId] = {
          id: patch.targetId,
          sourceApp: app,
          actorId: patch.actorId,
          occurredAt: patch.occurredAt,
          type: patchEventType(patch.scope),
          action: "created",
          title,
          body: (payload.body as string) || (payload.text as string) || title,
          sourceEntityId: patch.targetId,
          sourceEntityType: patchEntityType(patch.scope),
          sourceUrl,
          selected: true,
          metadata: { patchScope: patch.scope, fromPatch: true },
        };
        changed = true;
      }

      return changed ? { events } : state;
    });
  },
  toggleEventSelected: (eventId, selected) =>
    set((state) => {
      const event = state.events[eventId];
      if (!event) return state;
      return { events: { ...state.events, [eventId]: { ...event, selected } } };
    }),
  toggleEventsSelected: (eventIds, selected) =>
    set((state) => {
      const events = { ...state.events };
      eventIds.forEach((eventId) => {
        if (events[eventId]) events[eventId] = { ...events[eventId], selected };
      });
      return { events };
    }),
  processEvents: async (eventIds) => {
    const snapshot = useActivityStore.getState().events;
    const items = Array.from(new Set(eventIds))
      .map((eventId) => snapshot[eventId])
      .filter(Boolean)
      .map((event) => ({
        id: event.id,
        sourceApp: event.sourceApp,
        actorId: event.actorId,
        occurredAt: event.occurredAt,
        action: event.action,
        title: event.title,
        sourceUrl: event.sourceUrl,
      }));

    if (items.length === 0) return "";

    const runId = makeId("processing-run");
    const now = Date.now();
    const run: ProcessingRun = {
      id: runId,
      status: "queued",
      eventIds: items.map((item) => item.id),
      items,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      processingRuns: { ...state.processingRuns, [runId]: run },
    }));

    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/v1/indexing/jobs/trigger-bulk-ingestion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(run.eventIds),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        useActivityStore.getState().updateProcessingRun(runId, "completed");
      } catch (err) {
        console.error("Failed to trigger bulk ingestion:", err);
        useActivityStore.getState().updateProcessingRun(runId, "failed");
      }
    }

    return runId;
  },
  updateProcessingRun: (runId, status) =>
    set((state) => {
      const run = state.processingRuns[runId];
      if (!run) return state;
      const nextEvents = { ...state.events };
      const shouldClearEvents = status === "completed";

      if (shouldClearEvents) {
        run.eventIds.forEach((eventId) => {
          delete nextEvents[eventId];
        });
      }

      return {
        events: shouldClearEvents ? nextEvents : state.events,
        focusedEventId:
          shouldClearEvents && state.focusedEventId && run.eventIds.includes(state.focusedEventId)
            ? null
            : state.focusedEventId,
        processingRuns: {
          ...state.processingRuns,
          [runId]: {
            ...run,
            status,
            updatedAt: Date.now(),
            completedAt: status === "completed" ? Date.now() : run.completedAt,
          },
        },
      };
    }),
  setFocusedEvent: (eventId) => set({ focusedEventId: eventId }),
  clearSessionEvents: () =>
    set((state) => ({
      events: Object.fromEntries(
        Object.entries(state.events).filter(([, event]) => event.metadata.seeded === true),
      ),
      focusedEventId: null,
    })),
  resetDefaults: () => set({ events: buildDefaults(), focusedEventId: null, processingRuns: {} }),
}));

export function getActivityEvents(events: Record<string, ActivityEvent>) {
  return Object.values(events).sort((a, b) => b.occurredAt - a.occurredAt);
}

export function filterActivityEvents(events: ActivityEvent[], filters: ActivityFilters) {
  const query = filters.query?.trim().toLowerCase() ?? "";

  return events.filter((event) => {
    if (filters.app && filters.app !== "all" && event.sourceApp !== filters.app) return false;
    if (filters.type && filters.type !== "all" && event.type !== filters.type) return false;
    if (filters.actor && filters.actor !== "all" && event.actorId !== filters.actor) return false;
    if (filters.selected === "selected" && !event.selected) return false;
    if (filters.selected === "unchecked" && event.selected) return false;
    if (!query) return true;

    const user = appUsers.find((item) => item.id === event.actorId);
    const haystack = [
      sourceAppMeta[event.sourceApp].label,
      user?.name,
      user?.email,
      event.action,
      event.title,
      event.body,
      event.sourceEntityId,
      event.sourceEntityType,
      searchableMetadataText(event.metadata),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function getSelectedEvents(events: ActivityEvent[]) {
  return events.filter((event) => event.selected);
}

export function getAppCounts(events: ActivityEvent[]) {
  return sourceApps.map((app) => ({
    app,
    count: events.filter((event) => event.sourceApp === app).length,
  }));
}

export function getTypeCounts(events: ActivityEvent[]) {
  return activityEventTypes.map((type) => ({
    type,
    count: events.filter((event) => event.type === type).length,
  }));
}

export function buildCogneePreview(events: ActivityEvent[]) {
  return events.map((event) => ({
    id: event.id,
    app: event.sourceApp,
    title: event.title,
    text: event.body,
    actor: event.actorId,
    entityId: event.sourceEntityId,
    entityType: event.sourceEntityType,
  }));
}

function buildMockProcessingRuns(eventsById: Record<string, ActivityEvent>) {
  const allEvents = Object.values(eventsById).sort((a, b) => a.occurredAt - b.occurredAt);
  const runs: Record<string, ProcessingRun> = {};

  if (allEvents.length === 0) return runs;

  let mainEvents: ActivityEvent[] = [];
  let leftoverEvents: ActivityEvent[] = [];

  if (allEvents.length > 100) {
    mainEvents = allEvents.slice(0, allEvents.length - 100);
    leftoverEvents = allEvents.slice(allEvents.length - 100);
  } else {
    leftoverEvents = allEvents;
  }

  let index = 0;
  for (let i = 0; i < mainEvents.length; i += 200) {
    const batch = mainEvents.slice(i, i + 200);
    const runId = `mock-run-${index++}`;
    const createdAt = batch[batch.length - 1].occurredAt + 1000;

    runs[runId] = {
      id: runId,
      status: "completed",
      eventIds: batch.map((e) => e.id),
      items: batch.map((e) => ({
        id: e.id,
        sourceApp: e.sourceApp,
        actorId: e.actorId,
        occurredAt: e.occurredAt,
        action: e.action,
        title: e.title,
        sourceUrl: e.sourceUrl,
      })),
      createdAt,
      updatedAt: createdAt + 5000,
      completedAt: createdAt + 5000,
    };
  }

  if (leftoverEvents.length > 0) {
    const runId = `mock-run-${index}`;
    const createdAt = leftoverEvents[leftoverEvents.length - 1].occurredAt + 1000;

    runs[runId] = {
      id: runId,
      status: "processing",
      eventIds: leftoverEvents.map((e) => e.id),
      items: leftoverEvents.map((e) => ({
        id: e.id,
        sourceApp: e.sourceApp,
        actorId: e.actorId,
        occurredAt: e.occurredAt,
        action: e.action,
        title: e.title,
        sourceUrl: e.sourceUrl,
      })),
      createdAt,
      updatedAt: createdAt + 5000,
    };
  }

  return runs;
}

export function getProcessingRuns(runs: Record<string, ProcessingRun>) {
  return Object.values(runs).sort((a, b) => b.createdAt - a.createdAt);
}

export function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return "just now";
  const minutes = Math.max(1, Math.round(diff / (60 * 1000)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatEventType(type: ActivityEventType) {
  return type.replace(/_/g, " ");
}

// -------------------------------------------------------------------------
// Patch → ActivityEvent Helpers
// -------------------------------------------------------------------------

type PatchLike = { scope: string; targetId: string; payload: Record<string, unknown> };

function patchTitle(patch: PatchLike): string {
  const p = patch.payload;
  if (typeof p.title === "string") return p.title;
  if (typeof p.name === "string") return p.name;
  if (typeof p.summary === "string") return p.summary;
  if (typeof p.subject === "string") return p.subject;
  if (typeof p.body === "string") return String(p.body).slice(0, 80);
  return patch.scope.replace(/\./g, " ");
}

function patchEntityType(scope: string): string {
  // e.g. "slack.message" → "message"
  return scope.split(".").pop() ?? scope;
}

function patchEventType(scope: string): ActivityEventType {
  const entity = scope.split(".").pop() ?? "";
  if (["message", "reply"].includes(entity)) return "message";
  if (entity === "comment") return "comment";
  if (["channel", "dm"].includes(entity)) return "create";
  if (entity === "reaction") return "update";
  if (entity === "pr") return "create";
  if (["issue", "page", "meeting"].includes(entity)) return "create";
  return "create";
}

function patchSourceUrl(patch: PatchLike): string {
  const p = patch.payload;
  // If the payload carries an explicit URL, use it
  if (typeof p.url === "string") return p.url;
  if (typeof p.sourceUrl === "string") return p.sourceUrl;

  const app = patch.scope.split(".")[0];
  const entity = patch.scope.split(".").pop() ?? "";
  const id = patch.targetId;

  switch (app) {
    case "slack": {
      const surfaceId = (p.surfaceId as string) || "general";
      const surfaceType = (p.surfaceType as string) || "channel";
      const param = surfaceType === "dm" ? `dm=${surfaceId}` : `channel=${surfaceId}`;
      return `/slack?${param}&thread=${id}&message=${id}`;
    }
    case "github":
      if (entity === "pr") return `/github?pr=${id}&tab=pulls`;
      return `/github?issue=${id}&tab=issues`;
    case "linear":
      return `/linear?issue=${id}`;
    case "jira":
      return `/jira?issue=${id}`;
    case "hubspot":
      if (entity === "deal") return `/hubspot?deal=${id}`;
      if (entity === "company") return `/hubspot?company=${id}`;
      return `/hubspot?contact=${id}`;
    case "google-drive":
      return `/google-drive?file=${id}`;
    case "confluence":
      return `/confluence?page=${id}`;
    case "fireflies":
      return `/fireflies?meeting=${id}`;
    case "gmail":
      return `/gmail?id=${id}`;
    default:
      return `/${app}`;
  }
}

// -------------------------------------------------------------------------
// Live patch hydration: subscribe to the patch-store so that whenever
// the existing 2s localStorage poll delivers new batches, admin events
// and processingRuns update reactively — no extra timer needed.
// -------------------------------------------------------------------------

if (typeof window !== "undefined") {
  let lastBatchCount = 0;

  usePatchStore.subscribe((patchState) => {
    const count = patchState.batches.length;
    if (count === lastBatchCount) return;
    lastBatchCount = count;

    const store = useActivityStore.getState();
    store.syncPatches();

    // Rebuild processingRuns to include any new patch-derived events
    const allEvents = useActivityStore.getState().events;
    const mockRuns = buildMockProcessingRuns(allEvents);
    useActivityStore.setState((state) => ({
      processingRuns: { ...state.processingRuns, ...mockRuns },
    }));
  });
}
