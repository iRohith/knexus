"use client";

import { create } from "zustand";

import {
  activeCorpusUserIds,
  corpusEventsFor,
  corpusLabels,
  corpusNormalizedRecords,
  corpusNormalizedString,
  corpusNormalizedStrings,
  corpusText,
  corpusUserIdFromName,
  dateInput,
  loadCorpusEventsFor,
  stableNumber,
} from "@/lib/corpus-app-data";

export type LinearStatus = "Backlog" | "Todo" | "In Progress" | "In Review" | "Done" | "Canceled";
export type LinearPriority = "Urgent" | "High" | "Medium" | "Low" | "No priority";

export type LinearTeam = {
  id: string;
  key: string;
  name: string;
  description: string;
  memberIds: string[];
};

export type LinearProject = {
  id: string;
  teamId: string;
  name: string;
  targetDate: string;
  health: "On track" | "At risk" | "Off track";
};

export type LinearCycle = {
  id: string;
  teamId: string;
  name: string;
  startsAt: string;
  endsAt: string;
};

export type LinearComment = {
  id: string;
  authorId: string;
  body: string;
  timestamp: number;
};

export type LinearIssue = {
  id: string;
  teamId: string;
  projectId: string;
  cycleId: string;
  number: number;
  identifier: string;
  title: string;
  description: string;
  status: LinearStatus;
  priority: LinearPriority;
  assigneeId: string | null;
  creatorId: string;
  subscriberIds: string[];
  labels: string[];
  estimate: number | null;
  createdAt: number;
  updatedAt: number;
  comments: LinearComment[];
  activity: LinearComment[];
};

export type LinearSnapshot = {
  teams: Record<string, LinearTeam>;
  projects: Record<string, LinearProject>;
  cycles: Record<string, LinearCycle>;
  issues: Record<string, LinearIssue>;
};

export type LinearState = LinearSnapshot & {
  loadCorpusPage: (page?: number) => Promise<void>;
  createIssue: (input: {
    teamId: string;
    actorId: string;
    title: string;
    description: string;
    status: LinearStatus;
    priority: LinearPriority;
    assigneeId: string | null;
    projectId: string;
    cycleId: string;
    labels: string[];
    estimate: number | null;
  }) => string;
  updateIssueText: (issueId: string, actorId: string, title: string, description: string) => void;
  updateStatus: (issueId: string, actorId: string, status: LinearStatus) => void;
  updatePriority: (issueId: string, actorId: string, priority: LinearPriority) => void;
  updateAssignee: (issueId: string, actorId: string, assigneeId: string | null) => void;
  updateCycle: (issueId: string, actorId: string, cycleId: string) => void;
  updateProject: (issueId: string, actorId: string, projectId: string) => void;
  updateEstimate: (issueId: string, actorId: string, estimate: number | null) => void;
  updateLabels: (issueId: string, actorId: string, labels: string[]) => void;
  toggleSubscriber: (issueId: string, actorId: string) => void;
  addComment: (issueId: string, actorId: string, body: string) => void;
};

export const linearViews = ["list", "board", "roadmap"] as const;
export type LinearView = (typeof linearViews)[number];
export const linearStatuses: LinearStatus[] = [
  "Backlog",
  "Todo",
  "In Progress",
  "In Review",
  "Done",
  "Canceled",
];
export const linearPriorities: LinearPriority[] = [
  "Urgent",
  "High",
  "Medium",
  "Low",
  "No priority",
];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function note(authorId: string, body: string, timestamp: number): LinearComment {
  return { id: makeId("lin-note"), authorId, body, timestamp };
}

