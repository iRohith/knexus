"use client";

import { create } from "zustand";

import { loadCorpusEventsFor } from "@/lib/corpus-app-data";
import { appUsers } from "@/lib/users";

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
  loadCorpusPage: (page?: number, eventsPerApp?: number) => Promise<void>;
  loadCorpusAppPage: (app: SourceApp, page?: number) => Promise<void>;
  appendEvent: (input: ActivityEventInput) => string;
  toggleEventSelected: (eventId: string, selected: boolean) => void;
  toggleEventsSelected: (eventIds: string[], selected: boolean) => void;
  processEvents: (eventIds: string[]) => string;
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
const defaultAdminEventsPerApp = 25;

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
        const runs = await res.json();
        set((state) => ({
          processingRuns: { ...state.processingRuns, ...runs },
        }));
      }
    } catch {
      // Ignored if file doesn't exist
    }
  },
  loadCorpusPage: async (page = 1, eventsPerApp = defaultAdminEventsPerApp) => {
    const pages = await Promise.all(
      sourceApps.map(async (app) => {
        const events = await loadCorpusEventsFor(app, page);
        return events.slice(0, eventsPerApp);
      }),
    );
    const events = mergeCorpusEvents(pages.flat());
    set((state) => ({
      events: { ...state.events, ...events },
    }));
  },
  loadCorpusAppPage: async (app, page = 1) => {
    const events = mergeCorpusEvents(await loadCorpusEventsFor(app, page));
    set((state) => ({
      events: { ...state.events, ...events },
    }));
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
  processEvents: (eventIds) => {
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
      window.setTimeout(() => {
        useActivityStore.getState().updateProcessingRun(runId, "processing");
      }, 600);
      window.setTimeout(() => {
        useActivityStore.getState().updateProcessingRun(runId, "completed");
      }, 1800);
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

export function toCogneeActivityInput(event: ActivityEvent): CogneeActivityInput {
  return {
    datasetName: "corp-os-activity",
    text: [event.title, event.body].filter(Boolean).join("\n\n"),
    source: {
      app: event.sourceApp,
      entityId: event.sourceEntityId,
      entityType: event.sourceEntityType,
      url: event.sourceUrl,
      occurredAt: event.occurredAt,
      actorId: event.actorId,
    },
    metadata: {
      ...event.metadata,
      action: event.action,
      eventType: event.type,
      selected: event.selected,
    },
  };
}

export function buildCogneePreview(events: ActivityEvent[]) {
  return events.map(toCogneeActivityInput);
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
