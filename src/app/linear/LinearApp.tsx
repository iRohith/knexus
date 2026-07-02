"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Bell,
  Circle,
  CircleCheck,
  Clock3,
  Columns3,
  List,
  Menu,
  MessageSquare,
  Plus,
  Search,
  SignalHigh,
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
import { useActiveUser } from "@/lib/user-store";
import { cn } from "@/lib/utils";
import {
  canAccessTeam,
  formatLinearDate,
  issueActivityTime,
  linearPriorities,
  linearStatuses,
  linearViews,
  relativeTime,
  useLinearStore,
  type LinearCycle,
  type LinearIssue,
  type LinearPriority,
  type LinearProject,
  type LinearStatus,
  type LinearTeam,
  type LinearView,
} from "@/app/linear/linear-state";

function normalizeView(value: string | null): LinearView {
  return linearViews.includes(value as LinearView) ? (value as LinearView) : "list";
}

function userName(id: string | null) {
  if (!id) return "Unassigned";
  return appUsers.find((user) => user.id === id)?.name ?? "Unknown";
}

function initials(id: string | null) {
  if (!id) return "UA";
  return appUsers.find((user) => user.id === id)?.initials ?? "??";
}

function statusIcon(status: LinearStatus) {
  if (status === "Done") return <CircleCheck className="size-4 text-emerald-500" />;
  if (status === "Canceled") return <Archive className="size-4 text-muted-foreground" />;
  if (status === "In Progress" || status === "In Review")
    return <Clock3 className="size-4 text-amber-500" />;
  return <Circle className="size-4 text-muted-foreground" />;
}

function priorityClass(priority: LinearPriority) {
  if (priority === "Urgent") return "text-red-500";
  if (priority === "High") return "text-orange-500";
  if (priority === "Medium") return "text-blue-500";
  return "text-muted-foreground";
}

