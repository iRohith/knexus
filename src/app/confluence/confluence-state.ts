"use client";

import { create } from "zustand";

import {
  activeCorpusUserIds,
  corpusEventsFor,
  corpusLabels,
  corpusNormalizedString,
  corpusNormalizedStrings,
  corpusText,
  loadCorpusEventsFor,
  stableNumber,
} from "@/lib/corpus-app-data";

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
  loadCorpusPage: (page?: number) => Promise<void>;
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

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function comment(authorId: string, body: string, timestamp: number): ConfluenceComment {
  return { id: makeId("conf-comment"), authorId, body, timestamp };
}

function buildInitialSnapshot(corpusPages = corpusEventsFor("confluence")): ConfluenceSnapshot {
  if (corpusPages.length > 0) {
    const memberIds = activeCorpusUserIds();
    const spaces: Record<string, ConfluenceSpace> = {};
    const pages: Record<string, ConfluencePage> = {};

    corpusPages.forEach((event, index) => {
      const path = typeof event.metadata.sourcePath === "string" ? event.metadata.sourcePath : "";
      const spaceId = path.split("/")[2]?.replace(/_/g, "-") || "redwood-knowledge";
      if (!spaces[spaceId]) {
        spaces[spaceId] = {
          id: spaceId,
          key: spaceId
            .split("-")
            .map((part) => part[0])
            .join("")
            .slice(0, 6)
            .toUpperCase(),
          name: spaceId
            .split("-")
            .map((part) => part[0].toUpperCase() + part.slice(1))
            .join(" "),
          description: "Redwood Inference knowledge base content from the enterprise corpus.",
          memberIds,
        };
      }

      pages[event.sourceEntityId] = {
        id: event.sourceEntityId,
        spaceId,
        parentId: null,
        title: event.title,
        body: corpusNormalizedString(event, "content", corpusText(event, 2600)),
        authorId: event.actorId,
        ownerId: event.actorId,
        labels:
          corpusNormalizedStrings(event, "labels").length > 0
            ? corpusNormalizedStrings(event, "labels")
            : corpusLabels(event, ["redwood", "knowledge"]),
        watchers: memberIds.slice(0, 4),
        createdAt: event.occurredAt - (stableNumber(event.id, 14) + 1) * 24 * 60 * 60 * 1000,
        updatedAt: event.occurredAt,
        comments:
          index % 3 === 0
            ? [
                {
                  id: `${event.sourceEntityId}-comment-1`,
                  authorId: memberIds[(index + 1) % memberIds.length],
                  body: "Linked back to related customer evidence and implementation work.",
                  timestamp: event.occurredAt + 20 * 60 * 1000,
                },
              ]
            : [],
      };
    });

    return { spaces, pages };
  }

  return { spaces: {}, pages: {} };
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
  loadCorpusPage: async (page = 1) => {
    const events = await loadCorpusEventsFor("confluence", page);
    const snapshot = buildInitialSnapshot(events);
    set((state) => ({
      spaces: { ...state.spaces, ...snapshot.spaces },
      pages: { ...state.pages, ...snapshot.pages },
    }));
  },
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
