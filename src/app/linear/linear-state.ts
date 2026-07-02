"use client";

import { create } from "zustand";

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

const now = Date.now() - 40 * 60 * 1000;

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function note(authorId: string, body: string, timestamp: number): LinearComment {
  return { id: makeId("lin-note"), authorId, body, timestamp };
}

function buildInitialSnapshot(): LinearSnapshot {
  const teams: Record<string, LinearTeam> = {
    core: {
      id: "core",
      key: "COR",
      name: "Core Product",
      description: "Replica fidelity, navigation, and shared shell.",
      memberIds: ["riley", "maya", "ari"],
    },
    design: {
      id: "design",
      key: "DSN",
      name: "Design Systems",
      description: "Components, tokens, accessibility, and polish.",
      memberIds: ["riley", "maya"],
    },
    infra: {
      id: "infra",
      key: "INF",
      name: "Infrastructure",
      description: "Sync, auth boundaries, build health, and deployment.",
      memberIds: ["riley", "ari"],
    },
  };
  const projects: Record<string, LinearProject> = {};
  const cycles: Record<string, LinearCycle> = {};
  Object.values(teams).forEach((team, index) => {
    projects[`${team.id}-replicas`] = {
      id: `${team.id}-replicas`,
      teamId: team.id,
      name: "App replicas",
      targetDate: "2026-07-22",
      health: index === 2 ? "At risk" : "On track",
    };
    projects[`${team.id}-quality`] = {
      id: `${team.id}-quality`,
      teamId: team.id,
      name: "Quality pass",
      targetDate: "2026-08-02",
      health: index === 1 ? "On track" : "At risk",
    };
    cycles[`${team.id}-cycle-1`] = {
      id: `${team.id}-cycle-1`,
      teamId: team.id,
      name: "Cycle 28",
      startsAt: "2026-07-01",
      endsAt: "2026-07-14",
    };
    cycles[`${team.id}-cycle-2`] = {
      id: `${team.id}-cycle-2`,
      teamId: team.id,
      name: "Cycle 29",
      startsAt: "2026-07-15",
      endsAt: "2026-07-28",
    };
  });

  const titles = [
    "Tighten URL state when switching accounts",
    "Build realistic command palette fixtures",
    "Add list density controls for issue rows",
    "Fix board card overflow on mobile",
    "Improve empty states for filtered views",
    "Add optimistic comments to detail pane",
    "Polish dark mode priority colors",
    "Create regression checklist for route privacy",
    "Make activity stream scannable",
    "Add project health summary widgets",
  ];
  const issues: Record<string, LinearIssue> = {};
  Object.values(teams).forEach((team, teamIndex) => {
    for (let index = 0; index < 20; index += 1) {
      const timestamp = now - (teamIndex * 20 + index + 2) * 38 * 60 * 1000;
      const id = `${team.id}-issue-${index + 1}`;
      const status = linearStatuses[(index + teamIndex) % linearStatuses.length];
      const creatorId = team.memberIds[(index + teamIndex) % team.memberIds.length];
      const assigneeId = team.memberIds[(index + 1) % team.memberIds.length];
      const projectId = index % 2 === 0 ? `${team.id}-replicas` : `${team.id}-quality`;
      const cycleId = index % 3 === 0 ? `${team.id}-cycle-2` : `${team.id}-cycle-1`;
      const comments =
        index % 4 === 0
          ? [
              note(
                assigneeId,
                "I added the implementation notes and a verification path.",
                timestamp + 25 * 60 * 1000,
              ),
            ]
          : [];
      issues[id] = {
        id,
        teamId: team.id,
        projectId,
        cycleId,
        number: index + 1,
        identifier: `${team.key}-${index + 1}`,
        title: titles[(index + teamIndex) % titles.length],
        description:
          "Keep this scoped to product behavior, keyboard access, and realistic mock state.",
        status,
        priority: linearPriorities[(index + teamIndex) % linearPriorities.length],
        assigneeId,
        creatorId,
        subscriberIds: Array.from(new Set([creatorId, assigneeId])),
        labels: [
          ["frontend", "backend", "ux"][index % 3],
          ["privacy", "quality", "release"][index % 3],
        ],
        estimate: index % 5 === 0 ? null : [1, 2, 3, 5, 8][index % 5],
        createdAt: timestamp,
        updatedAt: Math.max(timestamp, ...comments.map((comment) => comment.timestamp)),
        comments,
        activity: [
          note(creatorId, "created the issue", timestamp),
          note(assigneeId, `moved to ${status}`, timestamp + 10 * 60 * 1000),
        ],
      };
    }
  });
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
  return { issues: { ...state.issues, [issueId]: mutate(issue, timestamp) } };
}

const initialSnapshot = buildInitialSnapshot();

export const useLinearStore = create<LinearState>((set) => ({
  ...initialSnapshot,
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
