"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Bookmark,
  Bug,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  KanbanSquare,
  ListFilter,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { appUsers } from "@/lib/users";
import { useActiveUser } from "@/lib/stores/user-store";
import { cn } from "@/lib/utils";
import {
  canAccessProject,
  formatJiraDate,
  issueActivityTime,
  jiraIssueTypes,
  jiraPriorities,
  jiraStatuses,
  jiraViews,
  relativeTime,
  useJiraStore,
  type JiraIssue,
  type JiraIssueType,
  type JiraPriority,
  type JiraProject,
  type JiraStatus,
  type JiraView,
} from "@/app/jira/jira-state";

function normalizeView(value: string | null): JiraView {
  return jiraViews.includes(value as JiraView) ? (value as JiraView) : "board";
}

function userName(id: string | null) {
  if (!id) return "Unassigned";
  return appUsers.find((user) => user.id === id)?.name ?? "Unknown";
}

function userInitials(id: string | null) {
  if (!id) return "UA";
  return appUsers.find((user) => user.id === id)?.initials ?? "??";
}

function priorityTone(priority: JiraPriority) {
  if (priority === "Highest") return "text-red-600";
  if (priority === "High") return "text-orange-600";
  if (priority === "Medium") return "text-blue-600";
  return "text-muted-foreground";
}

function typeIcon(type: JiraIssueType) {
  if (type === "Bug") return <Bug className="size-3.5 text-red-600" />;
  if (type === "Epic") return <Sparkles className="size-3.5 text-purple-600" />;
  if (type === "Task") return <CheckCircle2 className="size-3.5 text-blue-600" />;
  return <Bookmark className="size-3.5 text-emerald-600" />;
}

