"use client";

import { create } from "zustand";

import { SeedCard, loadAppCorpus } from "@/lib/seed-data";
import { usePatchStore, getGlobalPatchesForApp, type AppPatch } from "@/lib/stores/patch-store";
import { useUserStore } from "@/lib/stores/user-store";
import { appUsers } from "@/lib/users";

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
  loadCorpusPage: () => Promise<void>;
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

function buildInitialSnapshot(cards: SeedCard[] = []): LinearSnapshot {
  const memberIds = appUsers.map((u) => u.id);
  const teams: Record<string, LinearTeam> = {
    "product-management": {
      id: "product-management",
      key: "PROD",
      name: "Product",
      description: "Knexus Product Management, planning, and roadmapping.",
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
      targetDate: new Date(Date.UTC(2026, 8 + index, 15)).toISOString().split("T")[0],
      health: (["On track", "At risk", "On track"] as const)[index],
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
  if (cards.length > 0) {
    cards.forEach((card, index) => {
      const text = `${card.title} ${card.text}`.toLowerCase();
      const teamId = text.includes("design")
        ? "design"
        : text.includes("runtime")
          ? "engineering"
          : "product-management";
      const team = teams[teamId];
      const number = index + 1;
      const assigneeId = card.peopleIds[0] ?? memberIds[0];
      const status = (
        ["Backlog", "Todo", "In Progress", "In Review", "Done", "Canceled"] as LinearStatus[]
      )[index % 6];
      const priority = (["Urgent", "High", "Medium", "Low", "No priority"] as LinearPriority[])[
        index % 5
      ];
      const labels = ["feature", "ux"];

      const id = card.id;
      issues[id] = {
        id,
        teamId,
        projectId: `${teamId}-evidence`,
        cycleId: `${teamId}-cycle`,
        number,
        identifier: `${team.key}-${number}`,
        title: card.title,
        description: card.text || "No description provided.",
        status,
        priority,
        assigneeId,
        creatorId: assigneeId,
        subscriberIds: Array.from(new Set([assigneeId, ...memberIds.slice(0, 4)])),
        labels,
        estimate: [1, 2, 3, 5, 8][index % 5],
        createdAt: card.occurredAt - (2 + index) * 24 * 60 * 60 * 1000,
        updatedAt: card.occurredAt,
        comments: [
          note(
            assigneeId,
            "Mapped to related Redwood customer evidence for follow-up.",
            card.occurredAt + 15 * 60 * 1000,
          ),
        ],
        activity: [
          note(assigneeId, `created the issue`, card.occurredAt - 20 * 60 * 1000),
          note(assigneeId, `updated status to ${status}`, card.occurredAt),
        ],
      };
    });
  }

  return { teams, projects, cycles, issues };
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
  const nextIssue = mutate(issue, timestamp);

  usePatchStore.getState().appendPatch({
    app: "linear",
    op: "update",
    scope: "linear.issue",
    targetId: issueId,
    actorId,
    payload: nextIssue as unknown as Record<string, unknown>,
  });

  return { issues: { ...state.issues, [issueId]: nextIssue } };
}

function applyPatch(state: LinearSnapshot, patch: AppPatch) {
  if (patch.scope === "linear.issue" && patch.op === "create") {
    const issue = patch.payload as unknown as LinearIssue;
    state.issues[issue.id] = issue;
  } else if (patch.scope === "linear.issue" && patch.op === "update") {
    if (state.issues[patch.targetId]) {
      state.issues[patch.targetId] = { ...state.issues[patch.targetId], ...patch.payload };
    }
  } else if (patch.scope === "linear.comment" && patch.op === "create") {
    const issue = state.issues[patch.targetId];
    if (issue) {
      issue.comments.push(patch.payload as LinearComment);
    }
  }
}

usePatchStore.subscribe((state, prevState) => {
  if (state.batches === prevState.batches) return;
  const newBatches = state.batches.filter((b) => !prevState.batches.includes(b));
  if (newBatches.length === 0) return;
  const newPatches = newBatches.flatMap((b) => b.patches).filter((p) => p.app === "linear");
  if (newPatches.length === 0) return;

  useLinearStore.setState((draftState: LinearState) => {
    const nextState = JSON.parse(JSON.stringify(draftState));
    newPatches.forEach((patch) => applyPatch(nextState, patch));
    return nextState;
  });
});

const initialSnapshot = buildInitialSnapshot();

export const useLinearStore = create<LinearState>((set) => ({
  ...initialSnapshot,
  loadCorpusPage: async () => {
    const activeUserId = useUserStore.getState().activeUserId;
    if (!activeUserId) return;
    const cards = await loadAppCorpus("linear", activeUserId);
    const snapshot = buildInitialSnapshot(cards);

    const stateWithPatches = JSON.parse(JSON.stringify(snapshot)) as LinearSnapshot;
    const patches = getGlobalPatchesForApp("linear");
    patches.forEach((patch) => applyPatch(stateWithPatches, patch));

    set((state) => ({
      teams: { ...state.teams, ...stateWithPatches.teams },
      projects: { ...state.projects, ...stateWithPatches.projects },
      cycles: { ...state.cycles, ...stateWithPatches.cycles },
      issues: { ...state.issues, ...stateWithPatches.issues },
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
      const nextIssue = {
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
        subscriberIds: Array.from(new Set([input.actorId, assigneeId].filter(Boolean) as string[])),
        labels: input.labels,
        estimate: input.estimate,
        createdAt: timestamp,
        updatedAt: timestamp,
        comments: [],
        activity: [note(input.actorId, "created the issue", timestamp)],
      };

      usePatchStore.getState().appendPatch({
        app: "linear",
        op: "create",
        scope: "linear.issue",
        targetId: id,
        actorId: input.actorId,
        payload: nextIssue as unknown as Record<string, unknown>,
      });

      return {
        issues: {
          ...state.issues,
          [id]: nextIssue,
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
          activity: [...issue.activity, note(actorId, "commented", timestamp)],
        };

        usePatchStore.getState().appendPatch({
          app: "linear",
          op: "create",
          scope: "linear.comment",
          targetId: issueId,
          actorId,
          payload: newComment as unknown as Record<string, unknown>,
        });

        return nextIssue;
      }),
    );
  },
}));
