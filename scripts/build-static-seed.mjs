import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_DIR = path.join(process.cwd(), "local", "generated_data");
const OUTPUT_DIR = path.join(process.cwd(), "public", "seed");
const PAGE_SIZE = 50;
const APP_ROUTE_LIMIT_PER_APP = 24;

const appNames = [
  "gmail",
  "slack",
  "github",
  "linear",
  "jira",
  "hubspot",
  "google-drive",
  "confluence",
  "fireflies",
];

const sourceApps = {
  google_drive: "google-drive",
};

const selectedUserIds = [
  "ava-chen",
  "ethan-park",
  "priya-natarajan",
  "sean-gallagher",
  "logan-wright",
  "rafael-mendes",
  "marcus-lin",
  "jordan-blake",
  "ben-carter",
  "mateo-alvarez",
];

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bdr\.\s*/gi, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanText(value) {
  return String(value || "")
    .replace(/\\n/g, "\n")
    .trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function route(...parts) {
  return parts.map(slugify).filter(Boolean).join("/");
}

function routeLimit(routePath) {
  if (routePath.startsWith("users/") && routePath.endsWith("/gmail")) return 200;
  if (routePath.startsWith("users/")) return 120;
  if (routePath.startsWith("apps/gmail/")) return 2000;
  if (routePath.startsWith("apps/slack/channels/")) return 180;
  if (routePath.startsWith("apps/confluence/spaces/")) return 150;
  if (routePath.startsWith("apps/github/repos/")) return 130;
  if (routePath.startsWith("apps/fireflies/accounts/")) return 120;
  return 100;
}

function parseDate(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function extractEmployees(yaml) {
  const employees = [];
  const lines = yaml.split("\n");
  let department = "";
  let current = null;

  for (const line of lines) {
    const departmentMatch = line.match(/^  ([^ ].*):$/);
    if (departmentMatch) department = departmentMatch[1];

    const nameMatch = line.match(/^\s+- name: "(.+)"$/);
    if (nameMatch) {
      if (current) employees.push(current);
      current = { name: nameMatch[1], department };
      continue;
    }

    if (!current) continue;
    const fieldMatch = line.match(/^\s+([a-z_]+): "?(.*?)"?$/);
    if (!fieldMatch) continue;
    current[fieldMatch[1]] = fieldMatch[2];
  }

  if (current) employees.push(current);

  return employees.map((employee) => ({
    id: slugify(employee.name),
    name: employee.name,
    title: employee.title || "",
    email: employee.email || "",
    department: employee.department || "",
    managerId: employee.manager ? slugify(employee.manager) : null,
    startDate: employee.start_date || "",
    bio: employee.bio || "",
  }));
}

function makePeopleLookup(employees) {
  const byName = new Map();
  const byId = new Map();

  for (const employee of employees) {
    byId.set(employee.id, employee);
    byName.set(employee.name.toLowerCase(), employee);
    byName.set(
      employee.email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .toLowerCase(),
      employee,
    );
  }

  return {
    byId,
    resolve(value) {
      if (!value || typeof value !== "string") return null;
      const cleaned = value
        .replace(/<[^>]+>/g, "")
        .replace(/\([^)]*\)/g, "")
        .replace(/\bdr\.\s*/gi, "")
        .trim();
      if (!cleaned) return null;
      return byName.get(cleaned.toLowerCase())?.id ?? null;
    },
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value)}\n`);
}

async function* walkJsonFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkJsonFiles(filePath);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      yield filePath;
    }
  }
}

function addRoute(routes, routePath, card) {
  if (!routePath || !card.id) return;
  if (!routes.has(routePath)) routes.set(routePath, new Map());
  const route = routes.get(routePath);
  if (route.size >= routeLimit(routePath) && !route.has(card.id)) return;
  route.set(card.id, card);
}

function normalizedSourcePath(filePath) {
  return path.relative(SOURCE_DIR, filePath).split(path.sep).join("/");
}

function firstContentField(source) {
  for (const key of asArray(source.content_field_names)) {
    if (typeof source[key] === "string") return source[key];
  }
  return source.body || source.text || source.content || source.description || source.summary || "";
}

function textFromMessages(messages) {
  return asArray(messages)
    .map((message) => {
      if (typeof message === "string") return message;
      if (!message || typeof message !== "object") return "";
      return [message.author, message.from, message.body, message.text].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .join("\n\n");
}

function personIds(values, people) {
  return [
    ...new Set(
      asArray(values)
        .map((value) => people.resolve(value))
        .filter(Boolean),
    ),
  ];
}

function commonCard({
  id,
  app,
  source,
  filePath,
  title,
  text,
  occurredAt,
  entityType,
  routeKey,
  peopleIds,
}) {
  return {
    id,
    app,
    title: cleanText(title),
    preview: cleanText(text),
    text: cleanText(text),
    occurredAt,
    entityType,
    routeKey,
    sourcePath: normalizedSourcePath(filePath),
    peopleIds: [...new Set(peopleIds)].sort(),
    links: [
      ...asArray(source.related_links),
      ...asArray(source.related_pages),
      ...asArray(source.linked_linear),
      ...asArray(source.linked_jira),
      ...asArray(source.linked_drive_docs),
      ...asArray(source.linked_gmail_threads),
      ...asArray(source.linked_fireflies),
      ...asArray(source.related_github_prs),
      ...asArray(source.attachments),
    ].filter((item) => typeof item === "string" && item.trim()),
    tags: [
      ...asArray(source.labels),
      ...asArray(source.tags),
      source.priority,
      source.status,
      source.stage,
      source.team,
      source.project,
      source.repo,
      source.channel,
    ]
      .filter((item) => typeof item === "string" && item.trim())
      .slice(0, 18),
  };
}

function normalizeByApp(sourceApp, source, filePath, people) {
  const app = sourceApps[sourceApp] ?? sourceApp;

  if (sourceApp === "gmail") {
    const ownerId = people.resolve(source.mailbox_owner);
    const participantIds = personIds(source.participants_internal, people);
    const userIds = [...new Set([ownerId, ...participantIds].filter(Boolean))];
    const title = source.subject || path.basename(filePath, ".json");
    return {
      card: commonCard({
        id: `gmail:${source.thread_id || source.dataset_doc_uuid || slugify(title)}`,
        app,
        source,
        filePath,
        title,
        text: source.body || textFromMessages(source.messages),
        occurredAt: parseDate(source.last_email_at || source.first_email_at),
        entityType: "thread",
        routeKey: route("apps", "gmail", "threads"),
        peopleIds: userIds,
      }),
      userRoutes: userIds.length > 1 ? userIds.map((id) => route("users", id, "gmail")) : [],
      appRoutes: [route("apps", "gmail", "threads")],
    };
  }

  if (sourceApp === "slack") {
    const channel = source.channel || "general";
    const participantIds = personIds(source.participants, people);
    const title = `#${channel}: ${source.thread_ts || source.dataset_doc_uuid}`;
    return {
      card: commonCard({
        id: `slack:${source.thread_ts || source.dataset_doc_uuid || slugify(title)}`,
        app,
        source,
        filePath,
        title,
        text: textFromMessages(source.messages) || source.text || source.body,
        occurredAt: Number(source.last_message_ts || source.first_message_ts || 0) * 1000,
        entityType: "thread",
        routeKey: route("apps", "slack", "channels", channel),
        peopleIds: participantIds,
      }),
      userRoutes: participantIds.map((id) => route("users", id, "slack")),
      appRoutes: [route("apps", "slack", "channels", channel)],
    };
  }

  if (sourceApp === "confluence") {
    const authorId = people.resolve(source.author);
    const reviewerIds = personIds(source.reviewers, people);
    const space =
      source.space ||
      path.relative(path.join(SOURCE_DIR, "sources", sourceApp), filePath).split(path.sep)[0];
    const title = source.title || path.basename(filePath, ".json");
    return {
      card: commonCard({
        id: `confluence:${source.dataset_doc_uuid || slugify(title)}`,
        app,
        source,
        filePath,
        title,
        text: source.content || firstContentField(source),
        occurredAt: parseDate(source.last_updated || source.created_at),
        entityType: "page",
        routeKey: route("apps", "confluence", "spaces", space),
        peopleIds: [authorId, ...reviewerIds].filter(Boolean),
      }),
      userRoutes: authorId ? [route("users", authorId, "confluence")] : [],
      appRoutes: [route("apps", "confluence", "spaces", space)],
    };
  }

  if (sourceApp === "google_drive") {
    const ownerId = people.resolve(source.owner);
    const collaboratorIds = personIds(source.collaborators, people);
    const area = source.drive_area || "drive";
    const title = source.title || path.basename(filePath, ".json");
    return {
      card: commonCard({
        id: `google-drive:${source.dataset_doc_uuid || slugify(source.path || title)}`,
        app,
        source,
        filePath,
        title,
        text: source.content || firstContentField(source),
        occurredAt: parseDate(source.last_modified || source.created_at),
        entityType: source.doc_type || "document",
        routeKey: route("apps", "google-drive", "areas", area),
        peopleIds: [ownerId, ...collaboratorIds].filter(Boolean),
      }),
      userRoutes: ownerId ? [route("users", ownerId, "google-drive")] : [],
      appRoutes: [route("apps", "google-drive", "areas", area)],
    };
  }

  if (sourceApp === "github") {
    const authorId = people.resolve(source.author);
    const reviewerIds = personIds(source.reviewers, people);
    const repo =
      source.repo ||
      path.relative(path.join(SOURCE_DIR, "sources", sourceApp), filePath).split(path.sep)[0];
    const title = source.title || path.basename(filePath, ".json");
    return {
      card: commonCard({
        id: `github:${repo}:${source.pr_number || source.dataset_doc_uuid || slugify(title)}`,
        app,
        source,
        filePath,
        title,
        text: source.body || source.description || textFromMessages(source.conversation),
        occurredAt: parseDate(source.merged_at || source.updated_at || source.created_at),
        entityType: "pull_request",
        routeKey: route("apps", "github", "repos", repo),
        peopleIds: [authorId, ...reviewerIds].filter(Boolean),
      }),
      userRoutes: [...new Set([authorId, ...reviewerIds].filter(Boolean))].map((id) =>
        route("users", id, "github"),
      ),
      appRoutes: [route("apps", "github", "repos", repo)],
    };
  }

  if (sourceApp === "linear") {
    const creatorId = people.resolve(source.creator);
    const assigneeId = people.resolve(source.assignee);
    const team =
      source.team ||
      path.relative(path.join(SOURCE_DIR, "sources", sourceApp), filePath).split(path.sep)[0];
    const title = source.title || source.key || path.basename(filePath, ".json");
    return {
      card: commonCard({
        id: `linear:${source.key || source.dataset_doc_uuid || slugify(title)}`,
        app,
        source,
        filePath,
        title,
        text: source.description || firstContentField(source) || textFromMessages(source.comments),
        occurredAt: parseDate(source.updated_at || source.created_at),
        entityType: "issue",
        routeKey: route("apps", "linear", "teams", team),
        peopleIds: [creatorId, assigneeId].filter(Boolean),
      }),
      userRoutes: [...new Set([creatorId, assigneeId].filter(Boolean))].map((id) =>
        route("users", id, "linear"),
      ),
      appRoutes: [route("apps", "linear", "teams", team)],
    };
  }

  if (sourceApp === "jira") {
    const reporterId = people.resolve(source.reporter);
    const assigneeId = people.resolve(source.assignee);
    const project =
      source.project ||
      path.relative(path.join(SOURCE_DIR, "sources", sourceApp), filePath).split(path.sep)[0];
    const title = source.summary || source.key || path.basename(filePath, ".json");
    return {
      card: commonCard({
        id: `jira:${source.key || source.dataset_doc_uuid || slugify(title)}`,
        app,
        source,
        filePath,
        title,
        text: source.description || firstContentField(source) || textFromMessages(source.comments),
        occurredAt: parseDate(source.updated_at || source.created_at),
        entityType: "issue",
        routeKey: route("apps", "jira", "projects", project),
        peopleIds: [reporterId, assigneeId].filter(Boolean),
      }),
      userRoutes: [...new Set([reporterId, assigneeId].filter(Boolean))].map((id) =>
        route("users", id, "jira"),
      ),
      appRoutes: [route("apps", "jira", "projects", project)],
    };
  }

  if (sourceApp === "hubspot") {
    const ownerIds = personIds([source.owner, source.se_assigned, source.csm_assigned], people);
    const stage = source.stage || "accounts";
    const title = source.company_name || source.title || path.basename(filePath, ".json");
    return {
      card: commonCard({
        id: `hubspot:${source.company_id || source.dataset_doc_uuid || slugify(title)}`,
        app,
        source,
        filePath,
        title,
        text:
          source.requirements_summary ||
          textFromMessages(source.crm_notes) ||
          firstContentField(source),
        occurredAt: parseDate(source.last_activity_at || source.updated_at || source.created_at),
        entityType: "company",
        routeKey: route("apps", "hubspot", "stages", stage),
        peopleIds: ownerIds,
      }),
      userRoutes: ownerIds.map((id) => route("users", id, "hubspot")),
      appRoutes: [route("apps", "hubspot", "stages", stage)],
    };
  }

  if (sourceApp === "fireflies") {
    const ownerId = people.resolve(source.redwood_owner);
    const attendeeIds = personIds(source.redwood_attendees, people);
    const userIds = [...new Set([ownerId, ...attendeeIds].filter(Boolean))];
    const account = source.customer_company || "meetings";
    const title = source.title || path.basename(filePath, ".json");
    return {
      card: commonCard({
        id: `fireflies:${source.meeting_id || source.dataset_doc_uuid || slugify(title)}`,
        app,
        source,
        filePath,
        title,
        text: source.summary || source.transcript || firstContentField(source),
        occurredAt: parseDate(source.recorded_at),
        entityType: "meeting",
        routeKey: route("apps", "fireflies", "accounts", account),
        peopleIds: userIds,
      }),
      userRoutes: userIds.map((id) => route("users", id, "fireflies")),
      appRoutes: [route("apps", "fireflies", "accounts", account)],
    };
  }

  return null;
}

