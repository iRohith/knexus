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
  loadCorpusEventsFor,
  stableNumber,
} from "@/lib/corpus-app-data";

export type GitHubComment = {
  id: string;
  authorId: string;
  body: string;
  timestamp: number;
};

export type GitHubIssue = {
  id: string;
  repoId: string;
  number: number;
  title: string;
  body: string;
  status: "open" | "closed";
  labels: string[];
  assigneeIds: string[];
  authorId: string;
  comments: GitHubComment[];
  createdAt: number;
  updatedAt: number;
  timestamp: number;
};

export type GitHubPullRequest = {
  id: string;
  repoId: string;
  number: number;
  title: string;
  body: string;
  status: "open" | "merged" | "closed";
  sourceBranch: string;
  targetBranch: string;
  authorId: string;
  reviewerIds: string[];
  checks: Array<{ name: string; status: "passing" | "pending" | "failing" }>;
  changedFiles: Array<{ path: string; additions: number; deletions: number }>;
  comments: GitHubComment[];
  createdAt: number;
  updatedAt: number;
  timestamp: number;
};

export type GitHubRepo = {
  id: string;
  owner: string;
  name: string;
  description: string;
  language: string;
  memberIds: string[];
  starredBy: string[];
  watchedBy: string[];
  defaultBranch: string;
};

export type GitHubFile = {
  repoId: string;
  path: string;
  type: "file" | "folder";
  content: string;
};

export type GitHubNotification = {
  id: string;
  repoId: string;
  userId: string;
  title: string;
  reason: string;
  unread: boolean;
  targetType: "issue" | "pull";
  targetId: string;
  timestamp: number;
};

export type GitHubSnapshot = {
  repos: Record<string, GitHubRepo>;
  issues: Record<string, GitHubIssue>;
  pulls: Record<string, GitHubPullRequest>;
  files: Record<string, GitHubFile>;
  notifications: Record<string, GitHubNotification>;
};

export type GitHubState = GitHubSnapshot & {
  loadCorpusPage: (page?: number) => Promise<void>;
  createIssue: (input: {
    repoId: string;
    authorId: string;
    title: string;
    body: string;
    labels: string[];
    assigneeIds: string[];
  }) => string;
  toggleStar: (repoId: string, userId: string) => void;
  toggleWatch: (repoId: string, userId: string) => void;
  addIssueComment: (issueId: string, userId: string, body: string) => void;
  addPullComment: (pullId: string, userId: string, body: string) => void;
  setIssueStatus: (issueId: string, userId: string, status: "open" | "closed") => void;
  mergePull: (pullId: string, userId: string) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: (userId: string) => void;
  dismissNotification: (notificationId: string, userId: string) => void;
  createPullRequest: (input: {
    repoId: string;
    authorId: string;
    title: string;
    body: string;
    sourceBranch: string;
    targetBranch: string;
  }) => string;
  updateIssueLabels: (issueId: string, userId: string, labels: string[]) => void;
  updateIssueAssignees: (issueId: string, userId: string, assigneeIds: string[]) => void;
  updateFileContent: (repoId: string, path: string, content: string, userId: string) => void;
  createFile: (repoId: string, path: string, content: string, userId: string) => void;
};

export const githubTabs = ["code", "issues", "pulls", "notifications"] as const;
export type GitHubTab = (typeof githubTabs)[number];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function latestIssueActivity(issue: Pick<GitHubIssue, "timestamp" | "comments">) {
  return Math.max(issue.timestamp, ...issue.comments.map((item) => item.timestamp));
}

function latestPullActivity(issue: Pick<GitHubPullRequest, "timestamp" | "comments">) {
  return Math.max(issue.timestamp, ...issue.comments.map((item) => item.timestamp));
}

