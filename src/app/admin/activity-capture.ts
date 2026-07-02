"use client";

import {
  sourceAppMeta,
  useActivityStore,
  type ActivityEventInput,
  type SourceApp,
} from "@/app/admin/activity-state";

export function captureActivityEvent(input: ActivityEventInput) {
  return useActivityStore.getState().appendEvent({
    ...input,
    selected: input.selected ?? true,
    metadata: {
      sourceSystem: sourceAppMeta[input.sourceApp].sourceSystem,
      ...(input.metadata ?? {}),
    },
  });
}

export function appRoute(app: SourceApp) {
  return sourceAppMeta[app].route;
}
