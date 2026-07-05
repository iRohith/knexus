/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { create } from "zustand";

import { SeedCard, loadAppCorpus } from "@/lib/seed-data";
import { usePatchStore, getGlobalPatchesForApp } from "@/lib/stores/patch-store";
import { useUserStore } from "@/lib/stores/user-store";
import { appUsers } from "@/lib/users";

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
  loadCorpusPage: () => Promise<void>;
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

function buildInitialSnapshot(cards: SeedCard[] = []): ConfluenceSnapshot {
  const spaces: Record<string, ConfluenceSpace> = {};
  const pages: Record<string, ConfluencePage> = {};

  if (cards.length > 0) {
    const memberIds = appUsers.map((u) => u.id);
    cards.forEach((card) => {
      const spaceId = card.routeKey.split("/").pop() || "engineering";
      if (!spaces[spaceId]) {
        spaces[spaceId] = {
          id: spaceId,
          key: spaceId.slice(0, 6).toUpperCase(),
          name: spaceId
            .split("-")
            .map((p) => p[0].toUpperCase() + p.slice(1))
            .join(" "),
          description: "Confluence space",
          memberIds,
        };
      }

      const authorId = card.peopleIds[0] ?? memberIds[0];

      pages[card.id] = {
        id: card.id,
        spaceId,
        parentId: null,
        title: card.title || "Untitled Page",
        body: card.text || "",
        authorId,
        ownerId: authorId,
        labels: [],
        watchers: memberIds.slice(0, 4),
        createdAt: card.occurredAt - 24 * 60 * 60 * 1000,
        updatedAt: card.occurredAt,
        comments: [],
      };
    });
  }

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

function applyPatch(state: any, patch: any) {
  if ((patch as any).type === "create" && patch.scope === "confluence.page") {
    state.pages[patch.targetId] = patch.payload as any;
  } else if ((patch as any).type === "update" && patch.scope === "confluence.page") {
    if (state.pages[patch.targetId]) {
      state.pages[patch.targetId] = { ...state.pages[patch.targetId], ...patch.payload };
    }
  } else if ((patch as any).type === "create" && patch.scope === "confluence.comment") {
    if (state.pages[patch.targetId]) {
      state.pages[patch.targetId].comments.push(patch.payload as any);
    }
  }
}

usePatchStore.subscribe((state, prevState) => {
  if (state.batches === prevState.batches) return;
  const newBatches = state.batches.filter((b) => !prevState.batches.includes(b));
  if (newBatches.length === 0) return;
  const newPatches = newBatches.flatMap((b) => b.patches).filter((p) => p.app === "confluence");
  if (newPatches.length === 0) return;

  useConfluenceStore.setState((draftState: any) => {
    const nextState = JSON.parse(JSON.stringify(draftState));
    newPatches.forEach((patch) => applyPatch(nextState, patch));
    return nextState;
  });
});

const initialSnapshot = buildInitialSnapshot();

export const useConfluenceStore = create<ConfluenceState>((set) => ({
  ...initialSnapshot,
  loadCorpusPage: async () => {
    const activeUserId = useUserStore.getState().activeUserId;
    if (!activeUserId) return;
    const pageData = await loadAppCorpus("confluence", activeUserId);
    if (!pageData) return;
    const snapshot = buildInitialSnapshot(pageData);

    const stateWithPatches = JSON.parse(JSON.stringify(snapshot)) as ConfluenceSnapshot;
    const patches = getGlobalPatchesForApp("confluence");
    patches.forEach((patch) => applyPatch(stateWithPatches, patch));

    set((state: any) => ({
      spaces: { ...state.spaces, ...stateWithPatches.spaces },
      pages: { ...state.pages, ...stateWithPatches.pages },
    }));
  },
  createPage: (input) => {
    const title = input.title.trim();
    if (!title) return "";
    const id = makeId("conf-page");
    usePatchStore.getState().appendPatch({
      app: "confluence",
      targetId: id,
      actorId: input.actorId,
      op: "create",
      scope: "confluence.page",
      payload: { ...input, id, title },
    });
    return id;
  },
  updatePage: (pageId, actorId, title, body) => {
    usePatchStore.getState().appendPatch({
      app: "confluence",
      targetId: pageId,
      actorId,
      op: "update",
      scope: "confluence.page",
      payload: { title, body },
    });
  },
  addComment: (pageId, actorId, body) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    usePatchStore.getState().appendPatch({
      app: "confluence",
      targetId: pageId,
      actorId,
      op: "update",
      scope: "dummy",
      payload: { body: trimmed },
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
