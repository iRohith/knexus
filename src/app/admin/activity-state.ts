"use client";

import { create } from "zustand";

import { useConfluenceStore } from "@/app/confluence/confluence-state";
import { useFirefliesStore } from "@/app/fireflies/fireflies-state";
import { useGitHubStore } from "@/app/github/github-state";
import { useGmailMailStore } from "@/app/gmail/mail-state";
import { useDriveStore } from "@/app/google-drive/drive-state";
import { useHubSpotStore } from "@/app/hubspot/hubspot-state";
import { useJiraStore } from "@/app/jira/jira-state";
import { useLinearStore } from "@/app/linear/linear-state";
import { useSlackStore } from "@/app/slack/slack-state";
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

function seeded(input: Omit<ActivityEvent, "selected" | "metadata"> & { metadata?: JsonRecord }) {
  return {
    ...input,
    selected: true,
    metadata: {
      seeded: true,
      sourceSystem: sourceAppMeta[input.sourceApp].sourceSystem,
      ...(input.metadata ?? {}),
    },
  } satisfies ActivityEvent;
}

function buildDefaults() {
  const events: Record<string, ActivityEvent> = {};
  const add = (event: ActivityEvent) => {
    events[event.id] = event;
  };

  const gmail = useGmailMailStore.getState();
  Object.values(gmail.conversations)
    .slice(0, 8)
    .forEach((conversation) => {
      const message = conversation.messageIds
        .map((id) => gmail.messages[id])
        .filter(Boolean)
        .at(-1);
      if (!message) return;
      add(
        seeded({
          id: `seeded-gmail-${conversation.id}`,
          sourceApp: "gmail",
          actorId: appUsers.find((user) => user.email === message.from.email)?.id ?? "riley",
          occurredAt: message.timestamp,
          type: message.sentByMe ? "message" : "reply",
          action: message.sentByMe ? "Sent email" : "Received email",
          title: conversation.subject,
          body: message.body,
          sourceEntityId: conversation.id,
          sourceEntityType: "conversation",
          sourceUrl: `/gmail?folder=inbox&page=1&id=${conversation.id}`,
          metadata: {
            messageId: message.id,
            labelIds: conversation.userLabels,
            attachmentCount: message.attachments.length,
          },
        }),
      );
    });

  const slack = useSlackStore.getState();
  Object.values(slack.messages)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 12)
    .forEach((message) => {
      const params =
        message.surfaceType === "channel"
          ? `channel=${message.surfaceId}`
          : `dm=${message.surfaceId}`;
      const thread = message.threadParentId ? `&thread=${message.threadParentId}` : "";
      add(
        seeded({
          id: `seeded-slack-${message.id}`,
          sourceApp: "slack",
          actorId: message.authorId,
          occurredAt: message.timestamp,
          type: message.threadParentId ? "reply" : "message",
          action: message.threadParentId ? "Replied in Slack thread" : "Posted Slack message",
          title:
            message.surfaceType === "channel"
              ? `#${slack.channels[message.surfaceId]?.name ?? message.surfaceId}`
              : "Direct message",
          body: message.body,
          sourceEntityId: message.id,
          sourceEntityType: message.threadParentId ? "thread_reply" : "message",
          sourceUrl: `/slack?${params}${thread}&message=${message.id}#${message.id}`,
          metadata: {
            surfaceType: message.surfaceType,
            surfaceId: message.surfaceId,
            threadParentId: message.threadParentId,
            attachmentCount: message.attachments.length,
          },
        }),
      );
    });

  const github = useGitHubStore.getState();
  Object.values(github.issues)
    .slice(0, 6)
    .forEach((issue) => {
      add(
        seeded({
          id: `seeded-github-issue-${issue.id}`,
          sourceApp: "github",
          actorId: issue.authorId,
          occurredAt: issue.updatedAt,
          type: "create",
          action: "Opened GitHub issue",
          title: issue.title,
          body: issue.body,
          sourceEntityId: issue.id,
          sourceEntityType: "issue",
          sourceUrl: `/github?repo=${issue.repoId}&tab=issues&issue=${issue.id}#${issue.id}-body`,
          metadata: { repoId: issue.repoId, number: issue.number, labels: issue.labels },
        }),
      );
      issue.comments.slice(-1).forEach((comment) =>
        add(
          seeded({
            id: `seeded-github-comment-${comment.id}`,
            sourceApp: "github",
            actorId: comment.authorId,
            occurredAt: comment.timestamp,
            type: "comment",
            action: "Commented on GitHub issue",
            title: issue.title,
            body: comment.body,
            sourceEntityId: comment.id,
            sourceEntityType: "issue_comment",
            sourceUrl: `/github?repo=${issue.repoId}&tab=issues&issue=${issue.id}#${comment.id}`,
            metadata: { repoId: issue.repoId, issueId: issue.id, number: issue.number },
          }),
        ),
      );
    });
  Object.values(github.pulls)
    .slice(0, 4)
    .forEach((pull) =>
      add(
        seeded({
          id: `seeded-github-pr-${pull.id}`,
          sourceApp: "github",
          actorId: pull.authorId,
          occurredAt: pull.updatedAt,
          type: pull.status === "merged" ? "status_change" : "create",
          action:
            pull.status === "merged" ? "Merged GitHub pull request" : "Opened GitHub pull request",
          title: pull.title,
          body: pull.body,
          sourceEntityId: pull.id,
          sourceEntityType: "pull_request",
          sourceUrl: `/github?repo=${pull.repoId}&tab=pulls&pr=${pull.id}#${pull.id}-body`,
          metadata: { repoId: pull.repoId, number: pull.number, status: pull.status },
        }),
      ),
    );

  const linear = useLinearStore.getState();
  Object.values(linear.issues)
    .slice(0, 8)
    .forEach((issue) => {
      add(
        seeded({
          id: `seeded-linear-${issue.id}`,
          sourceApp: "linear",
          actorId: issue.creatorId,
          occurredAt: issue.updatedAt,
          type: "status_change",
          action: `Linear issue is ${issue.status}`,
          title: issue.title,
          body: issue.description,
          sourceEntityId: issue.id,
          sourceEntityType: "issue",
          sourceUrl: `/linear?team=${issue.teamId}&view=list&issue=${issue.id}`,
          metadata: { identifier: issue.identifier, priority: issue.priority },
        }),
      );
      issue.comments.slice(-1).forEach((comment) =>
        add(
          seeded({
            id: `seeded-linear-comment-${comment.id}`,
            sourceApp: "linear",
            actorId: comment.authorId,
            occurredAt: comment.timestamp,
            type: "comment",
            action: "Commented on Linear issue",
            title: issue.title,
            body: comment.body,
            sourceEntityId: comment.id,
            sourceEntityType: "issue_comment",
            sourceUrl: `/linear?team=${issue.teamId}&view=list&issue=${issue.id}#${comment.id}`,
            metadata: { issueId: issue.id, identifier: issue.identifier },
          }),
        ),
      );
    });

  const jira = useJiraStore.getState();
  Object.values(jira.issues)
    .slice(0, 8)
    .forEach((issue) => {
      add(
        seeded({
          id: `seeded-jira-${issue.id}`,
          sourceApp: "jira",
          actorId: issue.reporterId,
          occurredAt: issue.updatedAt,
          type: "status_change",
          action: `Jira issue is ${issue.status}`,
          title: issue.summary,
          body: issue.description,
          sourceEntityId: issue.id,
          sourceEntityType: "issue",
          sourceUrl: `/jira?project=${issue.projectId}&view=board&issue=${issue.id}`,
          metadata: { key: issue.key, priority: issue.priority, type: issue.type },
        }),
      );
      issue.comments.slice(-1).forEach((comment) =>
        add(
          seeded({
            id: `seeded-jira-comment-${comment.id}`,
            sourceApp: "jira",
            actorId: comment.authorId,
            occurredAt: comment.timestamp,
            type: "comment",
            action: "Commented on Jira issue",
            title: issue.summary,
            body: comment.body,
            sourceEntityId: comment.id,
            sourceEntityType: "issue_comment",
            sourceUrl: `/jira?project=${issue.projectId}&view=board&issue=${issue.id}#${comment.id}`,
            metadata: { issueId: issue.id, key: issue.key },
          }),
        ),
      );
    });

  const hubspot = useHubSpotStore.getState();
  Object.values(hubspot.contacts)
    .slice(0, 5)
    .forEach((contact) => {
      add(
        seeded({
          id: `seeded-hubspot-contact-${contact.id}`,
          sourceApp: "hubspot",
          actorId: contact.ownerId,
          occurredAt: contact.lastActivityAt,
          type: "crm_action",
          action: "Updated HubSpot contact",
          title: contact.name,
          body: `${contact.title} at ${hubspot.companies[contact.companyId]?.name ?? "company"}.`,
          sourceEntityId: contact.id,
          sourceEntityType: "contact",
          sourceUrl: `/hubspot?view=contacts&contact=${contact.id}`,
          metadata: { companyId: contact.companyId, stage: contact.stage },
        }),
      );
      contact.notes.slice(-1).forEach((note) =>
        add(
          seeded({
            id: `seeded-hubspot-note-${note.id}`,
            sourceApp: "hubspot",
            actorId: note.authorId,
            occurredAt: note.timestamp,
            type: "crm_action",
            action: "Added HubSpot contact note",
            title: contact.name,
            body: note.body,
            sourceEntityId: note.id,
            sourceEntityType: "contact_note",
            sourceUrl: `/hubspot?view=contacts&contact=${contact.id}#${note.id}`,
            metadata: { contactId: contact.id, companyId: contact.companyId },
          }),
        ),
      );
    });
  Object.values(hubspot.deals)
    .slice(0, 5)
    .forEach((deal) =>
      add(
        seeded({
          id: `seeded-hubspot-deal-${deal.id}`,
          sourceApp: "hubspot",
          actorId: deal.ownerId,
          occurredAt: deal.updatedAt,
          type: "crm_action",
          action: `HubSpot deal is ${deal.stage}`,
          title: deal.name,
          body: `${deal.name} is valued at ${deal.amount}.`,
          sourceEntityId: deal.id,
          sourceEntityType: "deal",
          sourceUrl: `/hubspot?view=deals&deal=${deal.id}`,
          metadata: { companyId: deal.companyId, contactId: deal.contactId, stage: deal.stage },
        }),
      ),
    );

  const drive = useDriveStore.getState();
  Object.values(drive.items)
    .slice(0, 9)
    .forEach((item) =>
      add(
        seeded({
          id: `seeded-drive-${item.id}`,
          sourceApp: "google-drive",
          actorId: item.ownerId,
          occurredAt: item.updatedAt,
          type: item.kind === "folder" ? "create" : "file_action",
          action:
            item.kind === "folder" ? "Created Google Drive folder" : "Updated Google Drive file",
          title: item.name,
          body: item.content,
          sourceEntityId: item.id,
          sourceEntityType: item.kind,
          sourceUrl:
            item.kind === "folder"
              ? `/google-drive?view=my-drive&folder=${item.id}`
              : `/google-drive?view=my-drive&file=${item.id}`,
          metadata: { kind: item.kind, parentId: item.parentId, sharedWith: item.sharedWith },
        }),
      ),
    );

  const confluence = useConfluenceStore.getState();
  Object.values(confluence.pages)
    .slice(0, 8)
    .forEach((page) => {
      add(
        seeded({
          id: `seeded-confluence-${page.id}`,
          sourceApp: "confluence",
          actorId: page.authorId,
          occurredAt: page.updatedAt,
          type: "update",
          action: "Updated Confluence page",
          title: page.title,
          body: page.body,
          sourceEntityId: page.id,
          sourceEntityType: "page",
          sourceUrl: `/confluence?space=${page.spaceId}&page=${page.id}`,
          metadata: { labels: page.labels, spaceId: page.spaceId },
        }),
      );
      page.comments.slice(-1).forEach((comment) =>
        add(
          seeded({
            id: `seeded-confluence-comment-${comment.id}`,
            sourceApp: "confluence",
            actorId: comment.authorId,
            occurredAt: comment.timestamp,
            type: "comment",
            action: "Commented on Confluence page",
            title: page.title,
            body: comment.body,
            sourceEntityId: comment.id,
            sourceEntityType: "page_comment",
            sourceUrl: `/confluence?space=${page.spaceId}&page=${page.id}#${comment.id}`,
            metadata: { pageId: page.id, spaceId: page.spaceId },
          }),
        ),
      );
    });

  const fireflies = useFirefliesStore.getState();
  Object.values(fireflies.meetings)
    .slice(0, 8)
    .forEach((meeting) => {
      add(
        seeded({
          id: `seeded-fireflies-${meeting.id}`,
          sourceApp: "fireflies",
          actorId: meeting.ownerId,
          occurredAt: meeting.updatedAt,
          type: "meeting_action",
          action: "Updated Fireflies meeting",
          title: meeting.title,
          body: meeting.summary,
          sourceEntityId: meeting.id,
          sourceEntityType: "meeting",
          sourceUrl: `/fireflies?view=all&meeting=${meeting.id}`,
          metadata: { attendeeIds: meeting.attendeeIds, topics: meeting.topics },
        }),
      );
      meeting.actionItems.slice(0, 1).forEach((item) =>
        add(
          seeded({
            id: `seeded-fireflies-action-${item.id}`,
            sourceApp: "fireflies",
            actorId: item.ownerId,
            occurredAt: meeting.updatedAt,
            type: "meeting_action",
            action: item.completed
              ? "Completed Fireflies action item"
              : "Created Fireflies action item",
            title: meeting.title,
            body: item.text,
            sourceEntityId: item.id,
            sourceEntityType: "action_item",
            sourceUrl: `/fireflies?view=actions&meeting=${meeting.id}#${item.id}`,
            metadata: { meetingId: meeting.id, completed: item.completed },
          }),
        ),
      );
      meeting.comments.slice(-1).forEach((comment) =>
        add(
          seeded({
            id: `seeded-fireflies-comment-${comment.id}`,
            sourceApp: "fireflies",
            actorId: comment.authorId,
            occurredAt: comment.timestamp,
            type: "comment",
            action: "Commented on Fireflies meeting",
            title: meeting.title,
            body: comment.body,
            sourceEntityId: comment.id,
            sourceEntityType: "meeting_comment",
            sourceUrl: `/fireflies?view=all&meeting=${meeting.id}#${comment.id}`,
            metadata: { meetingId: meeting.id },
          }),
        ),
      );
    });

  return events;
}

const initialDemoEvents = buildDefaults();

export const useActivityStore = create<ActivityState>((set) => ({
  events: initialDemoEvents,
  focusedEventId: null,
  processingRuns: {},
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
      JSON.stringify(event.metadata),
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
