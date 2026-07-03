"use client";

import { create } from "zustand";

import {
  activeCorpusUserIds,
  corpusEventsFor,
  corpusLabels,
  corpusText,
  loadCorpusEventsFor,
  stableNumber,
} from "@/lib/corpus-app-data";

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
  loadCorpusPage: (page?: number) => Promise<void>;
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

function buildInitialSnapshot(corpusDocs = corpusEventsFor("google-drive")): DriveSnapshot {
  if (corpusDocs.length > 0) {
    const items: Record<string, DriveItem> = {};
    const memberIds = activeCorpusUserIds();
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
        content: "Redwood Inference corpus folder.",
        updatedAt: Date.now() - index * 24 * 60 * 60 * 1000,
      };
    });

    corpusDocs.forEach((event, index) => {
      const labels = corpusLabels(event);
      const content = corpusText(event, 2600);
      const folderId =
        folders.find(
          (folder) =>
            labels.includes(folder) ||
            event.title.toLowerCase().includes(folder) ||
            content.toLowerCase().includes(folder),
        ) ?? folders[index % folders.length];
      const ownerId = event.actorId;
      const kind: DriveKind =
        event.title.toLowerCase().includes("snapshot") || content.toLowerCase().includes("csv")
          ? "sheet"
          : content.toLowerCase().includes("slide")
            ? "slide"
            : "doc";

      items[event.sourceEntityId] = {
        id: event.sourceEntityId,
        name: event.title,
        kind,
        ownerId,
        parentId: folderId,
        sharedWith: memberIds.filter((id) => id !== ownerId).slice(0, 7),
        starredBy: stableNumber(event.id, 3) === 0 ? [ownerId, memberIds[0]].filter(Boolean) : [],
        trashed: false,
        size: `${Math.max(90, Math.round(corpusText(event).length / 9))} KB`,
        content,
        updatedAt: event.occurredAt,
      };
    });

    return { items };
  }

  return { items: {} };
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

const initialSnapshot = buildInitialSnapshot();

export const useDriveStore = create<DriveState>((set) => ({
  ...initialSnapshot,
  loadCorpusPage: async (page = 1) => {
    const events = await loadCorpusEventsFor("google-drive", page);
    const snapshot = buildInitialSnapshot(events);
    set((state) => ({
      items: { ...state.items, ...snapshot.items },
    }));
  },
  createFolder: (actorId, parentId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return "";
    let id = "";
    set((state) => {
      if (parentId && !canAccessItem(state.items[parentId], actorId)) return state;
      id = makeId("drive-folder");
      return {
        items: {
          ...state.items,
          [id]: {
            id,
            name: trimmed,
            kind: "folder",
            ownerId: actorId,
            parentId,
            sharedWith: [],
            starredBy: [],
            trashed: false,
            size: "-",
            content: `${trimmed} folder`,
            updatedAt: Date.now(),
          },
        },
      };
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
    set((state) => {
      const item = state.items[itemId];
      if (!item || item.ownerId !== actorId) return state;
      if (parentId && !canAccessItem(state.items[parentId], actorId)) return state;
      return {
        items: { ...state.items, [itemId]: { ...item, parentId, updatedAt: Date.now() } },
      };
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