export function JiraApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeUser = useActiveUser();
  const projects = useJiraStore((state) => state.projects);
  const issues = useJiraStore((state) => state.issues);
  const loadCorpusPage = useJiraStore((state) => state.loadCorpusPage);
  const createIssue = useJiraStore((state) => state.createIssue);
  const updateStatus = useJiraStore((state) => state.updateStatus);
  const updateAssignee = useJiraStore((state) => state.updateAssignee);
  const updatePriority = useJiraStore((state) => state.updatePriority);
  const updateStoryPoints = useJiraStore((state) => state.updateStoryPoints);
  const updateIssueType = useJiraStore((state) => state.updateIssueType);
  const updateSprint = useJiraStore((state) => state.updateSprint);
  const updateDueDate = useJiraStore((state) => state.updateDueDate);
  const updateLabels = useJiraStore((state) => state.updateLabels);
  const updateIssueText = useJiraStore((state) => state.updateIssueText);
  const toggleWatcher = useJiraStore((state) => state.toggleWatcher);
  const addComment = useJiraStore((state) => state.addComment);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [commentState, setCommentState] = useState({ key: "", value: "" });

  const previousUserId = useRef(activeUser?.id);

  useEffect(() => {
    void loadCorpusPage(1);
  }, [loadCorpusPage]);

  const accessibleProjects = useMemo(
    () =>
      Object.values(projects).filter(
        (project) => activeUser?.id && canAccessProject(project, activeUser.id),
      ),
    [activeUser, projects],
  );
  const fallbackProject = accessibleProjects[0]?.id ?? "cos";
  const projectParam = searchParams.get("project");
  const projectId =
    activeUser?.id && canAccessProject(projects[projectParam ?? ""], activeUser.id)
      ? (projectParam ?? fallbackProject)
      : fallbackProject;
  const project = projects[projectId];
  const view = normalizeView(searchParams.get("view"));
  const issueId = searchParams.get("issue");
  const query = searchParams.get("q") ?? "";
  const statusFilter = searchParams.get("status") ?? "all";
  const assigneeFilter = searchParams.get("assignee") ?? "all";
  const reporterFilter = searchParams.get("reporter") ?? "all";
  const typeFilter = searchParams.get("type") ?? "all";
  const priorityFilter = searchParams.get("priority") ?? "all";
  const normalizedQuery = query.trim().toLowerCase();
  const commentKey = `${activeUser?.id}:${projectId}:${issueId ?? "list"}`;
  const commentDraft = commentState.key === commentKey ? commentState.value : "";

  function setCommentDraft(value: string) {
    setCommentState({ key: commentKey, value });
  }

  function updateUrl(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (previousUserId.current === activeUser?.id) return;
    previousUserId.current = activeUser?.id;
    const nextProject =
      Object.values(projects).find(
        (item) => activeUser?.id && canAccessProject(item, activeUser.id),
      )?.id ?? "cos";
    router.replace(`${pathname}?project=${nextProject}&view=board`);
  }, [activeUser, pathname, projects, router]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (!activeUser || !canAccessProject(projects[projectParam ?? ""], activeUser.id)) {
      params.set("project", fallbackProject);
      params.set("view", "board");
      params.delete("issue");
      params.delete("q");
      params.delete("status");
      params.delete("assignee");
      params.delete("type");
      params.delete("priority");
      changed = true;
    }

    const selectedIssue = issueId ? issues[issueId] : null;
    if (issueId && (!selectedIssue || selectedIssue.projectId !== projectId)) {
      params.delete("issue");
      changed = true;
    }

    if (changed) router.replace(`${pathname}?${params.toString()}`);
  }, [
    activeUser,
    fallbackProject,
    issueId,
    issues,
    pathname,
    projectId,
    projectParam,
    projects,
    router,
    searchParams,
  ]);

  const projectIssues = Object.values(issues)
    .filter((issue) => issue.projectId === projectId)
    .filter((issue) => {
      if (statusFilter !== "all" && issue.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && (issue.assigneeId ?? "unassigned") !== assigneeFilter) {
        return false;
      }
      if (reporterFilter !== "all" && issue.reporterId !== reporterFilter) return false;
      if (typeFilter !== "all" && issue.type !== typeFilter) return false;
      if (priorityFilter !== "all" && issue.priority !== priorityFilter) return false;
      if (!normalizedQuery) return true;
      return [
        issue.key,
        issue.summary,
        issue.description,
        issue.labels.join(" "),
        issue.comments.map((comment) => comment.body).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((a, b) => {
      const activityDelta = issueActivityTime(b) - issueActivityTime(a);
      if (activityDelta !== 0) return activityDelta;
      return b.number - a.number;
    })
    .slice(0, 100);
  const selectedIssue =
    issueId && issues[issueId]?.projectId === projectId ? issues[issueId] : null;

  const sidebar = (
    <JiraSidebar
      projects={accessibleProjects}
      activeProjectId={projectId}
      issues={issues}
      onProject={(id) => {
        updateUrl({
          project: id,
          view: "board",
          issue: null,
          q: null,
          status: null,
          assignee: null,
          reporter: null,
          type: null,
          priority: null,
        });
        setSidebarOpen(false);
      }}
    />
  );

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 bg-[#f7f8f9] text-sm text-[#172b4d] dark:bg-[#101214] dark:text-[#dee4ea]">
      <aside className="hidden w-72 shrink-0 border-r border-[#dfe1e6] bg-white lg:block dark:border-[#2c333a] dark:bg-[#161a1d]">
        {sidebar}
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-80 border-[#dfe1e6] bg-white p-0 dark:border-[#2c333a] dark:bg-[#161a1d]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Jira navigation</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#dfe1e6] bg-white dark:border-[#2c333a] dark:bg-[#161a1d]">
          <div className="flex h-14 items-center gap-3 px-4">
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 truncate text-base font-semibold">
                <span>{project?.name}</span>
                <Badge variant="secondary">{project?.key}</Badge>
              </div>
              <div className="truncate text-xs text-muted-foreground">{project?.description}</div>
            </div>
            <Button
              className="cursor-pointer bg-[#0c66e4] text-white hover:bg-[#0052cc]"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Create
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
            <Tabs value={view} onValueChange={(value) => updateUrl({ view: value, issue: null })}>
              <TabsList className="bg-[#f1f2f4] dark:bg-[#22272b]">
                <TabsTrigger className="cursor-pointer gap-2" value="board">
                  <KanbanSquare className="size-4" />
                  Board
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer gap-2" value="backlog">
                  <ClipboardList className="size-4" />
                  Backlog
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative min-w-56 flex-1 sm:max-w-sm">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 bg-white pl-9 dark:bg-[#101214]"
                placeholder="Search issues"
                value={query}
                onChange={(event) => updateUrl({ q: event.target.value || null, issue: null })}
              />
            </div>
            <JiraFilters
              project={project}
              status={statusFilter}
              assignee={assigneeFilter}
              reporter={reporterFilter}
              type={typeFilter}
              priority={priorityFilter}
              onChange={(next) => updateUrl({ ...next, issue: null })}
            />
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            {selectedIssue ? (
              <IssueDetail
                issue={selectedIssue}
                project={project}
                activeUserId={activeUser?.id ?? ""}
                commentDraft={commentDraft}
                onCommentDraft={setCommentDraft}
                onBack={() => updateUrl({ issue: null })}
                onStatus={(status) => {
                  if (activeUser) updateStatus(selectedIssue.id, activeUser.id, status);
                }}
                onAssignee={(assigneeId) => {
                  if (activeUser) updateAssignee(selectedIssue.id, activeUser.id, assigneeId);
                }}
                onPriority={(priority) => {
                  if (activeUser) updatePriority(selectedIssue.id, activeUser.id, priority);
                }}
                onStoryPoints={(points) => {
                  if (activeUser) updateStoryPoints(selectedIssue.id, activeUser.id, points);
                }}
                onType={(type) => {
                  if (activeUser) updateIssueType(selectedIssue.id, activeUser.id, type);
                }}
                onSprint={(sprint) => {
                  if (activeUser) updateSprint(selectedIssue.id, activeUser.id, sprint);
                }}
                onDueDate={(dueDate) => {
                  if (activeUser) updateDueDate(selectedIssue.id, activeUser.id, dueDate);
                }}
                onLabels={(labels) => {
                  if (activeUser) updateLabels(selectedIssue.id, activeUser.id, labels);
                }}
                onWatch={() => {
                  if (activeUser) toggleWatcher(selectedIssue.id, activeUser.id);
                }}
                onSaveText={(summary, description) => {
                  if (activeUser)
                    updateIssueText(selectedIssue.id, activeUser.id, summary, description);
                }}
                onComment={() => {
                  if (activeUser) addComment(selectedIssue.id, activeUser.id, commentDraft);

                  setCommentDraft("");
                }}
              />
            ) : view === "board" ? (
              <BoardView
                issues={projectIssues}
                onOpen={(id) => updateUrl({ issue: id })}
                onStatus={(id, status) => {
                  if (activeUser) updateStatus(id, activeUser.id, status);
                }}
              />
            ) : (
              <BacklogView
                issues={projectIssues}
                project={project}
                onOpen={(id) => updateUrl({ issue: id })}
                onStatus={(id, status) => {
                  if (activeUser) updateStatus(id, activeUser.id, status);
                }}
                onAssignee={(id, assigneeId) => {
                  if (activeUser) updateAssignee(id, activeUser.id, assigneeId);
                }}
                onPriority={(id, priority) => {
                  if (activeUser) updatePriority(id, activeUser.id, priority);
                }}
              />
            )}
          </div>
        </ScrollArea>
      </section>

      <CreateIssueDialog
        open={createOpen}
        project={project}
        activeUserId={activeUser?.id ?? ""}
        onOpenChange={setCreateOpen}
        onCreate={(input) => {
          if (!activeUser) return;
          const created = createIssue({ ...input, projectId, actorId: activeUser.id });
          if (!created) return;

          setCreateOpen(false);
          updateUrl({ issue: created, view: "board", q: null, status: null, assignee: null });
        }}
      />
    </main>
  );
}

function JiraSidebar({
  projects,
  activeProjectId,
  issues,
  onProject,
}: {
  projects: JiraProject[];
  activeProjectId: string;
  issues: Record<string, JiraIssue>;
  onProject: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#dfe1e6] p-4 dark:border-[#2c333a]">
        <div className="font-semibold">Jira</div>
        <div className="text-xs text-muted-foreground">Corp software projects</div>
      </div>
      <div className="p-3">
        <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">Projects</div>
        {projects.map((project) => {
          const openCount = Object.values(issues).filter(
            (issue) => issue.projectId === project.id && issue.status !== "Done",
          ).length;
          return (
            <button
              key={project.id}
              className={cn(
                "mb-1 w-full cursor-pointer rounded-md border border-transparent px-3 py-2 text-left hover:bg-[#f1f2f4] dark:hover:bg-[#22272b]",
                activeProjectId === project.id &&
                  "border-[#dfe1e6] bg-[#e9f2ff] dark:border-[#2c333a] dark:bg-[#092957]",
              )}
              onClick={() => onProject(project.id)}
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded bg-[#0c66e4] text-xs font-bold text-white">
                  {project?.key?.slice(0, 2) ?? ""}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{project?.name}</span>
                <Badge variant="secondary">{openCount}</Badge>
              </div>
              <div className="mt-1 truncate pl-9 text-xs text-muted-foreground">
                Lead: {userName(project.leadId)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function JiraFilters({
  project,
  status,
  assignee,
  reporter,
  type,
  priority,
  onChange,
}: {
  project: JiraProject;
  status: string;
  assignee: string;
  reporter: string;
  type: string;
  priority: string;
  onChange: (next: Record<string, string | null>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ListFilter className="size-4 text-muted-foreground" />
      <SmallSelect
        value={status}
        onValueChange={(value) => onChange({ status: value === "all" ? null : value })}
        items={["all", ...jiraStatuses]}
      />
      <SmallSelect
        value={assignee}
        onValueChange={(value) => onChange({ assignee: value === "all" ? null : value })}
        items={["all", "unassigned", ...(project?.memberIds || [])]}
        renderItem={(value) => (value === "all" ? "All assignees" : userName(value))}
      />
      <SmallSelect
        value={reporter}
        onValueChange={(value) => onChange({ reporter: value === "all" ? null : value })}
        items={["all", ...(project?.memberIds || [])]}
        renderItem={(value) => (value === "all" ? "All reporters" : userName(value))}
      />
      <SmallSelect
        value={type}
        onValueChange={(value) => onChange({ type: value === "all" ? null : value })}
        items={["all", ...jiraIssueTypes]}
      />
      <SmallSelect
        value={priority}
        onValueChange={(value) => onChange({ priority: value === "all" ? null : value })}
        items={["all", ...jiraPriorities]}
      />
    </div>
  );
}

function SmallSelect({
  value,
  items,
  onValueChange,
  renderItem = (item) => (item === "all" ? "All" : item),
}: {
  value: string;
  items: string[];
  onValueChange: (value: string | null) => void;
  renderItem?: (item: string) => string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" className="cursor-pointer bg-white dark:bg-[#101214]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item} value={item}>
            {renderItem(item)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BoardView({
  issues,
  onOpen,
  onStatus,
}: {
  issues: JiraIssue[];
  onOpen: (id: string) => void;
  onStatus: (id: string, status: JiraStatus) => void;
}) {
  return (
    <div className="grid min-w-245 gap-3 xl:min-w-0 xl:grid-cols-5">
      {jiraStatuses.map((status) => {
        const columnIssues = issues.filter((issue) => issue.status === status);
        return (
          <section
            key={status}
            className="min-h-136 rounded-md border border-[#dfe1e6] bg-[#f1f2f4] dark:border-[#2c333a] dark:bg-[#1d2125]"
          >
            <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{status}</span>
              <Badge variant="secondary">{columnIssues.length}</Badge>
            </div>
            <div className="space-y-2 p-2">
              {columnIssues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} onOpen={onOpen} onStatus={onStatus} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function IssueCard({
  issue,
  onOpen,
  onStatus,
}: {
  issue: JiraIssue;
  onOpen: (id: string) => void;
  onStatus: (id: string, status: JiraStatus) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="issue-card"
      className="w-full cursor-pointer rounded-md border border-[#dfe1e6] bg-white p-3 text-left shadow-xs hover:border-[#0c66e4] dark:border-[#2c333a] dark:bg-[#161a1d]"
      onClick={() => onOpen(issue.id)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(issue.id)}
    >
      <div className="flex items-start gap-2">
        {typeIcon(issue.type)}
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 font-medium leading-5">{issue.summary}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {issue.labels.slice(0, 2).map((label) => (
              <Badge key={label} variant="secondary" className="text-[10px]">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
        <AlertCircle className={cn("size-3.5", priorityTone(issue.priority))} />
        <span className="rounded bg-[#f1f2f4] px-1.5 py-0.5 text-xs dark:bg-[#22272b]">
          {issue.storyPoints ?? "-"}
        </span>
        <Avatar size="sm" className="ml-auto">
          <AvatarFallback>{userInitials(issue.assigneeId)}</AvatarFallback>
        </Avatar>
      </div>
      <div className="mt-2" onClick={(event) => event.stopPropagation()}>
        <SmallSelect
          value={issue.status}
          items={jiraStatuses}
          onValueChange={(value) => value && onStatus(issue.id, value as JiraStatus)}
        />
      </div>
    </div>
  );
}

function BacklogView({
  issues,
  project,
  onOpen,
  onStatus,
  onAssignee,
  onPriority,
}: {
  issues: JiraIssue[];
  project: JiraProject;
  onOpen: (id: string) => void;
  onStatus: (id: string, status: JiraStatus) => void;
  onAssignee: (id: string, assigneeId: string | null) => void;
  onPriority: (id: string, priority: JiraPriority) => void;
}) {
  if (issues.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-md border border-[#dfe1e6] bg-white text-muted-foreground dark:border-[#2c333a] dark:bg-[#161a1d]">
        <ClipboardList className="size-10" />
        <p>No issues match this view.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-[#dfe1e6] bg-white dark:border-[#2c333a] dark:bg-[#161a1d]">
      {issues.map((issue) => (
        <div
          key={issue.id}
          role="button"
          tabIndex={0}
          data-testid="issue-card"
          className="grid w-full cursor-pointer grid-cols-[1fr_auto] gap-3 border-b border-[#dfe1e6] p-3 text-left last:border-b-0 hover:bg-[#f7f8f9] md:grid-cols-[7rem_1fr_8rem_8rem_7rem_auto] dark:border-[#2c333a] dark:hover:bg-[#22272b]"
          onClick={() => onOpen(issue.id)}
          onKeyDown={(e) => e.key === "Enter" && onOpen(issue.id)}
        >
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {typeIcon(issue.type)}
            {issue.key}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium">{issue.summary}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <Badge key={label} variant="secondary" className="text-[10px]">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
            <SmallSelect
              value={issue.status}
              items={jiraStatuses}
              onValueChange={(status) => status && onStatus(issue.id, status as JiraStatus)}
            />
          </div>
          <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
            <SmallSelect
              value={issue.assigneeId ?? "unassigned"}
              items={["unassigned", ...(project?.memberIds || [])]}
              onValueChange={(value) =>
                value && onAssignee(issue.id, value === "unassigned" ? null : value)
              }
              renderItem={(value) => userName(value)}
            />
          </div>
          <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
            <SmallSelect
              value={issue.priority}
              items={jiraPriorities}
              onValueChange={(priority) =>
                priority && onPriority(issue.id, priority as JiraPriority)
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{issue.comments.length}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </div>
      ))}
    </div>
  );
}

function IssueDetail({
  issue,
  project,
  activeUserId,
  commentDraft,
  onCommentDraft,
  onBack,
  onStatus,
  onAssignee,
  onPriority,
  onStoryPoints,
  onWatch,
  onSaveText,
  onComment,
  onType,
  onSprint,
  onDueDate,
  onLabels,
}: {
  issue: JiraIssue;
  project: JiraProject;
  activeUserId: string;
  commentDraft: string;
  onCommentDraft: (value: string) => void;
  onBack: () => void;
  onStatus: (status: JiraStatus) => void;
  onAssignee: (assigneeId: string | null) => void;
  onPriority: (priority: JiraPriority) => void;
  onStoryPoints: (points: number | null) => void;
  onWatch: () => void;
  onSaveText: (summary: string, description: string) => void;
  onComment: () => void;
  onType: (type: JiraIssueType) => void;
  onSprint: (sprint: string) => void;
  onDueDate: (dueDate: string) => void;
  onLabels: (labels: string[]) => void;
}) {
  const [textState, setTextState] = useState({ key: "", summary: "", description: "" });
  const watching = issue.watcherIds.includes(activeUserId);
  const summary = textState.key === issue.id ? textState.summary : issue.summary;
  const description = textState.key === issue.id ? textState.description : issue.description;

  function setSummary(value: string) {
    setTextState({ key: issue.id, summary: value, description });
  }

  function setDescription(value: string) {
    setTextState({ key: issue.id, summary, description: value });
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        <Button variant="ghost" className="mb-3 cursor-pointer" onClick={onBack}>
          Back to {project?.name}
        </Button>
        <div className="rounded-md border border-[#dfe1e6] bg-white p-4 dark:border-[#2c333a] dark:bg-[#161a1d]">
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Select value={issue.type} onValueChange={(value) => onType(value as JiraIssueType)}>
              <SelectTrigger className="h-6 w-auto border-transparent px-1 py-0 shadow-none focus:ring-0">
                <div className="flex items-center gap-1">
                  {typeIcon(issue.type)}
                  <span>{issue.type}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {jiraIssueTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      {typeIcon(type as JiraIssueType)}
                      <span>{type}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="font-mono">{issue.key}</span>
            <span>Created {formatJiraDate(issue.createdAt)}</span>
            <span>Updated {relativeTime(issueActivityTime(issue))}</span>
          </div>
          <Input
            className="h-auto border-transparent px-0 text-xl font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            onBlur={() => onSaveText(summary, description)}
          />
          <Textarea
            className="mt-3 min-h-36 resize-none"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => onSaveText(summary, description)}
          />
        </div>

        <div className="mt-4 rounded-md border border-[#dfe1e6] bg-white p-4 dark:border-[#2c333a] dark:bg-[#161a1d]">
          <div className="mb-3 font-semibold">Activity</div>
          <div className="space-y-3">
            {[...issue.activity]
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 8)
              .map((item) => (
                <div key={item.id} className="flex gap-3">
                  <Avatar size="sm">
                    <AvatarFallback>{userInitials(item.actorId)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm">
                      <span className="font-medium">{userName(item.actorId)}</span>{" "}
                      <span className="text-muted-foreground">{item.body}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatJiraDate(item.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
          <Separator className="my-4" />
          <div className="space-y-3">
            {issue.comments.map((comment) => (
              <div key={comment.id} id={comment.id} className="flex gap-3">
                <Avatar>
                  <AvatarFallback>{userInitials(comment.authorId)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 rounded-md bg-[#f7f8f9] p-3 dark:bg-[#22272b]">
                  <div className="text-sm">
                    <span className="font-medium">{userName(comment.authorId)}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      commented {relativeTime(comment.timestamp)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line leading-6">{comment.body}</p>
                </div>
              </div>
            ))}
          </div>
          <form
            className="mt-4 flex gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              onComment();
            }}
          >
            <Avatar>
              <AvatarFallback>{userInitials(activeUserId)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <Textarea
                placeholder="Add a comment"
                value={commentDraft}
                onChange={(event) => onCommentDraft(event.target.value)}
              />
              <Button
                className="mt-2 cursor-pointer bg-[#0c66e4] text-white hover:bg-[#0052cc]"
                disabled={!commentDraft.trim()}
                size="sm"
                type="submit"
              >
                Save comment
              </Button>
            </div>
          </form>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-md border border-[#dfe1e6] bg-white p-3 dark:border-[#2c333a] dark:bg-[#161a1d]">
          <div className="mb-3 font-semibold">Details</div>
          <DetailSelect
            label="Status"
            value={issue.status}
            items={jiraStatuses}
            onChange={onStatus}
          />
          <DetailSelect
            label="Priority"
            value={issue.priority}
            items={jiraPriorities}
            onChange={onPriority}
          />
          <DetailSelect
            label="Assignee"
            value={issue.assigneeId ?? "unassigned"}
            items={["unassigned", ...(project?.memberIds || [])]}
            onChange={(value) => onAssignee(value === "unassigned" ? null : value)}
            renderItem={(value) => userName(value)}
          />
          <DetailSelect
            label="Story points"
            value={String(issue.storyPoints ?? 0)}
            items={["0", "1", "2", "3", "5", "8", "13"]}
            onChange={(value) => onStoryPoints(value === "0" ? null : Number(value))}
            renderItem={(value) => (value === "0" ? "None" : value)}
          />
          <Separator className="my-3" />
          <MetaRow
            icon={<UserRound className="size-4" />}
            label="Reporter"
            value={userName(issue.reporterId)}
          />
          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-4" />
              Due
            </div>
            <Input
              type="date"
              className="h-7 w-30 px-2 py-1 text-xs"
              value={issue.dueDate}
              onChange={(e) => onDueDate(e.target.value)}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CircleDot className="size-4" />
              Sprint
            </div>
            <Input
              className="h-7 w-30 px-2 py-1 text-xs"
              value={issue.sprint}
              onChange={(e) => onSprint(e.target.value)}
            />
          </div>
          <Button
            variant={watching ? "secondary" : "outline"}
            className="mt-3 w-full cursor-pointer"
            onClick={onWatch}
          >
            {watching ? "Watching" : "Watch issue"}
          </Button>
        </div>
        <div className="rounded-md border border-[#dfe1e6] bg-white p-3 dark:border-[#2c333a] dark:bg-[#161a1d]">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Labels</div>
          <Input
            className="mb-2 h-7 text-xs"
            placeholder="Comma separated"
            defaultValue={issue.labels.join(", ")}
            onBlur={(e) => onLabels(e.target.value.split(","))}
            onKeyDown={(e) => e.key === "Enter" && onLabels(e.currentTarget.value.split(","))}
          />
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function DetailSelect<T extends string>({
  label,
  value,
  items,
  onChange,
  renderItem = (item) => item,
}: {
  label: string;
  value: T;
  items: T[];
  onChange: (value: T) => void;
  renderItem?: (item: T) => string;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <SmallSelect
        value={value}
        items={items}
        onValueChange={(next) => next && onChange(next as T)}
        renderItem={(item) => renderItem(item as T)}
      />
    </div>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-20 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate">{value}</span>
    </div>
  );
}

function CreateIssueDialog({
  open,
  project,
  activeUserId,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  project: JiraProject;
  activeUserId: string;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: {
    type: JiraIssueType;
    summary: string;
    description: string;
    priority: JiraPriority;
    assigneeId: string | null;
    labels: string[];
    sprint: string;
    storyPoints: number | null;
    dueDate: string;
  }) => void;
}) {
  const [type, setType] = useState<JiraIssueType>("Task");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<JiraPriority>("Medium");
  const [assigneeId, setAssigneeId] = useState<string | null>(activeUserId);
  const [labels, setLabels] = useState("triage, frontend");
  const [sprint, setSprint] = useState("Sprint 14");
  const [storyPoints, setStoryPoints] = useState("3");
  const [dueDate, setDueDate] = useState("2026-07-18");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setType("Task");
      setSummary("");
      setDescription("");
      setPriority("Medium");
      setAssigneeId(activeUserId);
      setLabels("triage, frontend");
      setSprint("Sprint 14");
      setStoryPoints("3");
      setDueDate("2026-07-18");
    }
  }, [open, activeUserId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create issue</DialogTitle>
          <DialogDescription>
            {project?.name} · reporter {userName(activeUserId)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Summary</div>
            <Input autoFocus value={summary} onChange={(event) => setSummary(event.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Description</div>
            <Textarea
              className="min-h-28"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogField label="Type">
            <SmallSelect
              value={type}
              items={jiraIssueTypes}
              onValueChange={(value) => setType(value as JiraIssueType)}
            />
          </DialogField>
          <DialogField label="Priority">
            <SmallSelect
              value={priority}
              items={jiraPriorities}
              onValueChange={(value) => setPriority(value as JiraPriority)}
            />
          </DialogField>
          <DialogField label="Assignee">
            <SmallSelect
              value={assigneeId ?? "unassigned"}
              items={["unassigned", ...(project?.memberIds || [])]}
              onValueChange={(value) => setAssigneeId(value === "unassigned" ? null : value)}
              renderItem={(value) => userName(value)}
            />
          </DialogField>
          <DialogField label="Story points">
            <Input value={storyPoints} onChange={(event) => setStoryPoints(event.target.value)} />
          </DialogField>
          <DialogField label="Sprint">
            <Input value={sprint} onChange={(event) => setSprint(event.target.value)} />
          </DialogField>
          <DialogField label="Due date">
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </DialogField>
          <div className="sm:col-span-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Labels</div>
            <Input value={labels} onChange={(event) => setLabels(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button className="cursor-pointer" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="cursor-pointer bg-[#0c66e4] text-white hover:bg-[#0052cc]"
            disabled={!summary.trim()}
            onClick={() =>
              onCreate({
                type,
                summary,
                description,
                priority,
                assigneeId,
                labels: labels
                  .split(",")
                  .map((label) => label.trim())
                  .filter(Boolean),
                sprint,
                storyPoints: Number.isFinite(Number(storyPoints)) ? Number(storyPoints) : null,
                dueDate,
              })
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