function buildInitialSnapshot(corpusIssues = corpusEventsFor("linear")): LinearSnapshot {
  if (corpusIssues.length > 0) {
    const memberIds = activeCorpusUserIds();
    const teams: Record<string, LinearTeam> = {
      product: {
        id: "product",
        key: "PM",
        name: "Product",
        description: "Roadmap, customer evidence, and launch planning.",
        memberIds,
      },
      engineering: {
        id: "engineering",
        key: "ENG",
        name: "Engineering",
        description: "Runtime, platform, reliability, and implementation.",
        memberIds,
      },
      design: {
        id: "design",
        key: "DES",
        name: "Design",
        description: "Console workflows, customer-facing UX, and handoff.",
        memberIds,
      },
    };
    const projects: Record<string, LinearProject> = {};
    const cycles: Record<string, LinearCycle> = {};
    Object.values(teams).forEach((team, index) => {
      projects[`${team.id}-evidence`] = {
        id: `${team.id}-evidence`,
        teamId: team.id,
        name: "Customer Evidence to Execution",
        targetDate: dateInput(Date.UTC(2026, 8 + index, 15)),
        health: ["On track", "At risk", "On track"][index] as LinearProject["health"],
      };
      cycles[`${team.id}-cycle`] = {
        id: `${team.id}-cycle`,
        teamId: team.id,
        name: "Enterprise Readiness",
        startsAt: "2026-06-15",
        endsAt: "2026-07-12",
      };
    });

    const issues: Record<string, LinearIssue> = {};
    corpusIssues.forEach((event, index) => {
      const text = `${event.title} ${corpusText(event)}`.toLowerCase();
      const teamId = text.includes("design")
        ? "design"
        : text.includes("runtime")
          ? "engineering"
          : "product";
      const team = teams[teamId];
      const number = Number(event.sourceEntityId.match(/\d+/)?.[0] ?? index + 1);
      const assigneeId = event.actorId;
      const normalizedStatus = corpusNormalizedString(event, "status", "");
      const normalizedPriority = corpusNormalizedString(event, "priority", "");
      const status = linearStatuses.includes(normalizedStatus as LinearStatus)
        ? (normalizedStatus as LinearStatus)
        : linearStatuses[stableNumber(event.id, linearStatuses.length)];
      const priority = linearPriorities.includes(normalizedPriority as LinearPriority)
        ? (normalizedPriority as LinearPriority)
        : linearPriorities[stableNumber(event.id, linearPriorities.length)];
      const labels = corpusNormalizedStrings(event, "labels");
      const comments = corpusNormalizedRecords(event, "comments");
      issues[event.sourceEntityId] = {
        id: event.sourceEntityId,
        teamId,
        projectId: `${teamId}-evidence`,
        cycleId: `${teamId}-cycle`,
        number,
        identifier: `${team.key}-${number}`,
        title: event.title,
        description: corpusNormalizedString(event, "description", corpusText(event, 2200)),
        status,
        priority,
        assigneeId,
        creatorId: event.actorId,
        subscriberIds: Array.from(new Set([event.actorId, ...memberIds.slice(0, 5)])),
        labels: labels.length > 0 ? labels : corpusLabels(event, ["customer-evidence"]),
        estimate: [1, 2, 3, 5, 8][stableNumber(event.id, 5)],
        createdAt: event.occurredAt - (3 + index) * 24 * 60 * 60 * 1000,
        updatedAt: event.occurredAt,
        comments:
          comments.length > 0
            ? comments
                .slice(0, 4)
                .map((comment, commentIndex) =>
                  note(
                    corpusUserIdFromName(
                      typeof comment.author === "string" ? comment.author : "",
                      memberIds[(index + commentIndex + 1) % memberIds.length] ?? event.actorId,
                    ),
                    typeof comment.body === "string" ? comment.body : corpusText(event, 700),
                    event.occurredAt + (commentIndex + 1) * 10 * 60 * 1000,
                  ),
                )
            : [
                note(
                  memberIds[(index + 1) % memberIds.length] ?? event.actorId,
                  "Connected this issue to upstream customer and source evidence.",
                  event.occurredAt + 10 * 60 * 1000,
                ),
              ],
        activity: [note(event.actorId, `Status is ${status}`, event.occurredAt)],
      };
    });

    return { teams, projects, cycles, issues };
  }

  return { teams: {}, projects: {}, cycles: {}, issues: {} };
}

export function canAccessTeam(team: LinearTeam | undefined, userId: string) {
  return Boolean(team?.memberIds.includes(userId));
}

export function issueActivityTime(issue: LinearIssue) {
  return Math.max(
    issue.updatedAt,
    issue.createdAt,
    ...issue.comments.map((comment) => comment.timestamp),
  );
}

export function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return "just now";
  const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

export function formatLinearDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function mutateIssue(
  state: LinearSnapshot,
  issueId: string,
  actorId: string,
  mutate: (issue: LinearIssue, timestamp: number) => LinearIssue,
) {
  const issue = state.issues[issueId];
  if (!issue || !canAccessTeam(state.teams[issue.teamId], actorId)) return state;
  const timestamp = Date.now();
  return { issues: { ...state.issues, [issueId]: mutate(issue, timestamp) } };
}

const initialSnapshot = buildInitialSnapshot();

