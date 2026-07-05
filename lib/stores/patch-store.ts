"use client";

import { create } from "zustand";

export type PatchOperation = "create" | "update" | "delete";

export type AppPatch = {
  id: string;
  app: string;
  scope: string;
  op: PatchOperation;
  targetId: string;
  actorId: string;
  occurredAt: number;
  payload: Record<string, unknown>;
};

export type PatchBatch = {
  id: string;
  createdAt: number;
  patches: AppPatch[];
  status: "queued" | "flushed";
};

type PatchState = {
  batches: PatchBatch[];
  appendPatch: (patch: Omit<AppPatch, "id" | "occurredAt"> & { occurredAt?: number }) => string;
  hydratePatchBatches: (batches: PatchBatch[]) => void;
  pendingPatches: () => AppPatch[];
  markBatchesFlushed: (batchIds: string[]) => void;
  clearPatches: () => void;
};

const BATCH_WINDOW_MS = 1000;

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function currentBatch(batches: PatchBatch[], now: number) {
  const batch = batches.at(-1);
  if (!batch || batch.status !== "queued") return null;
  return now - batch.createdAt <= BATCH_WINDOW_MS ? batch : null;
}

// ----------------------------------------------------------------------
// Backend Patch API
// ----------------------------------------------------------------------

async function readPatchesFromDB(since?: number): Promise<PatchBatch[]> {
  if (typeof window === "undefined") return [];
  const query = since ? `?since=${encodeURIComponent(String(since))}` : "";
  const response = await fetch(`/api/patches${query}`, { cache: "no-store" });
  if (!response.ok) {
    if (response.status !== 401) {
      console.error(`Failed to read patches: ${response.status}`);
    }
    return [];
  }
  return response.json() as Promise<PatchBatch[]>;
}

async function writePatchesToDB(batches: PatchBatch[]): Promise<PatchBatch[]> {
  if (typeof window === "undefined") return [];
  const response = await fetch("/api/patches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batches }),
  });
  if (!response.ok) {
    throw new Error(`Failed to write patches: ${response.status}`);
  }
  return response.json() as Promise<PatchBatch[]>;
}

// ----------------------------------------------------------------------
// Automated Sync Logic
// ----------------------------------------------------------------------

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;

function scheduleWrite() {
  if (typeof window === "undefined") return;
  if (writeTimer) clearTimeout(writeTimer);

  writeTimer = setTimeout(async () => {
    const store = usePatchStore.getState();
    const queued = store.batches.filter((b) => b.status === "queued");
    if (queued.length > 0) {
      try {
        const saved = await writePatchesToDB(queued);
        store.hydratePatchBatches(saved);
        store.markBatchesFlushed(queued.map((b) => b.id));
      } catch (error) {
        console.error(error);
      }
    }
  }, 1000);
}

async function pollPatches() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const store = usePatchStore.getState();
    const latestCreatedAt = Math.max(0, ...store.batches.map((batch) => batch.createdAt));
    const batches = await readPatchesFromDB(latestCreatedAt || undefined);
    if (batches.length > 0) {
      store.hydratePatchBatches(batches);
    }
  } finally {
    pollInFlight = false;
  }
}

function startPatchPolling() {
  if (typeof window === "undefined" || pollTimer) return;
  void pollPatches();
  pollTimer = setInterval(() => {
    void pollPatches();
  }, 2000);
}

// ----------------------------------------------------------------------
// Store Definition
// ----------------------------------------------------------------------

export const usePatchStore = create<PatchState>()((set, get) => ({
  batches: [],

  appendPatch: (input) => {
    const now = input.occurredAt ?? Date.now();
    const patch: AppPatch = {
      ...input,
      id: makeId("patch"),
      occurredAt: now,
    };

    set((state) => {
      const openBatch = currentBatch(state.batches, now);
      if (!openBatch) {
        return {
          batches: [
            ...state.batches,
            { id: makeId("batch"), createdAt: now, patches: [patch], status: "queued" },
          ],
        };
      }

      return {
        batches: state.batches.map((batch) =>
          batch.id === openBatch.id ? { ...batch, patches: [...batch.patches, patch] } : batch,
        ),
      };
    });

    scheduleWrite();
    return patch.id;
  },

  hydratePatchBatches: (batches) => {
    set((state) => {
      const existingIds = new Set(state.batches.map((batch) => batch.id));
      const newBatches = batches.filter((batch) => !existingIds.has(batch.id));
      if (newBatches.length === 0) return state;

      return {
        batches: [...state.batches, ...newBatches].sort(
          (left, right) => left.createdAt - right.createdAt,
        ),
      };
    });
  },

  pendingPatches: () =>
    get()
      .batches.filter((batch) => batch.status === "queued")
      .flatMap((batch) => batch.patches),

  markBatchesFlushed: (batchIds) => {
    const flushedIds = new Set(batchIds);
    set((state) => {
      state.batches.forEach((batch) => {
        if (flushedIds.has(batch.id)) batch.status = "flushed";
      });
      return { batches: [...state.batches] };
    });
  },

  clearPatches: () => set({ batches: [] }),
}));

startPatchPolling();

export function getGlobalPatchesForApp(app: string) {
  return usePatchStore
    .getState()
    .batches.flatMap((batch) => batch.patches)
    .filter((patch) => patch.app === app)
    .sort((left, right) => left.occurredAt - right.occurredAt);
}
