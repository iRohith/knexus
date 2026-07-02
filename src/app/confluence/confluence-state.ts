"use client";

import { create } from "zustand";

export type ConfluenceSpace = {
  id: string;
  key: string;
  name: string;
  description: string;
  memberIds: string[];
};

export type ConfluenceComment = {
  id: string;
  authorId: string;
  body: string;
  timestamp: number;
};

export type ConfluencePage = {
  id: string;
  spaceId: string;
  parentId: string | null;
  title: string;
  body: string;
  authorId: string;
  ownerId: string;
  labels: string[];
  watchers: string[];
  updatedAt: number;
  createdAt: number;
  comments: ConfluenceComment[];
};

export type ConfluenceSnapshot = {
  spaces: Record<string, ConfluenceSpace>;
  pages: Record<string, ConfluencePage>;
};

export type ConfluenceState = ConfluenceSnapshot & {
  createPage: (input: {
    spaceId: string;
    actorId: string;
    parentId: string | null;
    title: string;
    body: string;
    labels: string[];
  }) => string;
  updatePage: (pageId: string, actorId: string, title: string, body: string) => void;
  addComment: (pageId: string, actorId: string, body: string) => void;
  toggleWatch: (pageId: string, actorId: string) => void;
};

const now = Date.now() - 35 * 60 * 1000;

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function comment(authorId: string, body: string, timestamp: number): ConfluenceComment {
  return { id: makeId("conf-comment"), authorId, body, timestamp };
}

function buildInitialSnapshot(): ConfluenceSnapshot {
  const spaces: Record<string, ConfluenceSpace> = {
    product: {
      id: "product",
      key: "PROD",
      name: "Product Handbook",
      description: "Product strategy, specs, and launch rituals.",
      memberIds: ["riley", "maya"],
    },
    engineering: {
      id: "engineering",
      key: "ENG",
      name: "Engineering",
      description: "Architecture, runbooks, and implementation notes.",
      memberIds: ["riley", "ari"],
    },
    company: {
      id: "company",
      key: "CORP",
      name: "Company Wiki",
      description: "Operating rhythm, decisions, and team process.",
      memberIds: ["riley", "maya", "ari"],
    },
  };
  const pages: Record<string, ConfluencePage> = {};
  Object.values(spaces).forEach((space, spaceIndex) => {
    for (let index = 0; index < 10; index += 1) {
      const timestamp = now - (spaceIndex * 10 + index + 1) * 5 * 60 * 60 * 1000;
      const ownerId = space.memberIds[(index + spaceIndex) % space.memberIds.length];
      const id = `${space.id}-page-${index + 1}`;
      pages[id] = {
        id,
        spaceId: space.id,
        parentId: index > 2 ? `${space.id}-page-${(index % 3) + 1}` : null,
        title: [
          "App quality bar",
          "Release checklist",
          "Account switching privacy",
          "Design review notes",
          "Incident response runbook",
          "Data standards",
        ][(index + spaceIndex) % 6],
        body: "This page captures the current working agreement, implementation details, risks, and acceptance criteria for the team. Keep examples realistic and decisions easy to scan.",
        authorId: ownerId,
        ownerId,
        labels: [
          ["spec", "runbook", "decision"][index % 3],
          ["frontend", "process", "security"][index % 3],
        ],
        watchers: Array.from(new Set([ownerId, ...space.memberIds.slice(0, 1)])),
        createdAt: timestamp,
        updatedAt: timestamp + 34 * 60 * 1000,
        comments:
          index % 3 === 0
            ? [
                comment(
                  space.memberIds[(index + 1) % space.memberIds.length],
                  "Added one follow-up and a clearer acceptance note.",
                  timestamp + 34 * 60 * 1000,
                ),
              ]
            : [],
      };
    }
  });
  return { spaces, pages };
}

export function canAccessSpace(space: ConfluenceSpace | undefined, userId: string) {
  return Boolean(space?.memberIds.includes(userId));
}

export function canAccessPage(
  snapshot: ConfluenceSnapshot,
  page: ConfluencePage | undefined,
  userId: string,
) {
  return Boolean(page && canAccessSpace(snapshot.spaces[page.spaceId], userId));
}

export function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return "just now";
  const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

const initialSnapshot = buildInitialSnapshot();

export const useConfluenceStore = create<ConfluenceState>((set) => ({
  ...initialSnapshot,
  createPage: (input) => {
    const title = input.title.trim();
    if (!title) return "";
    let id = "";
    set((state) => {
      if (!canAccessSpace(state.spaces[input.spaceId], input.actorId)) return state;
      id = makeId("conf-page");
      const timestamp = Date.now();
      return {
        pages: {
          ...state.pages,
          [id]: {
            id,
            spaceId: input.spaceId,
            parentId: input.parentId,
            title,
            body: input.body.trim() || "Draft page body.",
            authorId: input.actorId,
            ownerId: input.actorId,
            labels: input.labels,
            watchers: [input.actorId],
            createdAt: timestamp,
            updatedAt: timestamp,
            comments: [],
          },
        },
      };
    });
    return id;
  },
  updatePage: (pageId, actorId, title, body) => {
    set((state) => {
      const page = state.pages[pageId];
      if (!canAccessPage(state, page, actorId)) return state;
      return {
        pages: {
          ...state.pages,
          [pageId]: {
            ...page,
            title: title.trim() || page.title,
            body: body.trim() || page.body,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  addComment: (pageId, actorId, body) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    set((state) => {
      const page = state.pages[pageId];
      if (!canAccessPage(state, page, actorId)) return state;
      const timestamp = Date.now();
      return {
        pages: {
          ...state.pages,
          [pageId]: {
            ...page,
            updatedAt: timestamp,
            comments: [...page.comments, comment(actorId, trimmed, timestamp)],
          },
        },
      };
    });
  },
  toggleWatch: (pageId, actorId) => {
    set((state) => {
      const page = state.pages[pageId];
      if (!canAccessPage(state, page, actorId)) return state;
      const watching = page.watchers.includes(actorId);
      return {
        pages: {
          ...state.pages,
          [pageId]: {
            ...page,
            watchers: watching
              ? page.watchers.filter((id) => id !== actorId)
              : [...page.watchers, actorId],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
}));