export const useLinearStore = create<LinearState>((set) => ({
  ...initialSnapshot,
  loadCorpusPage: async (page = 1) => {
    const events = await loadCorpusEventsFor("linear", page);
    const snapshot = buildInitialSnapshot(events);
    set((state) => ({
      teams: { ...state.teams, ...snapshot.teams },
      projects: { ...state.projects, ...snapshot.projects },
      cycles: { ...state.cycles, ...snapshot.cycles },
      issues: { ...state.issues, ...snapshot.issues },
    }));
  },
  createIssue: (input) => {
    const title = input.title.trim();
    if (!title) return "";
    let id = "";
    set((state) => {
      const team = state.teams[input.teamId];
      if (!canAccessTeam(team, input.actorId)) return state;
      const nextNumber =
        Math.max(
          0,
          ...Object.values(state.issues)
            .filter((issue) => issue.teamId === input.teamId)
            .map((issue) => issue.number),
        ) + 1;
      const assigneeId =
        input.assigneeId && team.memberIds.includes(input.assigneeId) ? input.assigneeId : null;
      const timestamp = Date.now();
      id = makeId(`${team.key.toLowerCase()}-issue`);
      return {
        issues: {
          ...state.issues,
          [id]: {
            id,
            teamId: input.teamId,
            projectId: input.projectId,
            cycleId: input.cycleId,
            number: nextNumber,
            identifier: `${team.key}-${nextNumber}`,
            title,
            description: input.description.trim() || "No description provided.",
            status: input.status,
            priority: input.priority,
            assigneeId,
            creatorId: input.actorId,
            subscriberIds: Array.from(
              new Set([input.actorId, assigneeId].filter(Boolean) as string[]),
            ),
            labels: input.labels,
            estimate: input.estimate,
            createdAt: timestamp,
            updatedAt: timestamp,
            comments: [],
            activity: [note(input.actorId, "created the issue", timestamp)],
          },
        },
      };
    });
    return id;
  },
  updateIssueText: (issueId, actorId, title, description) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        title: title.trim() || issue.title,
        description: description.trim() || issue.description,
        updatedAt: timestamp,
        activity: [...issue.activity, note(actorId, "updated issue details", timestamp)],
      })),
    );
  },
  updateStatus: (issueId, actorId, status) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        status,
        updatedAt: timestamp,
        activity: [...issue.activity, note(actorId, `moved to ${status}`, timestamp)],
      })),
    );
  },
  updatePriority: (issueId, actorId, priority) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        priority,
        updatedAt: timestamp,
        activity: [...issue.activity, note(actorId, `changed priority to ${priority}`, timestamp)],
      })),
    );
  },
  updateAssignee: (issueId, actorId, assigneeId) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => {
        const team = state.teams[issue.teamId];
        const safeAssignee = assigneeId && team.memberIds.includes(assigneeId) ? assigneeId : null;
        return {
          ...issue,
          assigneeId: safeAssignee,
          updatedAt: timestamp,
          activity: [
            ...issue.activity,
            note(actorId, safeAssignee ? "assigned the issue" : "cleared assignee", timestamp),
          ],
        };
      }),
    );
  },
  updateCycle: (issueId, actorId, cycleId) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        cycleId: state.cycles[cycleId]?.teamId === issue.teamId ? cycleId : issue.cycleId,
        updatedAt: timestamp,
        activity: [...issue.activity, note(actorId, "changed cycle", timestamp)],
      })),
    );
  },
  updateProject: (issueId, actorId, projectId) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        projectId: state.projects[projectId]?.teamId === issue.teamId ? projectId : issue.projectId,
        updatedAt: timestamp,
        activity: [...issue.activity, note(actorId, "changed project", timestamp)],
      })),
    );
  },
  updateEstimate: (issueId, actorId, estimate) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        estimate,
        updatedAt: timestamp,
        activity: [
          ...issue.activity,
          note(actorId, `changed estimate to ${estimate || "none"}`, timestamp),
        ],
      })),
    );
  },
  updateLabels: (issueId, actorId, labels) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        labels,
        updatedAt: timestamp,
        activity: [...issue.activity, note(actorId, "updated labels", timestamp)],
      })),
    );
  },
  toggleSubscriber: (issueId, actorId) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => {
        const subscribed = issue.subscriberIds.includes(actorId);
        return {
          ...issue,
          subscriberIds: subscribed
            ? issue.subscriberIds.filter((id) => id !== actorId)
            : [...issue.subscriberIds, actorId],
          updatedAt: timestamp,
          activity: [
            ...issue.activity,
            note(actorId, subscribed ? "unsubscribed" : "subscribed", timestamp),
          ],
        };
      }),
    );
  },
  addComment: (issueId, actorId, body) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        updatedAt: timestamp,
        comments: [
          ...issue.comments,
          { id: makeId(`${issueId}-comment`), authorId: actorId, body: trimmed, timestamp },
        ],
        activity: [...issue.activity, note(actorId, "commented", timestamp)],
      })),
    );
  },
}));