function buildInitialSnapshot(corpusPulls = corpusEventsFor("github")): GitHubSnapshot {
  if (corpusPulls.length > 0) {
    const memberIds = activeCorpusUserIds();
    const repos: Record<string, GitHubRepo> = {
      redwood: {
        id: "redwood",
        owner: "redwood-inference",
        name: "redwood",
        description: "Redwood Inference product, runtime, console, and deployment platform.",
        language: "TypeScript",
        memberIds,
        starredBy: memberIds.slice(0, 5),
        watchedBy: memberIds.slice(0, 8),
        defaultBranch: "main",
      },
      "runtime-platform": {
        id: "runtime-platform",
        owner: "redwood-inference",
        name: "runtime-platform",
        description: "Inference runtime, routing, scheduling, and observability services.",
        language: "Go",
        memberIds,
        starredBy: memberIds.slice(2, 7),
        watchedBy: memberIds.slice(0, 6),
        defaultBranch: "main",
      },
    };
    const issues: Record<string, GitHubIssue> = {};
    const pulls: Record<string, GitHubPullRequest> = {};
    const files: Record<string, GitHubFile> = {};
    const notifications: Record<string, GitHubNotification> = {};

    Object.values(repos).forEach((repo) => {
      files[`${repo.id}:README.md`] = {
        repoId: repo.id,
        path: "README.md",
        type: "file",
        content: `${repo.name} source records are loaded from the Redwood enterprise corpus.`,
      };
    });

    corpusPulls.forEach((event, index) => {
      const repoId = event.title.toLowerCase().includes("runtime") ? "runtime-platform" : "redwood";
      const repo = repos[repoId];
      const number = Number(event.sourceEntityId.match(/\d+/)?.[0] ?? index + 1);
      const normalizedLabels = corpusNormalizedStrings(event, "labels");
      const labels =
        normalizedLabels.length > 0 ? normalizedLabels : corpusLabels(event, ["implementation"]);
      const issueId = `${repoId}-issue-${number}`;
      const pullId = `${repoId}-pr-${number}`;
      const normalizedReviewers = corpusNormalizedStrings(event, "reviewers")
        .map((name) => corpusUserIdFromName(name, event.actorId))
        .filter((id) => id !== event.actorId);
      const reviewerIds =
        normalizedReviewers.length > 0
          ? normalizedReviewers.slice(0, 3)
          : memberIds.filter((id) => id !== event.actorId).slice(index % 4, (index % 4) + 3);
      const body = corpusNormalizedString(event, "description", corpusText(event, 2200));
      const normalizedState = corpusNormalizedString(event, "state", "").toLowerCase();
      const reviewComments = corpusNormalizedRecords(event, "reviewComments");
      const comments =
        reviewComments.length > 0
          ? reviewComments.slice(0, 4).map((comment, commentIndex) => ({
              id: `${issueId}-comment-${commentIndex + 1}`,
              authorId: corpusUserIdFromName(
                typeof comment.author === "string" ? comment.author : "",
                reviewerIds[commentIndex % Math.max(1, reviewerIds.length)] ?? event.actorId,
              ),
              body: typeof comment.body === "string" ? comment.body : corpusText(event, 900),
              timestamp: event.occurredAt + (commentIndex + 1) * 12 * 60 * 1000,
            }))
          : [
              {
                id: `${issueId}-comment-1`,
                authorId: reviewerIds[0] ?? event.actorId,
                body: "Keep the implementation linked to the upstream customer evidence.",
                timestamp: event.occurredAt + 20 * 60 * 1000,
              },
            ];
      issues[issueId] = {
        id: issueId,
        repoId,
        number,
        title: `Track evidence for ${event.title}`,
        body,
        status: stableNumber(event.id, 4) === 0 ? "closed" : "open",
        labels,
        assigneeIds: [event.actorId, reviewerIds[0]].filter(Boolean),
        authorId: event.actorId,
        comments,
        createdAt: event.occurredAt - 4 * 24 * 60 * 60 * 1000,
        updatedAt: event.occurredAt,
        timestamp: event.occurredAt,
      };
      pulls[pullId] = {
        id: pullId,
        repoId,
        number,
        title: event.title,
        body,
        status:
          normalizedState === "closed"
            ? "closed"
            : normalizedState === "merged" || stableNumber(event.id, 5) !== 0
              ? "merged"
              : "open",
        sourceBranch: `feature/${event.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 42)}`,
        targetBranch: repo.defaultBranch,
        authorId: event.actorId,
        reviewerIds,
        checks: [
          { name: "unit", status: "passing" },
          { name: "integration", status: stableNumber(event.id, 6) === 0 ? "pending" : "passing" },
          { name: "security", status: stableNumber(event.id, 9) === 0 ? "failing" : "passing" },
        ],
        changedFiles: [
          {
            path: `src/${labels[0] ?? "runtime"}/${event.sourceEntityId}.ts`,
            additions: 80 + stableNumber(event.id, 320),
            deletions: stableNumber(event.id, 90),
          },
          {
            path: `docs/${labels[1] ?? "decision"}/${event.sourceEntityId}.md`,
            additions: 20 + stableNumber(event.title, 160),
            deletions: stableNumber(event.title, 40),
          },
        ],
        comments: comments.map((comment) => ({
          ...comment,
          id: comment.id.replace(issueId, pullId),
        })),
        createdAt: event.occurredAt - 3 * 24 * 60 * 60 * 1000,
        updatedAt: event.occurredAt,
        timestamp: event.occurredAt,
      };

      reviewerIds.slice(0, 2).forEach((userId, notificationIndex) => {
        const notificationId = `${pullId}-notification-${notificationIndex + 1}`;
        notifications[notificationId] = {
          id: notificationId,
          repoId,
          userId,
          title: event.title,
          reason: "review requested",
          unread: notificationIndex === 0,
          targetType: "pull",
          targetId: pullId,
          timestamp: event.occurredAt,
        };
      });
    });

    return { repos, issues, pulls, files, notifications };
  }

  return { repos: {}, issues: {}, pulls: {}, files: {}, notifications: {} };
}

