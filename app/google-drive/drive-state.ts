/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { create } from "zustand";

import { loadAppCorpus, type SeedCard } from "@/lib/seed-data";
import { usePatchStore, getGlobalPatchesForApp } from "@/lib/stores/patch-store";
import { useUserStore } from "@/lib/stores/user-store";
import { appUsers } from "@/lib/users";

export type DriveView = "my-drive" | "shared" | "starred" | "recent" | "trash";
export type DriveKind = "folder" | "doc" | "sheet" | "slide" | "pdf" | "image";

export type DriveItem = {
  id: string;
  name: string;
  kind: DriveKind;
  ownerId: string;
  parentId: string | null;
  sharedWith: string[];
  starredBy: string[];
  trashed: boolean;
  size: string;
  content: string;
  updatedAt: number;
};

export type DriveSnapshot = {
  items: Record<string, DriveItem>;
};

export type DriveState = DriveSnapshot & {
  loadCorpusPage: () => Promise<void>;
  createFolder: (actorId: string, parentId: string | null, name: string) => string;
  uploadFile: (input: {
    actorId: string;
    parentId: string | null;
    name: string;
    kind: DriveKind;
    content: string;
  }) => string;
  toggleStar: (itemId: string, actorId: string) => void;
  trashItem: (itemId: string, actorId: string) => void;
  restoreItem: (itemId: string, actorId: string) => void;
  shareItem: (itemId: string, actorId: string, userId: string) => void;
  renameItem: (itemId: string, actorId: string, name: string) => void;
  moveItem: (itemId: string, actorId: string, parentId: string | null) => void;
  deleteItem: (itemId: string, actorId: string) => void;
};

export const driveViews: DriveView[] = ["my-drive", "shared", "starred", "recent", "trash"];
export const driveKinds: DriveKind[] = ["doc", "sheet", "slide", "pdf", "image"];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildInitialSnapshot(cards: SeedCard[] = []): DriveSnapshot {
  const items: Record<string, DriveItem> = {};

  if (cards.length > 0) {
    const memberIds = appUsers.map((u) => u.id);
    const folders = ["customer-success", "product", "security", "runtime"];

    folders.forEach((folder, index) => {
      const ownerId = memberIds[index % memberIds.length];
      items[folder] = {
        id: folder,
        name: folder
          .split("-")
          .map((part) => part[0].toUpperCase() + part.slice(1))
          .join(" "),
        kind: "folder",
        ownerId,
        parentId: null,
        sharedWith: memberIds.filter((id) => id !== ownerId).slice(0, 8),
        starredBy: memberIds.slice(index, index + 2),
        trashed: false,
        size: "-",
        content: "Folder from seed data",
        updatedAt: Date.now() - index * 24 * 60 * 60 * 1000,
      };
    });

    cards.forEach((card, index) => {
      const folderId = index % 3 === 0 ? null : folders[index % folders.length];
      const ownerId = card.peopleIds[0] ?? memberIds[0];
      const rawKind = card.entityType || "document";

      items[card.id] = {
        id: card.id,
        name: card.title || "Untitled",
        kind: (rawKind === "document"
          ? "doc"
          : rawKind === "spreadsheet"
            ? "sheet"
            : "slide") as DriveKind,
        ownerId,
        parentId: folderId,
        sharedWith: memberIds.filter((id) => id !== ownerId).slice(0, 7),
        starredBy: index % 3 === 0 ? [ownerId, memberIds[0]].filter(Boolean) : [],
        trashed: false,
        size: "10 KB",
        content: card.text || "",
        updatedAt: card.occurredAt,
      };
    });
  }

  return { items };
}

export function canAccessItem(item: DriveItem | undefined, userId: string) {
  return Boolean(item && (item.ownerId === userId || item.sharedWith.includes(userId)));
}

export function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return "just now";
  const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function applyPatch(state: any, patch: any) {
  if ((patch as any).type === "create" && patch.scope === "drive.item") {
    state.items[patch.targetId] = patch.payload as any;
  } else if ((patch as any).type === "update" && patch.scope === "drive.item") {
    if (state.items[patch.targetId]) {
      state.items[patch.targetId] = { ...state.items[patch.targetId], ...patch.payload };
    }
  }
}

usePatchStore.subscribe((state, prevState) => {
  if (state.batches === prevState.batches) return;
  const newBatches = state.batches.filter((b) => !prevState.batches.includes(b));
  if (newBatches.length === 0) return;
  const newPatches = newBatches.flatMap((b) => b.patches).filter((p) => p.app === "google-drive");
  if (newPatches.length === 0) return;

  useDriveStore.setState((draftState: any) => {
    const nextState = JSON.parse(JSON.stringify(draftState));
    newPatches.forEach((patch) => applyPatch(nextState, patch));
    return nextState;
  });
});

