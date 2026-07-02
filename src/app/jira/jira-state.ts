"use client";

import { create } from "zustand";

import { appUsers } from "@/lib/users";

export type JiraIssueType = "Story" | "Task" | "Bug" | "Epic";
export type JiraPriority = "Highest" | "High" | "Medium" | "Low";
export type JiraStatus = "Backlog" | "Selected" | "In Progress" | "In Review" | "Done";

export type JiraProject = {
  id: string;
  key: string;
  name: string;
  description: string;
  leadId: string;
  memberIds: string[];
};

export type JiraComment = {
  id: string;
  authorId: string;
  body: string;
  timestamp: number;
};

export type JiraActivity = {
  id: string;
  actorId: string;
  body: string;
  timestamp: number;
};

export type JiraIssue = {
  id: string;
  projectId: string;
  key: string;
  number: number;
  type: JiraIssueType;
  summary: string;
  description: string;
  status: JiraStatus;
  priority: JiraPriority;
  reporterId: string;
  assigneeId: string | null;
  watcherIds: string[];
  labels: string[];
  sprint: string;
  storyPoints: number | null;
  dueDate: string;
  createdAt: number;
  updatedAt: number;
  comments: JiraComment[];
  activity: JiraActivity[];
};

export type JiraSnapshot = {
  projects: Record<string, JiraProject>;
  issues: Record<string, JiraIssue>;
};

export type JiraState = JiraSnapshot & {
  createIssue: (input: {
    projectId: string;
    actorId: string;
    type: JiraIssueType;
    summary: string;
    description: string;
    priority: JiraPriority;
    assigneeId: string | null;
    labels: string[];
    sprint: string;
    storyPoints: number | null;
    dueDate: string;
  }) => string;
  updateStatus: (issueId: string, actorId: string, status: JiraStatus) => void;
  updateAssignee: (issueId: string, actorId: string, assigneeId: string | null) => void;
  updatePriority: (issueId: string, actorId: string, priority: JiraPriority) => void;
  updateStoryPoints: (issueId: string, actorId: string, storyPoints: number | null) => void;
  updateIssueType: (issueId: string, actorId: string, type: JiraIssueType) => void;
  updateSprint: (issueId: string, actorId: string, sprint: string) => void;
  updateDueDate: (issueId: string, actorId: string, dueDate: string) => void;
  updateLabels: (issueId: string, actorId: string, labels: string[]) => void;
  updateIssueText: (issueId: string, actorId: string, summary: string, description: string) => void;
  toggleWatcher: (issueId: string, actorId: string) => void;
  addComment: (issueId: string, actorId: string, body: string) => void;
};

export const jiraViews = ["board", "backlog"] as const;
export type JiraView = (typeof jiraViews)[number];

export const jiraStatuses: JiraStatus[] = [
  "Backlog",
  "Selected",
  "In Progress",
  "In Review",
  "Done",
];
export const jiraPriorities: JiraPriority[] = ["Highest", "High", "Medium", "Low"];
export const jiraIssueTypes: JiraIssueType[] = ["Story", "Task", "Bug", "Epic"];

const now = Date.now() - 45 * 60 * 1000;

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function activity(actorId: string, body: string, timestamp: number): JiraActivity {
  return { id: makeId("jira-activity"), actorId, body, timestamp };
}

function userName(id: string) {
  return appUsers.find((user) => user.id === id)?.name ?? id;
}

