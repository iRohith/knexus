"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
// Abstract DB Functions (Emulated with LocalStorage)
// ----------------------------------------------------------------------

async function readPatchesFromDB(): Promise<PatchBatch[]> {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem("knexus-mock-db");
  return data ? JSON.parse(data) : [];
}

async function writePatchesToDB(batches: PatchBatch[]): Promise<void> {
  if (typeof window === "undefined") return;
  const existing = await readPatchesFromDB();
  const existingIds = new Set(existing.map((b) => b.id));
  const merged = [...existing, ...batches.filter((b) => !existingIds.has(b.id))];
  localStorage.setItem("knexus-mock-db", JSON.stringify(merged));
}

// ----------------------------------------------------------------------
// Automated Sync Logic
// ----------------------------------------------------------------------

let writeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleWrite() {
  if (typeof window === "undefined") return;
  if (writeTimer) clearTimeout(writeTimer);
  
  writeTimer = setTimeout(async () => {
    const store = usePatchStore.getState();
    const queued = store.batches.filter((b) => b.status === "queued");
    if (queued.length > 0) {
      await writePatchesToDB(queued);
      store.markBatchesFlushed(queued.map((b) => b.id));
    }
  }, 2000);
}

if (typeof window !== "undefined") {
  setInterval(async () => {
    const batches = await readPatchesFromDB();
    if (batches.length > 0) {
      usePatchStore.getState().hydratePatchBatches(batches);
    }
  }, 2000);
}

// ----------------------------------------------------------------------
// Store Definition
// ----------------------------------------------------------------------

export const usePatchStore = create<PatchState>()(
  persist(
    (set, get) => ({
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
            batches: [...state.batches, ...newBatches].sort((left, right) => left.createdAt - right.createdAt),
          };
        });
      },

      pendingPatches: () =>
        get()
          .batches.filter((batch) => batch.status === "queued")
          .flatMap((batch) => batch.patches),

      markBatchesFlushed: (batchIds) => {
        const flushedIds = new Set(batchIds);
        set((state) => ({
          batches: state.batches.map((batch) =>
            flushedIds.has(batch.id) ? { ...batch, status: "flushed" } : batch,
          ),
        }));
      },

      clearPatches: () => set({ batches: [] }),
    }),
    {
      name: "knexus-global-patch-batches",
      version: 1,
    },
  ),
);

export function getGlobalPatchesForApp(app: string) {
  return usePatchStore
    .getState()
    .batches.flatMap((batch) => batch.patches)
    .filter((patch) => patch.app === app)
    .sort((left, right) => left.occurredAt - right.occurredAt);
}
