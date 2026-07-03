import type { ActivityEvent, SourceApp } from "@/app/admin/activity-state";
import { appUsers, demoUserIds } from "@/lib/users";

export type CorpusEvent = ActivityEvent;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

export type CorpusAppManifest = {
  count: number;
  pageSize: number;
  pageCount: number;
  route: string;
  pages: Array<{ page: number; count: number; url: string }>;
};

export type CorpusManifest = {
  datasetName: string;
  generatedAt: number | string;
  pageSize: number;
  totalEvents: number;
  apps: Partial<Record<SourceApp, CorpusAppManifest>>;
};

const manifestUrl = "/corp-os-data/manifest.json";
const manifestCache: { current: Promise<CorpusManifest> | null; version: string | null } = {
  current: null,
  version: null,
};
const pageCache = new Map<string, Promise<CorpusEvent[]>>();

export const corpusEvents: CorpusEvent[] = [];

export function corpusEventsFor(sourceApp: SourceApp): CorpusEvent[] {
  void sourceApp;
  return [];
}

export async function loadCorpusManifest() {
  if (!manifestCache.current) {
    manifestCache.current = fetch(manifestUrl, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load corpus manifest: ${response.status}`);
        return response.json() as Promise<CorpusManifest>;
      })
      .then((manifest) => {
        const version = String(manifest.generatedAt);
        if (manifestCache.version && manifestCache.version !== version) pageCache.clear();
        manifestCache.version = version;
        return manifest;
      });
  }
  return manifestCache.current;
}

export function refreshCorpusManifest() {
  manifestCache.current = null;
  return loadCorpusManifest();
}

export async function loadCorpusEventsFor(sourceApp: SourceApp, page = 1) {
  const manifest = await loadCorpusManifest();
  const app = manifest.apps[sourceApp];
  const pageMeta = app?.pages.find((item) => item.page === page);
  if (!pageMeta) return [];

  const version = String(manifest.generatedAt);
  const cacheKey = `${sourceApp}:${page}:${version}`;
  if (!pageCache.has(cacheKey)) {
    const url = `${pageMeta.url}?v=${encodeURIComponent(version)}`;
    pageCache.set(
      cacheKey,
      fetch(url, { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error(`Unable to load corpus page: ${response.status}`);
        return response.json() as Promise<CorpusEvent[]>;
      }),
    );
  }
  return pageCache.get(cacheKey)!;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function corpusNormalized(event: CorpusEvent) {
  const metadata = event.metadata as Record<string, unknown>;
  const normalized = metadata.normalized;
  return isRecord(normalized) ? normalized : ({} as JsonRecord);
}

export function corpusNormalizedString(event: CorpusEvent, key: string, fallback = "") {
  const value = corpusNormalized(event)[key];
  return typeof value === "string" ? value : fallback;
}

export function corpusNormalizedStrings(event: CorpusEvent, key: string) {
  const value = corpusNormalized(event)[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function corpusNormalizedRecords(event: CorpusEvent, key: string) {
  const value = corpusNormalized(event)[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

export function corpusText(event: CorpusEvent, maxLength = 1800) {
  const cleanBody =
    typeof (event.metadata as Record<string, unknown>).cleanBody === "string"
      ? ((event.metadata as Record<string, unknown>).cleanBody as string)
      : corpusNormalizedString(event, "cleanBody", event.body);
  const text = cleanBody
    .replace(/\\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

export function corpusLabels(event: CorpusEvent, fallback: string[] = []) {
  const sourcePath = typeof event.metadata.sourcePath === "string" ? event.metadata.sourcePath : "";
  const text = `${event.title} ${event.body} ${sourcePath}`.toLowerCase();
  const labels = new Set(fallback);
  [
    "private",
    "audit",
    "retention",
    "runtime",
    "latency",
    "rbac",
    "console",
    "security",
    "customer",
    "routing",
    "dedicated",
    "gpu",
    "compliance",
  ].forEach((keyword) => {
    if (text.includes(keyword)) labels.add(keyword);
  });
  return Array.from(labels).slice(0, 6);
}

export function actorName(event: CorpusEvent) {
  return typeof event.metadata.actorName === "string" ? event.metadata.actorName : event.actorId;
}

export function actorEmail(event: CorpusEvent) {
  return typeof event.metadata.actorEmail === "string"
    ? event.metadata.actorEmail
    : `${event.actorId}@redwoodinference.com`;
}

export function actorInitials(event: CorpusEvent) {
  return typeof event.metadata.actorInitials === "string"
    ? event.metadata.actorInitials
    : actorName(event)
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export function corpusUserIdFromName(name: string, fallbackId: string) {
  const normalized = name
    .replace(/\([^)]*\)/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[_\.]+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return fallbackId;
  const user = appUsers.find((candidate) => {
    const candidateName = candidate.name.toLowerCase();
    const candidateEmailName = candidate.email.split("@")[0].replace(/[._-]+/g, " ");
    return candidateName === normalized || candidateEmailName === normalized;
  });
  return user?.id ?? fallbackId;
}

export function buildCorpusUsers() {
  return appUsers;
}

export function activeCorpusUserIds(limit = 18) {
  // Return the 10 canonical demo users first (from dataset ranking), then fill with others
  const otherUsers = appUsers.filter((u) => !(demoUserIds as readonly string[]).includes(u.id)).map((u) => u.id);
  return [...Array.from(demoUserIds), ...otherUsers].slice(0, Math.max(limit, demoUserIds.length));
}

export function allCorpusUserIds() {
  return appUsers.map((user) => user.id);
}

export function stableNumber(seed: string, modulo: number) {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? value % modulo : value;
}

export function dateInput(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function clockTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dateTimeText(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