function buildInitialSnapshot(): JiraSnapshot {
  const projects: Record<string, JiraProject> = {
    cos: {
      id: "cos",
      key: "COS",
      name: "Corp OS",
      description: "Replica apps, account switching, and shared product shell.",
      leadId: "riley",
      memberIds: ["riley", "maya", "ari"],
    },
    growth: {
      id: "growth",
      key: "GRO",
      name: "Growth Portal",
      description: "Customer activation, lifecycle campaigns, and reporting.",
      leadId: "maya",
      memberIds: ["maya", "ari"],
    },
    platform: {
      id: "platform",
      key: "PLAT",
      name: "Platform Reliability",
      description: "Internal infra, auth, sync, and release confidence.",
      leadId: "ari",
      memberIds: ["riley", "ari"],
    },
  };

  const summaries = [
    "Account switching should reset private detail views",
    "Add dense keyboard-first command search",
    "Board card labels wrap awkwardly on mobile",
    "Create deterministic fixtures for all replicas",
    "Improve dark mode contrast for status chips",
    "Backlog filters should compose with active sprint",
    "Persist draft edits in the issue detail panel",
    "Add due date warnings to release blockers",
    "Comment composer needs optimistic feedback",
    "Refine empty states for filtered board columns",
    "Create smoke-test checklist for app replicas",
    "Audit watcher notifications after status changes",
  ];
  const descriptions = [
    "The current flow can leave users looking at stale state after a route transition. Tighten URL validation and clear incompatible params.",
    "The surface should support fast triage without needing a mouse for every action.",
    "The card layout needs stable dimensions so labels and metadata stay readable at narrow widths.",
    "Seed data should feel real across users, projects, dates, comments, and status changes.",
  ];
  const issues: Record<string, JiraIssue> = {};
  Object.values(projects).forEach((project, projectIndex) => {
    for (let index = 0; index < 18; index += 1) {
      const timestamp = now - (projectIndex * 20 + index + 1) * 54 * 60 * 1000;
      const id = `${project.id}-issue-${index + 1}`;
      const status = jiraStatuses[(index + projectIndex) % jiraStatuses.length];
      const reporterId = project.memberIds[(index + projectIndex) % project.memberIds.length];
      const assigneeId = project.memberIds[(index + 1) % project.memberIds.length];
      const comments =
        index % 3 === 0
          ? [
              {
                id: `${id}-comment-1`,
                authorId: assigneeId,
                body: "I checked the repro and added the next implementation step.",
                timestamp: timestamp + 28 * 60 * 1000,
              },
              {
                id: `${id}-comment-2`,
                authorId: reporterId,
                body: "Thanks, this matches the expected product behavior.",
                timestamp: timestamp + 72 * 60 * 1000,
              },
            ]
          : [];
      const updatedAt = Math.max(timestamp, ...comments.map((comment) => comment.timestamp));

      issues[id] = {
        id,
        projectId: project.id,
        key: `${project.key}-${index + 1}`,
        number: index + 1,
        type: jiraIssueTypes[(index + projectIndex) % jiraIssueTypes.length],
        summary: summaries[(index + projectIndex) % summaries.length],
        description: descriptions[index % descriptions.length],
        status,
        priority: jiraPriorities[(index + projectIndex) % jiraPriorities.length],
        reporterId,
        assigneeId,
        watcherIds: Array.from(new Set([reporterId, assigneeId])),
        labels: [
          ["frontend", "backend", "privacy", "design"][index % 4],
          ["release", "triage", "quality"][index % 3],
        ],
        sprint: index % 4 === 0 ? "Backlog" : `Sprint ${12 + ((index + projectIndex) % 3)}`,
        storyPoints: index % 5 === 0 ? null : [1, 2, 3, 5, 8][index % 5],
        dueDate: `2026-07-${String(8 + ((index + projectIndex) % 18)).padStart(2, "0")}`,
        createdAt: timestamp,
        updatedAt,
        comments,
        activity: [
          activity(reporterId, "created the issue", timestamp),
          activity(assigneeId, `moved the issue to ${status}`, timestamp + 14 * 60 * 1000),
        ],
      };
    }
  });

  return { projects, issues };
}

export function canAccessProject(project: JiraProject | undefined, userId: string) {
  return Boolean(project?.memberIds.includes(userId));
}