export function canAccessRepo(repo: GitHubRepo | undefined, userId: string) {
  return Boolean(repo?.memberIds.includes(userId));
}

export function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return "just now";
  const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

export function formatGitHubTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function issueActivityTime(issue: GitHubIssue) {
  return issue.updatedAt ?? latestIssueActivity(issue);
}

export function pullActivityTime(pull: GitHubPullRequest) {
  return pull.updatedAt ?? latestPullActivity(pull);
}

const initialSnapshot = buildInitialSnapshot();

export const useGitHubStore = create<GitHubState>((set) => ({
  ...initialSnapshot,
  loadCorpusPage: async (page = 1) => {
    const events = await loadCorpusEventsFor("github", page);
    const snapshot = buildInitialSnapshot(events);
    set((state) => ({
      repos: { ...state.repos, ...snapshot.repos },
      issues: { ...state.issues, ...snapshot.issues },
      pulls: { ...state.pulls, ...snapshot.pulls },
      files: { ...state.files, ...snapshot.files },
      notifications: { ...state.notifications, ...snapshot.notifications },
    }));
  },
  createIssue: ({ repoId, authorId, title, body, labels, assigneeIds }) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return "";

    let issueId = "";
    set((state) => {
      const repo = state.repos[repoId];
      if (!canAccessRepo(repo, authorId)) return state;

      const nextNumber =
        Math.max(
          0,
          ...Object.values(state.issues)
            .filter((issue) => issue.repoId === repoId)
            .map((issue) => issue.number),
        ) + 1;
      issueId = makeId(`${repoId}-issue`);
      const validAssignees = assigneeIds.filter((id) => repo.memberIds.includes(id));
      const timestamp = Date.now();

      return {
        issues: {
          ...state.issues,
          [issueId]: {
            id: issueId,
            repoId,
            number: nextNumber,
            title: trimmedTitle,
            body: body.trim() || "No description provided.",
            status: "open",
            labels,
            assigneeIds: validAssignees,
            authorId,
            comments: [],
            createdAt: timestamp,
            updatedAt: timestamp,
            timestamp,
          },
        },
        notifications: validAssignees.reduce((notifications, userId) => {
          const notificationId = makeId("gh-notif");
          return {
            ...notifications,
            [notificationId]: {
              id: notificationId,
              repoId,
              userId,
              title: trimmedTitle,
              reason: userId === authorId ? "created" : "assigned",
              unread: userId !== authorId,
              targetType: "issue" as const,
              targetId: issueId,
              timestamp: Date.now(),
            },
          };
        }, state.notifications),
      };
    });

    return issueId;
  },
  toggleStar: (repoId, userId) => {
    set((state) => {
      const repo = state.repos[repoId];
      if (!canAccessRepo(repo, userId)) return state;
      const starred = repo.starredBy.includes(userId);
      return {
        repos: {
          ...state.repos,
          [repoId]: {
            ...repo,
            starredBy: starred
              ? repo.starredBy.filter((id) => id !== userId)
              : [...repo.starredBy, userId],
          },
        },
      };
    });
  },
  toggleWatch: (repoId, userId) => {
    set((state) => {
      const repo = state.repos[repoId];
      if (!canAccessRepo(repo, userId)) return state;
      const watched = repo.watchedBy.includes(userId);
      return {
        repos: {
          ...state.repos,
          [repoId]: {
            ...repo,
            watchedBy: watched
              ? repo.watchedBy.filter((id) => id !== userId)
              : [...repo.watchedBy, userId],
          },
        },
      };
    });
  },
  addIssueComment: (issueId, userId, body) => {
    set((state) => {
      const issue = state.issues[issueId];
      if (!body.trim() || !canAccessRepo(state.repos[issue?.repoId], userId)) return state;
      const timestamp = Date.now();
      return {
        issues: {
          ...state.issues,
          [issueId]: {
            ...issue,
            comments: [
              ...issue.comments,
              {
                id: makeId(`${issueId}-c`),
                authorId: userId,
                body: body.trim(),
                timestamp,
              },
            ],
            updatedAt: timestamp,
          },
        },
      };
    });
  },
  addPullComment: (pullId, userId, body) => {
    set((state) => {
      const pull = state.pulls[pullId];
      if (!body.trim() || !canAccessRepo(state.repos[pull?.repoId], userId)) return state;
      const timestamp = Date.now();
      return {
        pulls: {
          ...state.pulls,
          [pullId]: {
            ...pull,
            comments: [
              ...pull.comments,
              {
                id: makeId(`${pullId}-c`),
                authorId: userId,
                body: body.trim(),
                timestamp,
              },
            ],
            updatedAt: timestamp,
          },
        },
      };
    });
  },
  setIssueStatus: (issueId, userId, status) => {
    set((state) => {
      const issue = state.issues[issueId];
      if (!canAccessRepo(state.repos[issue?.repoId], userId)) return state;
      return {
        issues: { ...state.issues, [issueId]: { ...issue, status, updatedAt: Date.now() } },
      };
    });
  },
  mergePull: (pullId, userId) => {
    set((state) => {
      const pull = state.pulls[pullId];
      if (!canAccessRepo(state.repos[pull?.repoId], userId) || pull.status !== "open") return state;
      const timestamp = Date.now();
      return {
        pulls: {
          ...state.pulls,
          [pullId]: {
            ...pull,
            status: "merged",
            comments: [
              ...pull.comments,
              {
                id: makeId(`${pullId}-merge`),
                authorId: userId,
                body: "Merged this pull request.",
                timestamp,
              },
            ],
            updatedAt: timestamp,
          },
        },
      };
    });
  },
  markNotificationRead: (notificationId) => {
    set((state) => {
      const notification = state.notifications[notificationId];
      if (!notification) return state;
      return {
        notifications: {
          ...state.notifications,
          [notificationId]: { ...notification, unread: false },
        },
      };
    });
  },
  markAllNotificationsRead: (userId) => {
    set((state) => {
      const notifications = { ...state.notifications };
      Object.keys(notifications).forEach((id) => {
        if (notifications[id].userId === userId) {
          notifications[id] = { ...notifications[id], unread: false };
        }
      });
      return { notifications };
    });
  },
  dismissNotification: (notificationId, userId) => {
    set((state) => {
      const notification = state.notifications[notificationId];
      if (!notification || notification.userId !== userId) return state;
      const notifications = { ...state.notifications };
      delete notifications[notificationId];
      return { notifications };
    });
  },
  createPullRequest: (input) => {
    const id = makeId("github-pr");
    const timestamp = Date.now();
    set((state) => {
      if (!canAccessRepo(state.repos[input.repoId], input.authorId)) return state;
      return {
        pulls: {
          ...state.pulls,
          [id]: {
            id,
            repoId: input.repoId,
            number: Object.keys(state.pulls).length + Object.keys(state.issues).length + 1,
            title: input.title.trim(),
            body: input.body.trim(),
            status: "open",
            sourceBranch: input.sourceBranch,
            targetBranch: input.targetBranch,
            authorId: input.authorId,
            reviewerIds: [],
            checks: [],
            changedFiles: [],
            comments: [],
            createdAt: timestamp,
            updatedAt: timestamp,
            timestamp,
          },
        },
      };
    });
    return id;
  },
  updateIssueLabels: (issueId, userId, labels) => {
    set((state) => {
      const issue = state.issues[issueId];
      if (!issue || !canAccessRepo(state.repos[issue.repoId], userId)) return state;
      return {
        issues: {
          ...state.issues,
          [issueId]: { ...issue, labels, updatedAt: Date.now() },
        },
      };
    });
  },
  updateIssueAssignees: (issueId, userId, assigneeIds) => {
    set((state) => {
      const issue = state.issues[issueId];
      if (!issue || !canAccessRepo(state.repos[issue.repoId], userId)) return state;
      return {
        issues: {
          ...state.issues,
          [issueId]: { ...issue, assigneeIds, updatedAt: Date.now() },
        },
      };
    });
  },
  updateFileContent: (repoId, path, content, userId) => {
    set((state) => {
      if (!canAccessRepo(state.repos[repoId], userId)) return state;
      const fileId = `${repoId}-${path}`;
      const file = state.files[fileId];
      if (!file) return state;
      return {
        files: {
          ...state.files,
          [fileId]: { ...file, content },
        },
      };
    });
  },
  createFile: (repoId, path, content, userId) => {
    set((state) => {
      if (!canAccessRepo(state.repos[repoId], userId)) return state;
      const fileId = `${repoId}-${path}`;
      return {
        files: {
          ...state.files,
          [fileId]: { repoId, path, type: "file", content },
        },
      };
    });
  },
}));