function compareCards(left, right) {
  if (right.occurredAt !== left.occurredAt) return right.occurredAt - left.occurredAt;
  return left.id.localeCompare(right.id);
}

function routeApp(route) {
  const [, app] = route.split("/");
  return app;
}

function routeIsUser(route) {
  return route.startsWith("users/");
}

function routeIsApp(route) {
  return route.startsWith("apps/");
}

async function writePagedRoute(route, cards) {
  const sorted = [...cards].sort(compareCards);
  const pages = [];

  for (let index = 0; index < sorted.length; index += PAGE_SIZE) {
    const pageNumber = pages.length + 1;
    const pageName = `page-${String(pageNumber).padStart(4, "0")}.json`;
    const pagePath = path.join(OUTPUT_DIR, route, pageName);
    const pageCards = sorted.slice(index, index + PAGE_SIZE);
    await writeJson(pagePath, pageCards);
    pages.push({
      page: pageNumber,
      count: pageCards.length,
      path: `/${path.posix.join("seed", route, pageName)}`,
    });
  }

  await writeJson(path.join(OUTPUT_DIR, route, "manifest.json"), {
    route,
    count: sorted.length,
    pageSize: PAGE_SIZE,
    pageCount: pages.length,
    pages,
  });

  return { count: sorted.length, pageCount: pages.length };
}