export function issueActivityTime(issue: JiraIssue) {
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

export function formatJiraDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function mutateIssue(
  state: JiraSnapshot,
  issueId: string,
  actorId: string,
  mutate: (issue: JiraIssue, timestamp: number) => JiraIssue,
) {
  const issue = state.issues[issueId];
  const project = state.projects[issue?.projectId];
  if (!issue || !canAccessProject(project, actorId)) return state;
  const timestamp = Date.now();
  return {
    issues: {
      ...state.issues,
      [issueId]: mutate(issue, timestamp),
    },
  };
}

const initialSnapshot = buildInitialSnapshot();

export const useJiraStore = create<JiraState>((set) => ({
  ...initialSnapshot,
  createIssue: (input) => {
    const summary = input.summary.trim();
    if (!summary) return "";
    let createdId = "";
    set((state) => {
      const project = state.projects[input.projectId];
      if (!canAccessProject(project, input.actorId)) return state;
      const nextNumber =
        Math.max(
          0,
          ...Object.values(state.issues)
            .filter((issue) => issue.projectId === input.projectId)
            .map((issue) => issue.number),
        ) + 1;
      const timestamp = Date.now();
      createdId = makeId(`${project.key.toLowerCase()}-issue`);
      const assigneeId =
        input.assigneeId && project.memberIds.includes(input.assigneeId) ? input.assigneeId : null;

      return {
        issues: {
          ...state.issues,
          [createdId]: {
            id: createdId,
            projectId: input.projectId,
            key: `${project.key}-${nextNumber}`,
            number: nextNumber,
            type: input.type,
            summary,
            description: input.description.trim() || "No description provided.",
            status: "Backlog",
            priority: input.priority,
            reporterId: input.actorId,
            assigneeId,
            watcherIds: Array.from(
              new Set([input.actorId, assigneeId].filter(Boolean) as string[]),
            ),
            labels: input.labels,
            sprint: input.sprint,
            storyPoints: input.storyPoints,
            dueDate: input.dueDate,
            createdAt: timestamp,
            updatedAt: timestamp,
            comments: [],
            activity: [activity(input.actorId, "created the issue", timestamp)],
          },
        },
      };
    });
    return createdId;
  },
  updateStatus: (issueId, actorId, status) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        status,
        updatedAt: timestamp,
        activity: [...issue.activity, activity(actorId, `moved the issue to ${status}`, timestamp)],
      })),
    );
  },
  updateAssignee: (issueId, actorId, assigneeId) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => {
        const project = state.projects[issue.projectId];
        const safeAssignee =
          assigneeId && project.memberIds.includes(assigneeId) ? assigneeId : null;
        return {
          ...issue,
          assigneeId: safeAssignee,
          updatedAt: timestamp,
          activity: [
            ...issue.activity,
            activity(
              actorId,
              safeAssignee
                ? `assigned the issue to ${userName(safeAssignee)}`
                : "cleared the assignee",
              timestamp,
            ),
          ],
        };
      }),
    );
  },
  updatePriority: (issueId, actorId, priority) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        priority,
        updatedAt: timestamp,
        activity: [
          ...issue.activity,
          activity(actorId, `changed priority to ${priority}`, timestamp),
        ],
      })),
    );
  },
  updateStoryPoints: (issueId, actorId, storyPoints) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        storyPoints,
        updatedAt: timestamp,
        activity: [
          ...issue.activity,
          activity(
            actorId,
            storyPoints !== null
              ? `updated story points to ${storyPoints}`
              : "cleared story points",
            timestamp,
          ),
        ],
      })),
    );
  },
  updateIssueType: (issueId, actorId, type) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        type,
        updatedAt: timestamp,
        activity: [...issue.activity, activity(actorId, `changed type to ${type}`, timestamp)],
      })),
    );
  },
  updateSprint: (issueId, actorId, sprint) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        sprint: sprint.trim() || "Backlog",
        updatedAt: timestamp,
        activity: [
          ...issue.activity,
          activity(actorId, `moved issue to ${sprint.trim() || "Backlog"}`, timestamp),
        ],
      })),
    );
  },
  updateDueDate: (issueId, actorId, dueDate) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        dueDate,
        updatedAt: timestamp,
        activity: [
          ...issue.activity,
          activity(actorId, `changed due date to ${dueDate}`, timestamp),
        ],
      })),
    );
  },
  updateLabels: (issueId, actorId, labels) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        labels: labels.map((label) => label.trim()).filter(Boolean),
        updatedAt: timestamp,
        activity: [
          ...issue.activity,
          activity(
            actorId,
            labels.length ? `updated labels to ${labels.join(", ")}` : "cleared all labels",
            timestamp,
          ),
        ],
      })),
    );
  },
  updateIssueText: (issueId, actorId, summary, description) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => ({
        ...issue,
        summary: summary.trim() || issue.summary,
        description: description.trim() || issue.description,
        updatedAt: timestamp,
        activity: [
          ...issue.activity,
          activity(actorId, "updated summary or description", timestamp),
        ],
      })),
    );
  },
  toggleWatcher: (issueId, actorId) => {
    set((state) =>
      mutateIssue(state, issueId, actorId, (issue, timestamp) => {
        const watching = issue.watcherIds.includes(actorId);
        return {
          ...issue,
          watcherIds: watching
            ? issue.watcherIds.filter((id) => id !== actorId)
            : [...issue.watcherIds, actorId],
          updatedAt: timestamp,
          activity: [
            ...issue.activity,
            activity(actorId, watching ? "stopped watching" : "started watching", timestamp),
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
        activity: [...issue.activity, activity(actorId, "commented", timestamp)],
      })),
    );
  },
}));
