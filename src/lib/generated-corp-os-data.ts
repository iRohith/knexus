import type { ActivityEvent } from "@/app/admin/activity-state";

// Bulk corpus records are served as paged static JSON from public/corp-os-data.
// This compatibility export must stay empty so Workers and the browser bundle never embed the corpus.
export const corpOsActivityDataBasePath = "/corp-os-data";
export const corpOsActivityManifestUrl = `${corpOsActivityDataBasePath}/manifest.json`;
export const corpOsActivityEvents: ActivityEvent[] = [];