async function buildCompanySeed(employees) {
  await writeJson(path.join(OUTPUT_DIR, "company", "employees.json"), employees);

  const docs = [
    ["overview", "company_overview.md"],
    ["initiatives", "initiatives.md"],
    ["projects", "project_list.txt"],
    ["org-chart", "visual_employee_directory.txt"],
  ];

  for (const [id, fileName] of docs) {
    const text = await readFile(path.join(SOURCE_DIR, fileName), "utf8");
    await writeJson(path.join(OUTPUT_DIR, "company", `${id}.json`), {
      id: `company:${id}`,
      scope: "company",
      title: id
        .split("-")
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" "),
      text,
      sourcePath: fileName,
    });
  }
}

async function main() {
  const employees = extractEmployees(
    await readFile(path.join(SOURCE_DIR, "employee_directory.yaml"), "utf8"),
  );
  const people = makePeopleLookup(employees);
  const selectedUsers = new Set(selectedUserIds);
  const routes = new Map();
  const appRouteCounts = Object.fromEntries(appNames.map((app) => [app, 0]));
  let readCount = 0;
  let selectedCount = 0;

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  await buildCompanySeed(employees);

  const sourceAppNames = [...new Set(appNames.map((app) => app.replace("-", "_")))];

  for (const sourceApp of sourceAppNames) {
    const appDir = path.join(SOURCE_DIR, "sources", sourceApp);
    const app = sourceApps[sourceApp] ?? sourceApp;

    for await (const filePath of walkJsonFiles(appDir)) {
      readCount += 1;
      if (readCount % 50 === 0) {
        process.stdout.write(`\rProcessing files... ${readCount}`);
      }
      const source = await readJson(filePath);
      const normalized = normalizeByApp(sourceApp, source, filePath, people);
      if (!normalized) continue;

      const selectedPeople = normalized.card.peopleIds.filter((id) => selectedUsers.has(id));
      const userRoutes = normalized.userRoutes.filter((route) => {
        const userId = route.split("/")[1];
        return selectedUsers.has(userId);
      });
      const appRoutes = selectedPeople.length > 0 ? normalized.appRoutes : [];

      if (userRoutes.length === 0 && appRoutes.length === 0) continue;

      selectedCount += 1;
      for (const route of userRoutes) addRoute(routes, route, normalized.card);
      for (const route of appRoutes) {
        addRoute(routes, route, normalized.card);
        appRouteCounts[app] += 1;
      }
    }
  }

  const rankedAppRoutes = new Map();
  for (const [route, cards] of routes.entries()) {
    if (!routeIsApp(route)) continue;
    const app = routeApp(route);
    if (!rankedAppRoutes.has(app)) rankedAppRoutes.set(app, []);
    rankedAppRoutes.get(app).push([route, cards]);
  }

  const keptRoutes = new Set([...routes.keys()].filter(routeIsUser));
  for (const [, entries] of rankedAppRoutes.entries()) {
    entries
      .sort(([, leftCards], [, rightCards]) => rightCards.size - leftCards.size)
      .slice(0, APP_ROUTE_LIMIT_PER_APP)
      .forEach(([route]) => keptRoutes.add(route));
  }

  const routeManifest = {};
  for (const [route, cards] of [...routes.entries()]
    .filter(([route]) => keptRoutes.has(route))
    .sort(([left], [right]) => left.localeCompare(right))) {
    routeManifest[route] = await writePagedRoute(route, cards.values());
  }

  await writeJson(path.join(OUTPUT_DIR, "manifest.json"), {
    schemaVersion: 1,
    pageSize: PAGE_SIZE,
    source: "local/generated_data",
    sourceFilesRead: readCount,
    selectedSourceRecords: selectedCount,
    selectedUsers: selectedUserIds,
    employees: {
      count: employees.length,
      path: "/seed/company/employees.json",
    },
    company: {
      overview: "/seed/company/overview.json",
      initiatives: "/seed/company/initiatives.json",
      projects: "/seed/company/projects.json",
      orgChart: "/seed/company/org-chart.json",
    },
    routes: routeManifest,
  });

  console.log(
    `Wrote ${Object.keys(routeManifest).length} seed routes from ${readCount} source files to ${path.relative(
      process.cwd(),
      OUTPUT_DIR,
    )}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
