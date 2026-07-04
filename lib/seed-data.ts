export const seedBasePath = "/seed";

export const seedApps = [
  "gmail",
  "slack",
  "github",
  "linear",
  "jira",
  "hubspot",
  "google-drive",
  "confluence",
  "fireflies",
] as const;

export type SeedApp = (typeof seedApps)[number];
export type SeedScope = "company" | "user" | "app";

export type SeedCard = {
  id: string;
  app: SeedApp;
  title: string;
  preview: string;
  text: string;
  occurredAt: number;
  entityType: string;
  routeKey: string;
  sourcePath: string;
  peopleIds: string[];
  links: string[];
  tags: string[];
};

export type SeedEmployee = {
  id: string;
  name: string;
  title: string;
  email: string;
  department: string;
  managerId: string | null;
  startDate: string;
  bio: string;
};

export type SeedCompanyDocument = {
  id: string;
  scope: "company";
  title: string;
  text: string;
  sourcePath: string;
};

export type SeedRouteManifest = {
  route: string;
  count: number;
  pageSize: number;
  pageCount: number;
  pages: Array<{
    page: number;
    count: number;
    path: string;
  }>;
};

export type SeedManifest = {
  schemaVersion: 1;
  pageSize: number;
  source: string;
  sourceFilesRead: number;
  selectedSourceRecords: number;
  selectedUsers: string[];
  employees: {
    count: number;
    path: string;
  };
  company: {
    overview: string;
    initiatives: string;
    projects: string;
    orgChart: string;
  };
  routes: Record<string, { count: number; pageCount: number }>;
};

const jsonCache = new Map<string, Promise<unknown>>();

function cachedJson<T>(path: string): Promise<T> {
  if (!jsonCache.has(path)) {
    jsonCache.set(
      path,
      fetch(path, { cache: "force-cache" }).then((response) => {
        if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
        return response.json() as Promise<T>;
      }),
    );
  }

  return jsonCache.get(path)! as Promise<T>;
}

export function clearSeedCache() {
  jsonCache.clear();
}

export function seedRoute(...parts: string[]) {
  return parts
    .map((part) =>
      part
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter(Boolean)
    .join("/");
}

export function userAppRoute(userId: string, app: SeedApp) {
  return seedRoute("users", userId, app);
}

export function slackChannelRoute(channel: string) {
  return seedRoute("apps", "slack", "channels", channel);
}

export function confluenceSpaceRoute(space: string) {
  return seedRoute("apps", "confluence", "spaces", space);
}

export function googleDriveAreaRoute(area: string) {
  return seedRoute("apps", "google-drive", "areas", area);
}

export function githubRepoRoute(repo: string) {
  return seedRoute("apps", "github", "repos", repo);
}

export function linearTeamRoute(team: string) {
  return seedRoute("apps", "linear", "teams", team);
}

export function jiraProjectRoute(project: string) {
  return seedRoute("apps", "jira", "projects", project);
}

export function hubspotStageRoute(stage: string) {
  return seedRoute("apps", "hubspot", "stages", stage);
}

export function firefliesAccountRoute(account: string) {
  return seedRoute("apps", "fireflies", "accounts", account);
}

export async function loadSeedManifest() {
  return cachedJson<SeedManifest>(`${seedBasePath}/manifest.json`);
}

export async function loadSeedEmployees() {
  return cachedJson<SeedEmployee[]>(`${seedBasePath}/company/employees.json`);
}

export async function loadSeedCompanyDocument(key: keyof SeedManifest["company"]) {
  const manifest = await loadSeedManifest();
  return cachedJson<SeedCompanyDocument>(manifest.company[key]);
}

export async function loadSeedRouteManifest(route: string) {
  return cachedJson<SeedRouteManifest>(`${seedBasePath}/${route}/manifest.json`);
}

export async function loadSeedRoutePage(route: string, page = 1) {
  const manifest = await loadSeedRouteManifest(route);
  const pageMeta = manifest.pages.find((item) => item.page === page);
  if (!pageMeta) return [];

  return cachedJson<SeedCard[]>(pageMeta.path);
}

export async function loadSeedRoute(route: string, limit = 200) {
  const manifest = await loadSeedRouteManifest(route);
  const pages = manifest.pages.slice(0, Math.ceil(limit / manifest.pageSize));
  const results = await Promise.all(pages.map((page) => cachedJson<SeedCard[]>(page.path)));

  return results.flat().slice(0, limit);
}

export async function loadUserAppPage(userId: string, app: SeedApp, page = 1) {
  return loadSeedRoutePage(userAppRoute(userId, app), page);
}