export function LinearApp({
  onAction,
}: { onAction?: (action: { type: string; payload: unknown }) => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeUser = useActiveUser();
  const teams = useLinearStore((state) => state.teams);
  const projects = useLinearStore((state) => state.projects);
  const cycles = useLinearStore((state) => state.cycles);
  const issues = useLinearStore((state) => state.issues);
  const createIssue = useLinearStore((state) => state.createIssue);
  const updateIssueText = useLinearStore((state) => state.updateIssueText);
  const updateStatus = useLinearStore((state) => state.updateStatus);
  const updatePriority = useLinearStore((state) => state.updatePriority);
  const updateAssignee = useLinearStore((state) => state.updateAssignee);
  const updateCycle = useLinearStore((state) => state.updateCycle);
  const updateProject = useLinearStore((state) => state.updateProject);
  const updateEstimate = useLinearStore((state) => state.updateEstimate);
  const updateLabels = useLinearStore((state) => state.updateLabels);
  const toggleSubscriber = useLinearStore((state) => state.toggleSubscriber);
  const addComment = useLinearStore((state) => state.addComment);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [commentState, setCommentState] = useState({ key: "", value: "" });
  const previousUserId = useRef(activeUser.id);

  const accessibleTeams = useMemo(
    () => Object.values(teams).filter((team) => canAccessTeam(team, activeUser.id)),
    [activeUser.id, teams],
  );
  const fallbackTeam = accessibleTeams[0]?.id ?? "core";
  const teamParam = searchParams.get("team");
  const teamId = canAccessTeam(teams[teamParam ?? ""], activeUser.id)
    ? (teamParam ?? fallbackTeam)
    : fallbackTeam;
  const team = teams[teamId];
  const view = normalizeView(searchParams.get("view"));
  const issueId = searchParams.get("issue");
  const query = searchParams.get("q") ?? "";
  const statusFilter = searchParams.get("status") ?? "all";
  const priorityFilter = searchParams.get("priority") ?? "all";
  const assigneeFilter = searchParams.get("assignee") ?? "all";
  const cycleFilter = searchParams.get("cycle") ?? "all";
  const normalizedQuery = query.trim().toLowerCase();
  const commentKey = `${activeUser.id}:${teamId}:${issueId ?? "list"}`;
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
    if (previousUserId.current === activeUser.id) return;
    previousUserId.current = activeUser.id;
    const nextTeam =
      Object.values(teams).find((item) => canAccessTeam(item, activeUser.id))?.id ?? "core";
    router.replace(`${pathname}?team=${nextTeam}&view=list`);
  }, [activeUser.id, pathname, router, teams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    if (!canAccessTeam(teams[teamParam ?? ""], activeUser.id)) {
      params.set("team", fallbackTeam);
      params.set("view", "list");
      ["issue", "q", "status", "priority", "assignee", "cycle"].forEach((key) =>
        params.delete(key),
      );
      changed = true;
    }
    const selected = issueId ? issues[issueId] : null;
    if (issueId && (!selected || selected.teamId !== teamId)) {
      params.delete("issue");
      changed = true;
    }
    if (changed) router.replace(`${pathname}?${params.toString()}`);
  }, [
    activeUser.id,
    fallbackTeam,
    issueId,
    issues,
    pathname,
    router,
    searchParams,
    teamId,
    teamParam,
    teams,
  ]);

  const teamProjects = Object.values(projects).filter((project) => project.teamId === teamId);
  const teamCycles = Object.values(cycles).filter((cycle) => cycle.teamId === teamId);
  const filteredIssues = Object.values(issues)
    .filter((issue) => issue.teamId === teamId)
    .filter((issue) => {
      if (statusFilter !== "all" && issue.status !== statusFilter) return false;
      if (priorityFilter !== "all" && issue.priority !== priorityFilter) return false;
      if (assigneeFilter !== "all" && (issue.assigneeId ?? "unassigned") !== assigneeFilter)
        return false;
      if (cycleFilter !== "all" && issue.cycleId !== cycleFilter) return false;
      if (!normalizedQuery) return true;
      return [
        issue.identifier,
        issue.title,
        issue.description,
        issue.labels.join(" "),
        issue.comments.map((comment) => comment.body).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((a, b) => issueActivityTime(b) - issueActivityTime(a) || b.number - a.number);
  const selectedIssue = issueId && issues[issueId]?.teamId === teamId ? issues[issueId] : null;

  const sidebar = (
    <LinearSidebar
      teams={accessibleTeams}
      activeTeamId={teamId}
      issues={issues}
      onTeam={(id) => {
        updateUrl({
          team: id,
          view: "list",
          issue: null,
          q: null,
          status: null,
          priority: null,
          assignee: null,
          cycle: null,
        });
        setSidebarOpen(false);
      }}
    />
  );

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 bg-[#f7f8fb] text-sm text-[#1f2430] dark:bg-[#0f1015] dark:text-[#f2f3f8]">
      <aside className="hidden w-72 shrink-0 border-r border-[#e2e4ea] bg-white lg:block dark:border-[#2a2d36] dark:bg-[#171922]">
        {sidebar}
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-80 border-[#e2e4ea] bg-white p-0 dark:border-[#2a2d36] dark:bg-[#171922]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Linear navigation</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#e2e4ea] bg-white dark:border-[#2a2d36] dark:bg-[#171922]">
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
                <span>{team?.name}</span>
                <Badge variant="secondary">{team?.key}</Badge>
              </div>
              <div className="truncate text-xs text-muted-foreground">{team?.description}</div>
            </div>
            <Button
              className="cursor-pointer bg-[#5e6ad2] text-white hover:bg-[#4f5cc4]"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              New issue
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
            <Tabs value={view} onValueChange={(value) => updateUrl({ view: value, issue: null })}>
              <TabsList className="bg-[#f1f2f7] dark:bg-[#22242d]">
                <TabsTrigger className="cursor-pointer gap-2" value="list">
                  <List className="size-4" />
                  List
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer gap-2" value="board">
                  <Columns3 className="size-4" />
                  Board
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer gap-2" value="roadmap">
                  <SignalHigh className="size-4" />
                  Roadmap
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative min-w-56 flex-1 sm:max-w-sm">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 bg-white pl-9 dark:bg-[#101116]"
                placeholder="Search issues"
                value={query}
                onChange={(event) => updateUrl({ q: event.target.value || null, issue: null })}
              />
            </div>
            <Filters
              team={team}
              cycles={teamCycles}
              status={statusFilter}
              priority={priorityFilter}
              assignee={assigneeFilter}
              cycle={cycleFilter}
              onChange={(next) => updateUrl({ ...next, issue: null })}
            />
          </div>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            {selectedIssue ? (
              <IssueDetail
                issue={selectedIssue}
                team={team}
                projects={teamProjects}
                cycles={teamCycles}
                activeUserId={activeUser.id}
                commentDraft={commentDraft}
                onCommentDraft={setCommentDraft}
                onBack={() => updateUrl({ issue: null })}
                onText={(title, description) =>
                  updateIssueText(selectedIssue.id, activeUser.id, title, description)
                }
                onStatus={(status) => updateStatus(selectedIssue.id, activeUser.id, status)}
                onPriority={(priority) => updatePriority(selectedIssue.id, activeUser.id, priority)}
                onAssignee={(assignee) => updateAssignee(selectedIssue.id, activeUser.id, assignee)}
                onCycle={(cycle) => updateCycle(selectedIssue.id, activeUser.id, cycle)}
                onProject={(project) => updateProject(selectedIssue.id, activeUser.id, project)}
                onEstimate={(estimate) =>
                  updateEstimate(
                    selectedIssue.id,
                    activeUser.id,
                    estimate ? parseInt(estimate, 10) : null,
                  )
                }
                onLabels={(labels) => updateLabels(selectedIssue.id, activeUser.id, labels)}
                onSubscribe={() => toggleSubscriber(selectedIssue.id, activeUser.id)}
                onComment={() => {
                  if (selectedIssue) {
                    addComment(selectedIssue.id, activeUser.id, commentDraft);
                    onAction?.({
                      type: "CREATE_COMMENT",
                      payload: {
                        issueId: selectedIssue.id,
                        authorId: activeUser.id,
                        content: commentDraft,
                      },
                    });
                  }
                  setCommentDraft("");
                }}
              />
            ) : view === "board" ? (
              <Board
                issues={filteredIssues}
                onOpen={(id) => updateUrl({ issue: id })}
                onStatus={(id, status) => updateStatus(id, activeUser.id, status)}
              />
            ) : view === "roadmap" ? (
              <Roadmap
                issues={filteredIssues}
                projects={teamProjects}
                onOpen={(id) => updateUrl({ issue: id })}
              />
            ) : (
              <IssueList
                issues={filteredIssues}
                cycles={cycles}
                onOpen={(id) => updateUrl({ issue: id })}
              />
            )}
          </div>
        </ScrollArea>
      </section>
      <CreateIssueDialog
        open={createOpen}
        team={team}
        projects={teamProjects}
        cycles={teamCycles}
        activeUserId={activeUser.id}
        onOpenChange={setCreateOpen}
        onCreate={(data) => {
          const id = createIssue({ ...data, teamId, actorId: activeUser.id });
          if (id) {
            setCreateOpen(false);
            onAction?.({ type: "CREATE_ISSUE", payload: { id, ...data } });
          }
        }}
      />
    </main>
  );
}

function LinearSidebar({
  teams,
  activeTeamId,
  issues,
  onTeam,
}: {
  teams: LinearTeam[];
  activeTeamId: string;
  issues: Record<string, LinearIssue>;
  onTeam: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#e2e4ea] p-4 dark:border-[#2a2d36]">
        <div className="font-semibold">Linear</div>
        <div className="text-xs text-muted-foreground">Issue planning workspace</div>
      </div>
      <div className="p-3">
        <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">Teams</div>
        {teams.map((team) => {
          const activeCount = Object.values(issues).filter(
            (issue) => issue.teamId === team.id && !["Done", "Canceled"].includes(issue.status),
          ).length;
          return (
            <button
              key={team.id}
              className={cn(
                "mb-1 w-full cursor-pointer rounded-md border border-transparent px-3 py-2 text-left hover:bg-[#f1f2f7] dark:hover:bg-[#22242d]",
                activeTeamId === team.id &&
                  "border-[#d8dbe5] bg-[#f0f1ff] dark:border-[#363a48] dark:bg-[#252849]",
              )}
              onClick={() => onTeam(team.id)}
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded bg-[#5e6ad2] text-xs font-bold text-white">
                  {team.key.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{team.name}</span>
                <Badge variant="secondary">{activeCount}</Badge>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniSelect({
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
      <SelectTrigger size="sm" className="cursor-pointer bg-white dark:bg-[#101116]">
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

function Filters({
  team,
  cycles,
  status,
  priority,
  assignee,
  cycle,
  onChange,
}: {
  team: LinearTeam;
  cycles: LinearCycle[];
  status: string;
  priority: string;
  assignee: string;
  cycle: string;
  onChange: (next: Record<string, string | null>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <MiniSelect
        value={status}
        items={["all", ...linearStatuses]}
        onValueChange={(value) => onChange({ status: value === "all" ? null : value })}
      />
      <MiniSelect
        value={priority}
        items={["all", ...linearPriorities]}
        onValueChange={(value) => onChange({ priority: value === "all" ? null : value })}
      />
      <MiniSelect
        value={assignee}
        items={["all", "unassigned", ...team.memberIds]}
        onValueChange={(value) => onChange({ assignee: value === "all" ? null : value })}
        renderItem={(value) => (value === "all" ? "All assignees" : userName(value))}
      />
      <MiniSelect
        value={cycle}
        items={["all", ...cycles.map((item) => item.id)]}
        onValueChange={(value) => onChange({ cycle: value === "all" ? null : value })}
        renderItem={(value) =>
          value === "all" ? "All cycles" : (cycles.find((item) => item.id === value)?.name ?? value)
        }
      />
    </div>
  );
}

function IssueList({
  issues,
  cycles,
  onOpen,
}: {
  issues: LinearIssue[];
  cycles: Record<string, LinearCycle>;
  onOpen: (id: string) => void;
}) {
  if (issues.length === 0) return <EmptyState />;
  return (
    <div className="overflow-hidden rounded-md border border-[#e2e4ea] bg-white dark:border-[#2a2d36] dark:bg-[#171922]">
      {issues.map((issue) => (
        <button
          key={issue.id}
          className="grid w-full cursor-pointer grid-cols-[1fr_auto] gap-3 border-b border-[#e2e4ea] p-3 text-left last:border-b-0 hover:bg-[#f7f8fb] md:grid-cols-[7rem_1fr_8rem_8rem_7rem_auto] dark:border-[#2a2d36] dark:hover:bg-[#22242d]"
          onClick={() => onOpen(issue.id)}
          type="button"
        >
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {statusIcon(issue.status)}
            {issue.identifier}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium">{issue.title}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <Badge key={label} variant="secondary" className="text-[10px]">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
          <span className="hidden text-xs text-muted-foreground md:block">
            {cycles[issue.cycleId]?.name}
          </span>
          <span className="hidden text-xs text-muted-foreground md:block">
            {userName(issue.assigneeId)}
          </span>
          <span className={cn("hidden text-xs md:block", priorityClass(issue.priority))}>
            {issue.priority}
          </span>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{issue.comments.length}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function Board({
  issues,
  onOpen,
  onStatus,
}: {
  issues: LinearIssue[];
  onOpen: (id: string) => void;
  onStatus: (id: string, status: LinearStatus) => void;
}) {
  return (
    <div className="grid min-w-[1040px] gap-3 xl:min-w-0 xl:grid-cols-6">
      {linearStatuses.map((status) => {
        const columnIssues = issues.filter((issue) => issue.status === status);
        return (
          <section
            key={status}
            className="min-h-[34rem] rounded-md border border-[#e2e4ea] bg-[#f1f2f7] dark:border-[#2a2d36] dark:bg-[#1d2029]"
          >
            <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
              <span>{status}</span>
              <Badge variant="secondary">{columnIssues.length}</Badge>
            </div>
            <div className="space-y-2 p-2">
              {columnIssues.map((issue) => (
                <button
                  key={issue.id}
                  className="w-full cursor-pointer rounded-md border border-[#e2e4ea] bg-white p-3 text-left shadow-xs hover:border-[#5e6ad2] dark:border-[#2a2d36] dark:bg-[#171922]"
                  onClick={() => onOpen(issue.id)}
                  type="button"
                >
                  <div className="line-clamp-2 font-medium">{issue.title}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {issue.labels.slice(0, 2).map((label) => (
                      <Badge key={label} variant="secondary" className="text-[10px]">
                        {label}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {issue.identifier}
                    </span>
                    <AlertTriangle className={cn("size-3.5", priorityClass(issue.priority))} />
                    <Avatar size="sm" className="ml-auto">
                      <AvatarFallback>{initials(issue.assigneeId)}</AvatarFallback>
                    </Avatar>
                  </div>
                  {status !== "Done" && (
                    <Button
                      className="mt-2 h-7 w-full cursor-pointer text-[11px]"
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onStatus(issue.id, "Done");
                      }}
                    >
                      Mark done
                    </Button>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Roadmap({
  issues,
  projects,
  onOpen,
}: {
  issues: LinearIssue[];
  projects: LinearProject[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {projects.map((project) => {
        const projectIssues = issues.filter((issue) => issue.projectId === project.id);
        const completedIssues = projectIssues.filter(
          (issue) => issue.status === "Done" || issue.status === "Canceled",
        );
        const progress =
          projectIssues.length === 0
            ? 0
            : Math.round((completedIssues.length / projectIssues.length) * 100);
        return (
          <section
            key={project.id}
            className="rounded-md border border-[#e2e4ea] bg-white p-4 dark:border-[#2a2d36] dark:bg-[#171922]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{project.name}</h2>
                <p className="text-xs text-muted-foreground">Target {project.targetDate}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs font-mono text-muted-foreground">{progress}%</div>
                <Badge variant={project.health === "On track" ? "secondary" : "outline"}>
                  {project.health}
                </Badge>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full bg-[#f7f8fb] overflow-hidden rounded-full dark:bg-[#22242d]">
              <div className="h-full bg-[#5e6ad2]" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-4 space-y-2">
              {projectIssues.map((issue) => (
                <button
                  key={issue.id}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-md border border-[#e2e4ea] p-2 text-left hover:bg-[#f7f8fb] dark:border-[#2a2d36] dark:hover:bg-[#22242d]"
                  onClick={() => onOpen(issue.id)}
                  type="button"
                >
                  {statusIcon(issue.status)}
                  <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {issue.identifier}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function IssueDetail({
  issue,
  team,
  projects,
  cycles,
  activeUserId,
  commentDraft,
  onCommentDraft,
  onBack,
  onText,
  onStatus,
  onPriority,
  onAssignee,
  onCycle,
  onProject,
  onEstimate,
  onLabels,
  onSubscribe,
  onComment,
}: {
  issue: LinearIssue;
  team: LinearTeam;
  projects: LinearProject[];
  cycles: LinearCycle[];
  activeUserId: string;
  commentDraft: string;
  onCommentDraft: (value: string) => void;
  onBack: () => void;
  onText: (title: string, description: string) => void;
  onStatus: (status: LinearStatus) => void;
  onPriority: (priority: LinearPriority) => void;
  onAssignee: (assignee: string | null) => void;
  onCycle: (cycle: string) => void;
  onProject: (project: string) => void;
  onEstimate: (estimate: string) => void;
  onLabels: (labels: string[]) => void;
  onSubscribe: () => void;
  onComment: () => void;
}) {
  const [text, setText] = useState({ key: "", title: "", description: "" });
  const title = text.key === issue.id ? text.title : issue.title;
  const description = text.key === issue.id ? text.description : issue.description;
  const subscribed = issue.subscriberIds.includes(activeUserId);

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        <Button variant="ghost" className="mb-3 cursor-pointer" onClick={onBack}>
          Back to {team.name}
        </Button>
        <div className="rounded-md border border-[#e2e4ea] bg-white p-4 dark:border-[#2a2d36] dark:bg-[#171922]">
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            {statusIcon(issue.status)}
            <span className="font-mono">{issue.identifier}</span>
            <span>Updated {relativeTime(issueActivityTime(issue))}</span>
          </div>
          <Input
            className="h-auto border-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
            value={title}
            onChange={(event) => setText({ key: issue.id, title: event.target.value, description })}
            onBlur={() => onText(title, description)}
          />
          <Textarea
            className="mt-3 min-h-36 resize-none"
            value={description}
            onChange={(event) => setText({ key: issue.id, title, description: event.target.value })}
            onBlur={() => onText(title, description)}
          />
        </div>
        <div className="mt-4 rounded-md border border-[#e2e4ea] bg-white p-4 dark:border-[#2a2d36] dark:bg-[#171922]">
          <div className="mb-3 font-semibold">Activity</div>
          <div className="space-y-3">
            {[...issue.activity]
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 8)
              .map((item) => (
                <div key={item.id} className="flex gap-3">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(item.authorId)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div>
                      <span className="font-medium">{userName(item.authorId)}</span>{" "}
                      <span className="text-muted-foreground">{item.body}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatLinearDate(item.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
          <Separator className="my-4" />
          <div className="space-y-3">
            {issue.comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar>
                  <AvatarFallback>{initials(comment.authorId)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 rounded-md bg-[#f7f8fb] p-3 dark:bg-[#22242d]">
                  <div>
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
              <AvatarFallback>{initials(activeUserId)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <Textarea
                placeholder="Leave a comment"
                value={commentDraft}
                onChange={(event) => onCommentDraft(event.target.value)}
              />
              <Button
                className="mt-2 cursor-pointer bg-[#5e6ad2] text-white hover:bg-[#4f5cc4]"
                size="sm"
                disabled={!commentDraft.trim()}
                type="submit"
              >
                Comment
              </Button>
            </div>
          </form>
        </div>
      </div>
      <aside className="space-y-3">
        <Panel title="Properties">
          <Field label="Status">
            <MiniSelect
              value={issue.status}
              items={linearStatuses}
              onValueChange={(value) => value && onStatus(value as LinearStatus)}
            />
          </Field>
          <Field label="Priority">
            <MiniSelect
              value={issue.priority}
              items={linearPriorities}
              onValueChange={(value) => value && onPriority(value as LinearPriority)}
            />
          </Field>
          <Field label="Assignee">
            <MiniSelect
              value={issue.assigneeId ?? "unassigned"}
              items={["unassigned", ...team.memberIds]}
              onValueChange={(value) => onAssignee(value === "unassigned" ? null : value)}
              renderItem={userName}
            />
          </Field>
          <Field label="Cycle">
            <MiniSelect
              value={issue.cycleId}
              items={cycles.map((cycle) => cycle.id)}
              onValueChange={(value) => value && onCycle(value)}
              renderItem={(value) => cycles.find((cycle) => cycle.id === value)?.name ?? value}
            />
          </Field>
          <Field label="Project">
            <MiniSelect
              value={issue.projectId}
              items={projects.map((project) => project.id)}
              onValueChange={(value) => value && onProject(value)}
              renderItem={(value) =>
                projects.find((project) => project.id === value)?.name ?? "No project"
              }
            />
          </Field>
          <Field label="Estimate">
            <MiniSelect
              value={issue.estimate ? String(issue.estimate) : "none"}
              items={["none", "1", "2", "3", "5", "8"]}
              onValueChange={(value) => value && onEstimate(value === "none" ? "" : value)}
              renderItem={(value) => (value === "none" ? "None" : `${value} points`)}
            />
          </Field>
          <Meta
            icon={<UserRound className="size-4" />}
            label="Creator"
            value={userName(issue.creatorId)}
          />
          <Button
            className="mt-3 w-full cursor-pointer"
            variant={subscribed ? "secondary" : "outline"}
            onClick={onSubscribe}
          >
            <Bell className="size-4" />
            {subscribed ? "Subscribed" : "Subscribe"}
          </Button>
        </Panel>
        <Panel title="Labels">
          <Input
            value={issue.labels.join(", ")}
            onChange={(e) =>
              onLabels(
                e.target.value
                  .split(",")
                  .map((l) => l.trim())
                  .filter(Boolean),
              )
            }
            placeholder="Add labels (comma separated)"
            className="h-8 text-xs bg-transparent"
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {issue.labels.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-[#e2e4ea] bg-white p-3 dark:border-[#2a2d36] dark:bg-[#171922]">
      <div className="mb-3 font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Meta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-16 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate">{value}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-md border border-[#e2e4ea] bg-white text-muted-foreground dark:border-[#2a2d36] dark:bg-[#171922]">
      <List className="size-10" />
      <p>No issues match this view.</p>
    </div>
  );
}

function CreateIssueDialog({
  open,
  team,
  projects,
  cycles,
  activeUserId,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  team: LinearTeam;
  projects: LinearProject[];
  cycles: LinearCycle[];
  activeUserId: string;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: {
    title: string;
    description: string;
    status: LinearStatus;
    priority: LinearPriority;
    assigneeId: string | null;
    projectId: string;
    cycleId: string;
    labels: string[];
    estimate: number | null;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<LinearPriority>("Medium");
  const [assigneeId, setAssigneeId] = useState<string | null>(activeUserId);
  const [labels, setLabels] = useState("frontend, quality");
  const [estimate, setEstimate] = useState("3");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? "");

  // Reset fields when dialog opens
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle("");
      setDescription("");
      setPriority("Medium");
      setAssigneeId(activeUserId);
      setLabels("frontend, quality");
      setEstimate("3");
      setProjectId(projects[0]?.id ?? "");
      setCycleId(cycles[0]?.id ?? "");
    }
  }, [open, activeUserId, projects, cycles]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Linear issue</DialogTitle>
          <DialogDescription>
            {team.name} · created by {userName(activeUserId)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title">
              <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea
                className="min-h-28"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Priority">
            <MiniSelect
              value={priority}
              items={linearPriorities}
              onValueChange={(value) => value && setPriority(value as LinearPriority)}
            />
          </Field>
          <Field label="Assignee">
            <MiniSelect
              value={assigneeId ?? "unassigned"}
              items={["unassigned", ...team.memberIds]}
              onValueChange={(value) => setAssigneeId(value === "unassigned" ? null : value)}
              renderItem={userName}
            />
          </Field>
          <Field label="Estimate">
            <Input value={estimate} onChange={(event) => setEstimate(event.target.value)} />
          </Field>
          <Field label="Labels">
            <Input value={labels} onChange={(event) => setLabels(event.target.value)} />
          </Field>
          <Field label="Project">
            <MiniSelect
              value={projectId}
              items={projects.map((p) => p.id)}
              onValueChange={(val) => val && setProjectId(val)}
              renderItem={(id) => projects.find((p) => p.id === id)?.name || id}
            />
          </Field>
          <Field label="Cycle">
            <MiniSelect
              value={cycleId}
              items={cycles.map((c) => c.id)}
              onValueChange={(val) => val && setCycleId(val)}
              renderItem={(id) => cycles.find((c) => c.id === id)?.name || id}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button className="cursor-pointer" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="cursor-pointer bg-[#5e6ad2] text-white hover:bg-[#4f5cc4]"
            disabled={!title.trim()}
            onClick={() =>
              onCreate({
                title,
                description,
                status: "Todo",
                priority,
                assigneeId,
                projectId,
                cycleId,
                labels: labels
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
                estimate: Number.isFinite(Number(estimate)) ? Number(estimate) : null,
              })
            }
          >
            Create issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