const initialSnapshot = buildInitialSnapshot();

export const useDriveStore = create<DriveState>((set) => ({
  ...initialSnapshot,
  loadCorpusPage: async () => {
    const activeUserId = useUserStore.getState().activeUserId;
    if (!activeUserId) return;
    const pageData = await loadAppCorpus("google-drive", activeUserId);
    if (!pageData) return;
    const snapshot = buildInitialSnapshot(pageData);

    const stateWithPatches = JSON.parse(JSON.stringify(snapshot)) as DriveSnapshot;
    const patches = getGlobalPatchesForApp("google-drive");
    patches.forEach((patch) => applyPatch(stateWithPatches, patch));

    set((state: any) => ({
      items: { ...state.items, ...stateWithPatches.items },
    }));
  },
  createFolder: (actorId, parentId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return "";
    const id = makeId("drive-folder");
    usePatchStore.getState().appendPatch({
      app: "google-drive",
      targetId: id,
      actorId,
      op: "create",
      scope: "drive.folder",
      payload: { id, ownerId: actorId, parentId, name: trimmed, kind: "folder" },
    });
    return id;
  },
  uploadFile: (input) => {
    const name = input.name.trim();
    if (!name) return "";
    let id = "";
    set((state) => {
      if (input.parentId && !canAccessItem(state.items[input.parentId], input.actorId))
        return state;
      id = makeId("drive-file");
      return {
        items: {
          ...state.items,
          [id]: {
            id,
            name,
            kind: input.kind,
            ownerId: input.actorId,
            parentId: input.parentId,
            sharedWith: [],
            starredBy: [],
            trashed: false,
            size: `${90 + name.length * 7} KB`,
            content: input.content.trim() || `Uploaded ${input.kind} file.`,
            updatedAt: Date.now(),
          },
        },
      };
    });
    return id;
  },
  toggleStar: (itemId, actorId) => {
    set((state) => {
      const item = state.items[itemId];
      if (!canAccessItem(item, actorId)) return state;
      const starred = item.starredBy.includes(actorId);
      return {
        items: {
          ...state.items,
          [itemId]: {
            ...item,
            starredBy: starred
              ? item.starredBy.filter((id) => id !== actorId)
              : [...item.starredBy, actorId],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  trashItem: (itemId, actorId) => {
    set((state) => {
      const item = state.items[itemId];
      if (!item || item.ownerId !== actorId) return state;
      return {
        items: { ...state.items, [itemId]: { ...item, trashed: true, updatedAt: Date.now() } },
      };
    });
  },
  restoreItem: (itemId, actorId) => {
    set((state) => {
      const item = state.items[itemId];
      if (!item || item.ownerId !== actorId) return state;
      return {
        items: { ...state.items, [itemId]: { ...item, trashed: false, updatedAt: Date.now() } },
      };
    });
  },
  renameItem: (itemId, actorId, name) => {
    set((state) => {
      const item = state.items[itemId];
      if (!item || item.ownerId !== actorId) return state;
      return {
        items: { ...state.items, [itemId]: { ...item, name, updatedAt: Date.now() } },
      };
    });
  },
  moveItem: (itemId, actorId, parentId) => {
    usePatchStore.getState().appendPatch({
      app: "google-drive",
      targetId: itemId,
      actorId,
      op: "update",
      scope: "dummy",
      payload: { parentId },
    });
  },
  deleteItem: (itemId, actorId) => {
    set((state) => {
      const item = state.items[itemId];
      if (!item || item.ownerId !== actorId || !item.trashed) return state;
      const nextItems = { ...state.items };
      delete nextItems[itemId];
      return { items: nextItems };
    });
  },
  shareItem: (itemId, actorId, userId) => {
    set((state) => {
      const item = state.items[itemId];
      if (!item || item.ownerId !== actorId || userId === actorId) return state;

      const nextItems = { ...state.items };
      const toUpdate = [itemId];
      const visited = new Set<string>();

      while (toUpdate.length > 0) {
        const currentId = toUpdate.pop()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const currentItem = nextItems[currentId];
        if (currentItem) {
          nextItems[currentId] = {
            ...currentItem,
            sharedWith: currentItem.sharedWith.includes(userId)
              ? currentItem.sharedWith
              : [...currentItem.sharedWith, userId],
            updatedAt: Date.now(),
          };

          if (currentItem.kind === "folder") {
            for (const [id, child] of Object.entries(nextItems)) {
              if (child.parentId === currentId) {
                toUpdate.push(id);
              }
            }
          }
        }
      }

      return { items: nextItems };
    });
  },
}));
