"use client";

import { create } from "zustand";

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
};

export const driveViews: DriveView[] = ["my-drive", "shared", "starred", "recent", "trash"];
export const driveKinds: DriveKind[] = ["doc", "sheet", "slide", "pdf", "image"];

const now = Date.now() - 20 * 60 * 1000;

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildInitialSnapshot(): DriveSnapshot {
  const items: Record<string, DriveItem> = {};
  const owners = ["riley", "maya", "ari"];
  const folders = ["Product", "Sales", "Engineering", "Research"];
  folders.forEach((name, index) => {
    const ownerId = owners[index % owners.length];
    const folderId = `drive-folder-${index + 1}`;
    items[folderId] = {
      id: folderId,
      name,
      kind: "folder",
      ownerId,
      parentId: null,
      sharedWith: owners.filter((id) => id !== ownerId).slice(0, 1),
      starredBy: index % 2 === 0 ? [ownerId] : [],
      trashed: false,
      size: "-",
      content: `${name} folder`,
      updatedAt: now - index * 2 * 60 * 60 * 1000,
    };
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const kind = driveKinds[(fileIndex + index) % driveKinds.length];
      const id = `${folderId}-file-${fileIndex + 1}`;
      items[id] = {
        id,
        name: `${name} ${["Roadmap", "Budget", "Brief", "Notes", "Mockup"][fileIndex % 5]}.${kind}`,
        kind,
        ownerId,
        parentId: folderId,
        sharedWith: fileIndex % 3 === 0 ? owners.filter((userId) => userId !== ownerId) : [],
        starredBy: fileIndex % 4 === 0 ? [ownerId, ...items[folderId].sharedWith] : [],
        trashed: fileIndex === 7 && index % 2 === 0,
        size: `${120 + fileIndex * 43} KB`,
        content: `Mock preview for ${name} ${kind}. Includes planning notes, ownership, dates, and project context.`,
        updatedAt: now - (index * 8 + fileIndex + 1) * 47 * 60 * 1000,
      };
    }
  });
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

const initialSnapshot = buildInitialSnapshot();

export const useDriveStore = create<DriveState>((set) => ({
  ...initialSnapshot,
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
            content: input.content.trim() || `Mock uploaded ${input.kind} file.`,
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
  shareItem: (itemId, actorId, userId) => {
    set((state) => {
      const item = state.items[itemId];
      if (!item || item.ownerId !== actorId || userId === actorId) return state;
      return {
        items: {
          ...state.items,
          [itemId]: {
            ...item,
            sharedWith: item.sharedWith.includes(userId)
              ? item.sharedWith
              : [...item.sharedWith, userId],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
}));
