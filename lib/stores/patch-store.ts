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
  appendBatch: (patches: AppPatch[]) => string;
  hydratePatchBatches: (batches: PatchBatch[]) => void;
  pendingPatches: () => AppPatch[];
  flushPatchBatches: () => Promise<PatchBatch[]>;
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

        return patch.id;
      },

      appendBatch: (patches) => {
        const id = makeId("batch");
        set((state) => ({
          batches: [...state.batches, { id, createdAt: Date.now(), patches, status: "queued" }],
        }));
        return id;
      },

      hydratePatchBatches: (batches) => {
        set((state) => {
          const existingIds = new Set(state.batches.map((batch) => batch.id));
          return {
            batches: [
              ...state.batches,
              ...batches.filter((batch) => !existingIds.has(batch.id)),
            ].sort((left, right) => left.createdAt - right.createdAt),
          };
        });
      },

      pendingPatches: () =>
        get()
          .batches.filter((batch) => batch.status === "queued")
          .flatMap((batch) => batch.patches),

      flushPatchBatches: async () => {
        const queued = get().batches.filter((batch) => batch.status === "queued");
        // Future Java backend hook:
        // POST queued batches to the global patch endpoint, then call markBatchesFlushed.
        return queued;
      },

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
