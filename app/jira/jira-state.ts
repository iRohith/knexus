"use client";

import { create } from "zustand";

import { appUsers } from "@/lib/users";
import { SeedCard, loadAppCorpus } from "@/lib/seed-data";
import { usePatchStore, getGlobalPatchesForApp, type AppPatch } from "@/lib/stores/patch-store";
import { useUserStore } from "@/lib/stores/user-store";

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
  loadCorpusPage: () => Promise<void>;
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

function buildInitialSnapshot(cards: SeedCard[] = []): JiraSnapshot {
  const memberIds = appUsers.map((u) => u.id);
  const projects: Record<string, JiraProject> = {
    "customer-support": {
      id: "customer-support",
      key: "SUP",
      name: "Customer Support",
      description: "Customer-facing Redwood Inference support work.",
      leadId: memberIds[0],
      memberIds,
    },
    "internal-support": {
      id: "internal-support",
      key: "INT",
      name: "Internal Support",
      description: "Internal platform, compliance, and operational support.",
      leadId: memberIds[1] ?? memberIds[0],
      memberIds,
    },
  };
  const issues: Record<string, JiraIssue> = {};

  if (cards.length > 0) {
    cards.forEach((card, index) => {
      const projectId = index % 3 === 0 ? "internal-support" : "customer-support";
      const keyPrefix = projects[projectId].key;
      const number = index + 1;
      const id = card.id;
      const reporterId = card.peopleIds[0] ?? memberIds[0];
      const assigneeId = memberIds[(index + 1) % memberIds.length] ?? reporterId;

      const status = jiraStatuses[index % jiraStatuses.length];
      const priority = jiraPriorities[index % jiraPriorities.length];
      const labels = ["support", "bug"];

      issues[id] = {
        id,
        projectId,
        key: `${keyPrefix}-${number}`,
        number,
        type: (["Story", "Task", "Bug", "Epic"] as JiraIssueType[])[index % 4],
        summary: card.title,
        description: card.text || "No description provided.",
        status,
        priority,
        reporterId,
        assigneeId,
        watcherIds: Array.from(new Set([reporterId, assigneeId, ...memberIds.slice(0, 4)])),
        labels,
        sprint: `Redwood Support ${Math.max(1, (index % 8) + 1)}`,
        storyPoints: [1, 2, 3, 5, 8][index % 5],
        dueDate: new Date(card.occurredAt + (5 + index) * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        createdAt: card.occurredAt - (2 + index) * 24 * 60 * 60 * 1000,
        updatedAt: card.occurredAt,
        comments: [
          {
            id: `${id}-comment-1`,
            authorId: assigneeId,
            body: "Mapped to related Redwood customer evidence for follow-up.",
            timestamp: card.occurredAt + 15 * 60 * 1000,
          },
        ],
        activity: [
          activity(reporterId, `Created ${card.title}`, card.occurredAt - 20 * 60 * 1000),
          activity(assigneeId, `Updated status to ${status}`, card.occurredAt),
        ],
      };
    });
  }

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
  const nextIssue = mutate(issue, timestamp);

  usePatchStore.getState().appendPatch({
    app: "jira",
    op: "update",
    scope: "jira.issue",
    targetId: issueId,
    actorId,
    payload: nextIssue as unknown as Record<string, unknown>,
  });

  return {
    issues: {
      ...state.issues,
      [issueId]: nextIssue,
    },
  };
}

function applyPatch(state: JiraSnapshot, patch: AppPatch) {
  if (patch.scope === "jira.issue" && patch.op === "create") {
    const issue = patch.payload as unknown as JiraIssue;
    state.issues[issue.id] = issue;
  } else if (patch.scope === "jira.issue" && patch.op === "update") {
    if (state.issues[patch.targetId]) {
      state.issues[patch.targetId] = { ...state.issues[patch.targetId], ...patch.payload };
    }
  } else if (patch.scope === "jira.comment" && patch.op === "create") {
    const issue = state.issues[patch.targetId];
    if (issue) {
      issue.comments.push(patch.payload as JiraComment);
    }
  }
}

usePatchStore.subscribe((state, prevState) => {
  if (state.batches === prevState.batches) return;
  const newBatches = state.batches.filter((b) => !prevState.batches.includes(b));
  if (newBatches.length === 0) return;
  const newPatches = newBatches.flatMap((b) => b.patches).filter((p) => p.app === "jira");
  if (newPatches.length === 0) return;

  useJiraStore.setState((draftState: JiraState) => {
    const nextState = JSON.parse(JSON.stringify(draftState));
    newPatches.forEach((patch) => applyPatch(nextState, patch));
    return nextState;
  });
});

const initialSnapshot = buildInitialSnapshot();

export const useJiraStore = create<JiraState>((set) => ({
  ...initialSnapshot,
  loadCorpusPage: async () => {
    const activeUserId = useUserStore.getState().activeUserId;
    if (!activeUserId) return;
    const cards = await loadAppCorpus("jira", activeUserId);
    const snapshot = buildInitialSnapshot(cards);

    const stateWithPatches = JSON.parse(JSON.stringify(snapshot)) as JiraSnapshot;
    const patches = getGlobalPatchesForApp("jira");
    patches.forEach((patch) => applyPatch(stateWithPatches, patch));

    set((state) => ({
      projects: { ...state.projects, ...stateWithPatches.projects },
      issues: { ...state.issues, ...stateWithPatches.issues },
    }));
  },
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

      const nextIssue = {
        id: createdId,
        projectId: input.projectId,
        key: `${project.key}-${nextNumber}`,
        number: nextNumber,
        type: input.type,
        summary,
        description: input.description.trim() || "No description provided.",
        status: "Backlog" as const,
        priority: input.priority,
        reporterId: input.actorId,
        assigneeId,
        watcherIds: Array.from(new Set([input.actorId, assigneeId].filter(Boolean) as string[])),
        labels: input.labels,
        sprint: input.sprint,
        storyPoints: input.storyPoints,
        dueDate: input.dueDate,
        createdAt: timestamp,
        updatedAt: timestamp,
        comments: [],
        activity: [activity(input.actorId, "created the issue", timestamp)],
      };

      usePatchStore.getState().appendPatch({
        app: "jira",
        op: "create",
        scope: "jira.issue",
        targetId: createdId,
        actorId: input.actorId,
        payload: nextIssue as unknown as Record<string, unknown>,
      });

      return {
        issues: {
          ...state.issues,
          [createdId]: nextIssue,
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
      mutateIssue(state, issueId, actorId, (issue, timestamp) => {
        const newComment = {
          id: makeId(`${issueId}-comment`),
          authorId: actorId,
          body: trimmed,
          timestamp,
        };
        const nextIssue = {
          ...issue,
          updatedAt: timestamp,
          comments: [...issue.comments, newComment],
          activity: [...issue.activity, activity(actorId, "commented", timestamp)],
        };

        usePatchStore.getState().appendPatch({
          app: "jira",
          op: "create",
          scope: "jira.comment",
          targetId: issueId,
          actorId,
          payload: newComment as unknown as Record<string, unknown>,
        });

        return nextIssue;
      }),
    );
  },
}));
