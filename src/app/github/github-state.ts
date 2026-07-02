"use client";

import { create } from "zustand";

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

const now = Date.now() - 30 * 60 * 1000;

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

function buildInitialSnapshot(): GitHubSnapshot {
  const repos: Record<string, GitHubRepo> = {
    "corp-os": {
      id: "corp-os",
      owner: "corp",
      name: "corp-os",
      description: "Internal operating system connected apps and workflows.",
      language: "TypeScript",
      memberIds: ["riley", "maya", "ari"],
      starredBy: ["riley", "maya"],
      watchedBy: ["riley", "ari"],
      defaultBranch: "main",
    },
    "design-system": {
      id: "design-system",
      owner: "corp",
      name: "design-system",
      description: "Shared primitives, tokens, and shadcn wrappers.",
      language: "TypeScript",
      memberIds: ["riley", "maya"],
      starredBy: ["maya"],
      watchedBy: ["maya"],
      defaultBranch: "main",
    },
    "data-sync": {
      id: "data-sync",
      owner: "corp",
      name: "data-sync",
      description: "Local sync adapter for future local/cloud persistence work.",
      language: "Go",
      memberIds: ["riley", "ari"],
      starredBy: ["ari"],
      watchedBy: ["riley", "ari"],
      defaultBranch: "trunk",
    },
  };

  const issueTitles = [
    "Account switch should scrub stale detail URLs",
    "Add keyboard shortcuts to command surfaces",
    "Attachment preview layout overlaps on mobile",
    "Seed data needs cross-user coverage",
    "Dark mode contrast for status labels",
    "Search operators should compose with filters",
  ];
  const issues: Record<string, GitHubIssue> = {};
  Object.values(repos).forEach((repo, repoIndex) => {
    for (let index = 0; index < 8; index += 1) {
      const id = `${repo.id}-issue-${index + 1}`;
      const issueTimestamp = now - (index + 4) * 45 * 60 * 1000;
      const issueComments = [
        {
          id: `${id}-c1`,
          authorId: repo.memberIds[index % repo.memberIds.length],
          body: "I can reproduce this on the current route.",
          timestamp: issueTimestamp + 22 * 60 * 1000,
        },
        {
          id: `${id}-c2`,
          authorId: repo.memberIds[(index + 2) % repo.memberIds.length],
          body: "Added a proposed acceptance checklist.",
          timestamp: issueTimestamp + 54 * 60 * 1000,
        },
      ];
      issues[id] = {
        id,
        repoId: repo.id,
        number: index + 1,
        title: issueTitles[(index + repoIndex) % issueTitles.length],
        body: "This issue tracks a product-level workflow gap found during QA.",
        status: index % 4 === 0 ? "closed" : "open",
        labels: index % 2 === 0 ? ["bug", "frontend"] : ["enhancement"],
        assigneeIds: [repo.memberIds[index % repo.memberIds.length]],
        authorId: repo.memberIds[(index + 1) % repo.memberIds.length],
        comments: issueComments,
        createdAt: issueTimestamp,
        updatedAt: Math.max(issueTimestamp, ...issueComments.map((item) => item.timestamp)),
        timestamp: issueTimestamp,
      };
    }
  });

  const pulls: Record<string, GitHubPullRequest> = {};
  Object.values(repos).forEach((repo, repoIndex) => {
    for (let index = 0; index < 6; index += 1) {
      const id = `${repo.id}-pr-${index + 1}`;
      const pullTimestamp = now - (index + 3) * 70 * 60 * 1000;
      const pullComments = [
        {
          id: `${id}-c1`,
          authorId: repo.memberIds[(index + 1) % repo.memberIds.length],
          body: "Left one note on the data shape.",
          timestamp: pullTimestamp + 34 * 60 * 1000,
        },
      ];
      pulls[id] = {
        id,
        repoId: repo.id,
        number: index + 21,
        title: [
          "Build app shell",
          "Tighten state selectors",
          "Add privacy reset",
          "Polish mobile panes",
        ][(index + repoIndex) % 4],
        body: "This pull request updates the app surface and includes workflow coverage.",
        status: index === 4 ? "merged" : index === 5 ? "closed" : "open",
        sourceBranch: `feature/app-${index + 1}`,
        targetBranch: repo.defaultBranch,
        authorId: repo.memberIds[index % repo.memberIds.length],
        reviewerIds: repo.memberIds.filter(
          (id) => id !== repo.memberIds[index % repo.memberIds.length],
        ),
        checks: [
          { name: "lint", status: index % 3 === 0 ? "pending" : "passing" },
          { name: "typecheck", status: index % 5 === 0 ? "failing" : "passing" },
          { name: "preview", status: "passing" },
        ],
        changedFiles: [
          {
            path: "src/app/core/App.tsx",
            additions: 180 + index * 12,
            deletions: 20 + index,
          },
          { path: "src/app/core/state.ts", additions: 90 + index * 8, deletions: 4 },
        ],
        comments: pullComments,
        createdAt: pullTimestamp,
        updatedAt: Math.max(pullTimestamp, ...pullComments.map((item) => item.timestamp)),
        timestamp: pullTimestamp,
      };
    }
  });

  const files: Record<string, GitHubFile> = {};
  Object.values(repos).forEach((repo) => {
    [
      [
        "README.md",
        "file",
        `# ${repo.name}\n\n${repo.description}\n\nRun lint and typecheck before merging.`,
      ],
      ["src", "folder", ""],
      ["src/app.tsx", "file", "export function App() {\n  return <main>App surface</main>;\n}\n"],
      ["src/state.ts", "file", "export type State = {\n  ready: boolean;\n};\n"],
      ["package.json", "file", '{\n  "scripts": {\n    "lint": "eslint"\n  }\n}\n'],
    ].forEach(([path, type, content]) => {
      files[`${repo.id}:${path}`] = {
        repoId: repo.id,
        path,
        type: type as "file" | "folder",
        content,
      };
    });
  });

  const notifications: Record<string, GitHubNotification> = {};
  Object.values(issues)
    .slice(0, 12)
    .forEach((issue, index) => {
      const userId = issue.assigneeIds[0];
      notifications[`gh-notif-${index}`] = {
        id: `gh-notif-${index}`,
        repoId: issue.repoId,
        userId,
        title: issue.title,
        reason: index % 2 === 0 ? "assigned" : "mentioned",
        unread: index % 3 !== 0,
        targetType: "issue",
        targetId: issue.id,
        timestamp: issue.timestamp + 20 * 60 * 1000,
      };
    });

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

const initialSnapshot = buildInitialSnapshot();

export const useGitHubStore = create<GitHubState>((set) => ({
  ...initialSnapshot,
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
