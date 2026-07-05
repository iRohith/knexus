/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { create } from "zustand";

import { SeedCard, loadAppCorpus } from "@/lib/seed-data";
import { usePatchStore, getGlobalPatchesForApp } from "@/lib/stores/patch-store";
import { useUserStore } from "@/lib/stores/user-store";
import { appUsers } from "@/lib/users";

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
  loadCorpusPage: () => Promise<void>;
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

function buildInitialSnapshot(cards: SeedCard[] = []): GitHubSnapshot {
  const repos: Record<string, GitHubRepo> = {};
  const issues: Record<string, GitHubIssue> = {};
  const pulls: Record<string, GitHubPullRequest> = {};
  const files: Record<string, GitHubFile> = {};
  const notifications: Record<string, GitHubNotification> = {};

  if (cards.length > 0) {
    const memberIds = appUsers.map((u) => u.id);

    cards.forEach((card, index) => {
      const repoId = card.routeKey.split("/").pop() || "redwood";
      const authorId = card.peopleIds[0] ?? memberIds[0];

      if (!repos[repoId]) {
        repos[repoId] = {
          id: repoId,
          owner: "redwood-inference",
          name: repoId,
          description: "Repository",
          language: "TypeScript",
          memberIds,
          starredBy: memberIds.slice(0, 5),
          watchedBy: memberIds.slice(0, 8),
          defaultBranch: "main",
        };
      }
      const source = (card.source as any) || {};
      // The seed dataset only contains PRs, so we artificially allocate 1/3 of them as Issues to populate the UI.
      const isPR = index % 3 !== 0;
      const rawState = source.state?.toLowerCase() || "open";
      const prStatus = source.merged || source.merged_at ? "merged" : rawState;

      if (isPR) {
        pulls[card.id] = {
          id: card.id,
          repoId,
          number: source.number || index + 100,
          title: card.title || "PR",
          body: card.text || "",
          status: prStatus === "closed" ? "closed" : prStatus === "merged" ? "merged" : "open",
          sourceBranch: "feature",
          targetBranch: "main",
          authorId,
          reviewerIds: memberIds.slice(1, 3),
          checks: [],
          changedFiles: [],
          comments: [],
          createdAt: card.occurredAt - 24 * 60 * 60 * 1000,
          updatedAt: card.occurredAt,
          timestamp: card.occurredAt,
        };
      } else {
        issues[card.id] = {
          id: card.id,
          repoId,
          number: source.number || index + 100,
          title: card.title || "Issue",
          body: card.text || "",
          status: rawState === "closed" ? "closed" : "open",
          authorId,
          assigneeIds: [],
          labels: [],
          comments: [],
          createdAt: card.occurredAt - 24 * 60 * 60 * 1000,
          updatedAt: card.occurredAt,
          timestamp: card.occurredAt,
        };
      }
    });
  }

  return { repos, issues, pulls, files, notifications };
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

function applyPatch(state: any, patch: any) {
  if ((patch as any).type === "create" && patch.scope === "github.pr") {
    state.pulls[patch.targetId] = patch.payload as any;
  }
}

usePatchStore.subscribe((state, prevState) => {
  if (state.batches === prevState.batches) return;
  const newBatches = state.batches.filter((b) => !prevState.batches.includes(b));
  if (newBatches.length === 0) return;
  const newPatches = newBatches.flatMap((b) => b.patches).filter((p) => p.app === "github");
  if (newPatches.length === 0) return;

  useGitHubStore.setState((draftState: any) => {
    const nextState = JSON.parse(JSON.stringify(draftState));
    newPatches.forEach((patch) => applyPatch(nextState, patch));
    return nextState;
  });
});

const initialSnapshot = buildInitialSnapshot();

export const useGitHubStore = create<GitHubState>((set) => ({
  ...initialSnapshot,
  loadCorpusPage: async () => {
    const activeUserId = useUserStore.getState().activeUserId;
    if (!activeUserId) return;
    const pageData = await loadAppCorpus("github", activeUserId);
    if (!pageData) return;
    const snapshot = buildInitialSnapshot(pageData);

    const stateWithPatches = JSON.parse(JSON.stringify(snapshot)) as GitHubSnapshot;
    const patches = getGlobalPatchesForApp("github");
    patches.forEach((patch) => applyPatch(stateWithPatches, patch));

    set((state: any) => ({
      repos: { ...state.repos, ...stateWithPatches.repos },
      pulls: { ...state.pulls, ...stateWithPatches.pulls },
      issues: { ...state.issues, ...stateWithPatches.issues },
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
    const title = input.title.trim();
    if (!title) return "";
    const id = makeId("gh-pull");
    usePatchStore.getState().appendPatch({
      app: "github",
      op: "create",
      scope: "github.pr",
      targetId: id,
      actorId: input.authorId,
      payload: { ...input, id, title },
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
