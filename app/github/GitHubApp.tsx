"use client";
import { useScrollToSelected } from "@/hooks/use-scroll-to-selected";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  CircleDot,
  Code2,
  Eye,
  FileCode2,
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { appUsers } from "@/lib/users";
import { useActiveUser } from "@/lib/stores/user-store";
import { cn } from "@/lib/utils";
import {
  canAccessRepo,
  formatGitHubTimestamp,
  githubTabs,
  issueActivityTime,
  pullActivityTime,
  relativeTime,
  useGitHubStore,
  type GitHubIssue,
  type GitHubNotification,
  type GitHubPullRequest,
  type GitHubRepo,
  type GitHubTab,
} from "@/app/github/github-state";

function userName(id: string) {
  return appUsers.find((user) => user.id === id)?.name ?? "Unknown";
}

function userInitials(id: string) {
  return appUsers.find((user) => user.id === id)?.initials ?? "??";
}

function normalizeTab(value: string | null): GitHubTab {
  return githubTabs.includes(value as GitHubTab) ? (value as GitHubTab) : "issues";
}

export function GitHubApp({
  onAction,
}: { onAction?: (action: { type: string; payload: unknown }) => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useScrollToSelected(searchParams.get("issue") || searchParams.get("pr"));
  const activeUser = useActiveUser()!;
  const repos = useGitHubStore((state) => state.repos);
  const issues = useGitHubStore((state) => state.issues);
  const pulls = useGitHubStore((state) => state.pulls);
  const files = useGitHubStore((state) => state.files);
  const notifications = useGitHubStore((state) => state.notifications);
  const loadCorpusPage = useGitHubStore((state) => state.loadCorpusPage);
  const createIssue = useGitHubStore((state) => state.createIssue);
  const toggleStar = useGitHubStore((state) => state.toggleStar);
  const toggleWatch = useGitHubStore((state) => state.toggleWatch);
  const addIssueComment = useGitHubStore((state) => state.addIssueComment);
  const addPullComment = useGitHubStore((state) => state.addPullComment);
  const setIssueStatus = useGitHubStore((state) => state.setIssueStatus);
  const mergePull = useGitHubStore((state) => state.mergePull);
  const markNotificationRead = useGitHubStore((state) => state.markNotificationRead);
  const markAllNotificationsRead = useGitHubStore((state) => state.markAllNotificationsRead);
  const dismissNotification = useGitHubStore((state) => state.dismissNotification);
  const updateIssueLabels = useGitHubStore((state) => state.updateIssueLabels);
  const updateIssueAssignees = useGitHubStore((state) => state.updateIssueAssignees);
  const createPullRequest = useGitHubStore((state) => state.createPullRequest);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commentDraftState, setCommentDraftState] = useState({ key: "", value: "" });
  const previousUserId = useRef(activeUser.id);

  useEffect(() => {
    void loadCorpusPage();
  }, [loadCorpusPage]);

  const accessibleRepos = useMemo(
    () =>
      Object.values(repos)
        .filter((repo) => canAccessRepo(repo, activeUser.id))
        .sort((a, b) => {
          const countA =
            Object.values(issues).filter((i) => i.repoId === a.id).length +
            Object.values(pulls).filter((p) => p.repoId === a.id).length;
          const countB =
            Object.values(issues).filter((i) => i.repoId === b.id).length +
            Object.values(pulls).filter((p) => p.repoId === b.id).length;
          return countB - countA;
        }),
    [activeUser.id, repos, issues, pulls],
  );
  const fallbackRepo = accessibleRepos[0]?.id ?? "corp-os";
  const repoParam = searchParams.get("repo");
  const repoId = canAccessRepo(repos[repoParam ?? ""], activeUser.id)
    ? (repoParam ?? fallbackRepo)
    : fallbackRepo;
  const repo = repos[repoId];
  const tab = normalizeTab(searchParams.get("tab"));
  const issueId = searchParams.get("issue");
  const newIssue = searchParams.get("newIssue") === "true";
  const pullId = searchParams.get("pr");
  const filePath = searchParams.get("path") ?? "README.md";
  const query = searchParams.get("q") ?? "";
  const commentDraftKey = `${activeUser.id}:${repoId}:${tab}:${issueId ?? pullId ?? "list"}`;
  const commentDraft = commentDraftState.key === commentDraftKey ? commentDraftState.value : "";
  const normalizedQuery = query.trim().toLowerCase();

  function setCommentDraft(value: string) {
    setCommentDraftState({ key: commentDraftKey, value });
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
    const nextRepo =
      Object.values(repos).find((item) => canAccessRepo(item, activeUser.id))?.id ?? "corp-os";
    router.replace(`${pathname}?repo=${nextRepo}&tab=issues`);
  }, [activeUser.id, pathname, repos, router]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (!canAccessRepo(repos[repoParam ?? ""], activeUser.id)) {
      params.set("repo", fallbackRepo);
      params.set("tab", "code");
      params.delete("issue");
      params.delete("pr");
      params.delete("path");
      params.delete("q");
      changed = true;
    }

    const selectedIssue = issueId ? issues[issueId] : null;
    if (issueId && (!selectedIssue || selectedIssue.repoId !== repoId)) {
      params.delete("issue");
      changed = true;
    }

    const selectedPull = pullId ? pulls[pullId] : null;
    if (pullId && (!selectedPull || selectedPull.repoId !== repoId)) {
      params.delete("pr");
      changed = true;
    }

    if (tab !== "code" && params.has("path")) {
      params.delete("path");
      changed = true;
    }

    if (tab !== "issues" && params.has("issue")) {
      params.delete("issue");
      changed = true;
    }

    if (tab !== "pulls" && params.has("pr")) {
      params.delete("pr");
      changed = true;
    }

    if (tab !== "issues" && params.has("newIssue")) {
      params.delete("newIssue");
      changed = true;
    }

    if (tab === "code" && filePath && files[`${repoId}:${filePath}`]?.type !== "file") {
      const fallbackPath =
        Object.values(files).find((file) => file.repoId === repoId && file.type === "file")?.path ??
        "README.md";
      if (filePath !== fallbackPath) {
        params.set("path", fallbackPath);
        changed = true;
      }
    }

    if (changed) router.replace(`${pathname}?${params.toString()}`);
  }, [
    activeUser.id,
    fallbackRepo,
    filePath,
    files,
    issueId,
    issues,
    pathname,
    pullId,
    pulls,
    repoId,
    repoParam,
    repos,
    router,
    searchParams,
    tab,
  ]);

  const repoIssues = Object.values(issues)
    .filter((issue) => issue.repoId === repoId)
    .filter(
      (issue) =>
        !normalizedQuery ||
        [
          issue.title,
          issue.body,
          issue.labels.join(" "),
          issue.assigneeIds.map(userName).join(" "),
          issue.comments.map((comment) => comment.body).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
    )
    .sort((a, b) => {
      const activityDelta = issueActivityTime(b) - issueActivityTime(a);
      if (activityDelta !== 0) return activityDelta;
      return b.number - a.number;
    })
    .slice(0, 100);
  const repoPulls = Object.values(pulls)
    .filter((pull) => pull.repoId === repoId)
    .filter(
      (pull) =>
        !normalizedQuery ||
        [
          pull.title,
          pull.body,
          pull.sourceBranch,
          pull.targetBranch,
          pull.changedFiles.map((file) => file.path).join(" "),
          pull.comments.map((comment) => comment.body).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
    )
    .sort((a, b) => {
      const activityDelta = pullActivityTime(b) - pullActivityTime(a);
      if (activityDelta !== 0) return activityDelta;
      return b.number - a.number;
    })
    .slice(0, 100);
  const repoFiles = Object.values(files)
    .filter((file) => file.repoId === repoId)
    .filter(
      (file) =>
        !normalizedQuery ||
        [file.path, file.content].join(" ").toLowerCase().includes(normalizedQuery),
    );
  const selectedFile =
    files[`${repoId}:${filePath}`]?.type === "file"
      ? files[`${repoId}:${filePath}`]
      : repoFiles.find((file) => file.type === "file");
  const selectedIssue = issueId && issues[issueId]?.repoId === repoId ? issues[issueId] : null;
  const selectedPull = pullId && pulls[pullId]?.repoId === repoId ? pulls[pullId] : null;
  const userNotifications = Object.values(notifications)
    .filter(
      (notification) =>
        notification.userId === activeUser.id &&
        canAccessRepo(repos[notification.repoId], activeUser.id),
    )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100);

  const sidebar = (
    <GitHubSidebar
      repos={accessibleRepos}
      activeRepoId={repoId}
      notifications={userNotifications.filter((notification) => notification.unread).length}
      onRepo={(id) => {
        setCommentDraft("");
        updateUrl({
          repo: id,
          tab: "issues",
          issue: null,
          pr: null,
          newIssue: null,
          path: "README.md",
          q: null,
        });
        setSidebarOpen(false);
      }}
      onNotifications={() => {
        setCommentDraft("");
        updateUrl({
          tab: "notifications",
          issue: null,
          pr: null,
          newIssue: null,
          path: null,
          q: null,
        });
        setSidebarOpen(false);
      }}
    />
  );

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 bg-[#f6f8fa] text-sm text-[#1f2328] dark:bg-[#0d1117] dark:text-[#e6edf3]">
      <aside className="hidden w-72 shrink-0 border-r border-[#d0d7de] bg-white lg:block dark:border-[#30363d] dark:bg-[#0d1117]">
        {sidebar}
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-80 border-[#d0d7de] bg-white p-0 dark:border-[#30363d] dark:bg-[#0d1117]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>GitHub navigation</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#010409]">
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
              <div className="truncate text-base font-semibold">
                <span className="font-normal text-muted-foreground">{repo?.owner}</span> /{" "}
                <span className="text-[#0969da] dark:text-[#58a6ff]">{repo?.name}</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">{repo?.description}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => toggleWatch(repoId, activeUser.id)}
            >
              <Eye className="size-4" />
              {repo?.watchedBy.includes(activeUser.id) ? "Watching" : "Watch"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => toggleStar(repoId, activeUser.id)}
            >
              <Star
                className={cn(
                  "size-4",
                  repo?.starredBy.includes(activeUser.id) && "fill-yellow-400 text-yellow-500",
                )}
              />
              Star
            </Button>
          </div>
          <div className="flex items-center gap-3 px-4 pb-2">
            <Tabs
              value={tab}
              onValueChange={(value) =>
                updateUrl({
                  tab: value,
                  issue: null,
                  pr: null,
                  newIssue: null,
                  path: null,
                  q: null,
                })
              }
            >
              <TabsList className="bg-transparent">
                <TabsTrigger className="cursor-pointer gap-2" value="code">
                  <Code2 className="size-4" />
                  Code
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer gap-2" value="issues">
                  <CircleDot className="size-4" />
                  Issues
                  <Badge variant="secondary" className="ml-1 h-5 rounded-full px-1.5">
                    {repoIssues.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer gap-2" value="pulls">
                  <GitPullRequest className="size-4" />
                  Pull requests
                  <Badge variant="secondary" className="ml-1 h-5 rounded-full px-1.5">
                    {repoPulls.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer gap-2" value="notifications">
                  <Bell className="size-4" />
                  Notifications
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative ml-auto hidden w-72 sm:block">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 border-[#d0d7de] bg-[#f6f8fa] pl-9 dark:border-[#30363d] dark:bg-[#0d1117]"
                placeholder="Search repo"
                value={query}
                onChange={(event) =>
                  updateUrl({
                    q: event.target.value || null,
                    issue: null,
                    pr: null,
                    newIssue: null,
                    path: null,
                  })
                }
              />
            </div>
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto max-w-6xl p-4">
            {tab === "code" && (
              <CodeView
                files={repoFiles}
                selectedPath={selectedFile?.path ?? ""}
                selectedContent={selectedFile?.content ?? ""}
                onPath={(path) => updateUrl({ path })}
              />
            )}
            {tab === "issues" &&
              (newIssue ? (
                <NewIssueForm
                  repo={repo}
                  activeUserId={activeUser.id}
                  onCancel={() => updateUrl({ newIssue: null })}
                  onCreate={(input) => {
                    const createdId = createIssue({
                      repoId,
                      authorId: activeUser.id,
                      ...input,
                    });
                    if (!createdId) return;
                    onAction?.({
                      type: "CREATE_ISSUE",
                      payload: { id: createdId, repoId, authorId: activeUser.id, ...input },
                    });

                    updateUrl({ issue: createdId, pr: null, newIssue: null, path: null, q: null });
                  }}
                />
              ) : selectedIssue && selectedIssue.repoId === repoId ? (
                <IssueDetail
                  issue={selectedIssue}
                  repo={repos[repoId]}
                  activeUserId={activeUser.id}
                  draft={commentDraft}
                  onDraft={setCommentDraft}
                  onBack={() => updateUrl({ issue: null })}
                  onComment={() => {
                    addIssueComment(selectedIssue.id, activeUser.id, commentDraft);
                    onAction?.({
                      type: "CREATE_ISSUE_COMMENT",
                      payload: {
                        issueId: selectedIssue.id,
                        authorId: activeUser.id,
                        content: commentDraft,
                      },
                    });

                    setCommentDraft("");
                  }}
                  onStatus={(status) => {
                    setIssueStatus(selectedIssue.id, activeUser.id, status);
                  }}
                  onLabels={(labels) => updateIssueLabels(selectedIssue.id, activeUser.id, labels)}
                  onAssignees={(assignees) =>
                    updateIssueAssignees(selectedIssue.id, activeUser.id, assignees)
                  }
                />
              ) : (
                <IssueList
                  issues={repoIssues}
                  onNew={() =>
                    updateUrl({ newIssue: "true", issue: null, pr: null, path: null, q: null })
                  }
                  onOpen={(id) => updateUrl({ issue: id, pr: null, newIssue: null, path: null })}
                />
              ))}
            {tab === "pulls" &&
              (searchParams.get("newPr") === "true" ? (
                <NewPullForm
                  repo={repos[repoId]}
                  onCancel={() => updateUrl({ newPr: null })}
                  onCreate={(input) => {
                    const createdId = createPullRequest({
                      repoId,
                      authorId: activeUser.id,
                      ...input,
                    });
                    if (!createdId) return;
                    onAction?.({
                      type: "CREATE_PULL_REQUEST",
                      payload: { id: createdId, repoId, authorId: activeUser.id, ...input },
                    });

                    updateUrl({ pr: createdId, issue: null, newPr: null, path: null, q: null });
                  }}
                />
              ) : selectedPull && selectedPull.repoId === repoId ? (
                <PullDetail
                  pull={selectedPull}
                  activeUserId={activeUser.id}
                  draft={commentDraft}
                  onDraft={setCommentDraft}
                  onBack={() => updateUrl({ pr: null })}
                  onComment={() => {
                    addPullComment(selectedPull.id, activeUser.id, commentDraft);
                    onAction?.({
                      type: "CREATE_PR_COMMENT",
                      payload: {
                        prId: selectedPull.id,
                        authorId: activeUser.id,
                        content: commentDraft,
                      },
                    });

                    setCommentDraft("");
                  }}
                  onMerge={() => {
                    mergePull(selectedPull.id, activeUser.id);
                  }}
                />
              ) : (
                <PullList
                  pulls={repoPulls}
                  onNew={() =>
                    updateUrl({ newPr: "true", pr: null, issue: null, path: null, q: null })
                  }
                  onOpen={(id) => updateUrl({ pr: id, issue: null, newIssue: null, path: null })}
                />
              ))}
            {tab === "notifications" && (
              <NotificationList
                notifications={userNotifications}
                onOpen={(notification) => {
                  markNotificationRead(notification.id);
                  updateUrl({
                    repo: notification.repoId,
                    tab: notification.targetType === "issue" ? "issues" : "pulls",
                    issue: notification.targetType === "issue" ? notification.targetId : null,
                    pr: notification.targetType === "pull" ? notification.targetId : null,
                    newIssue: null,
                    path: null,
                    q: null,
                  });
                }}
                onDismiss={(id) => dismissNotification(id, activeUser.id)}
                onMarkAllRead={() => markAllNotificationsRead(activeUser.id)}
              />
            )}
          </div>
        </ScrollArea>
      </section>
    </main>
  );
}

function GitHubSidebar({
  repos,
  activeRepoId,
  notifications,
  onRepo,
  onNotifications,
}: {
  repos: GitHubRepo[];
  activeRepoId: string;
  notifications: number;
  onRepo: (id: string) => void;
  onNotifications: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#d0d7de] p-4 dark:border-[#30363d]">
        <div className="font-semibold">GitHub</div>
        <div className="text-xs text-muted-foreground">Corp organization</div>
      </div>
      <div className="p-3">
        <button
          className="mb-3 flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-left hover:bg-[#f6f8fa] dark:hover:bg-[#161b22]"
          onClick={onNotifications}
          type="button"
        >
          <Bell className="size-4" />
          Notifications
          {notifications > 0 && <Badge className="ml-auto">{notifications}</Badge>}
        </button>
        <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">Repositories</div>
        {repos.map((repo) => (
          <button
            key={repo.id}
            className={cn(
              "mb-1 w-full cursor-pointer rounded-md border border-transparent px-3 py-2 text-left hover:bg-[#f6f8fa] dark:hover:bg-[#161b22]",
              activeRepoId === repo.id &&
                "border-[#d0d7de] bg-[#f6f8fa] dark:border-[#30363d] dark:bg-[#161b22]",
            )}
            onClick={() => onRepo(repo.id)}
            type="button"
          >
            <div className="truncate font-medium">
              {repo.owner}/{repo.name}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-[#3178c6]" />
              {repo.language}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function IssueList({
  issues,
  onNew,
  onOpen,
}: {
  issues: GitHubIssue[];
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  if (issues.length === 0) {
    return (
      <div className="overflow-hidden rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
        <div className="flex items-center justify-between border-b border-[#d0d7de] bg-[#f6f8fa] px-4 py-3 dark:border-[#30363d] dark:bg-[#161b22]">
          <div className="font-medium">Issues</div>
          <Button
            className="cursor-pointer bg-[#1f883d] text-white hover:bg-[#1a7f37]"
            size="sm"
            onClick={onNew}
          >
            <Plus className="size-4" />
            New issue
          </Button>
        </div>
        <div className="flex h-72 flex-col items-center justify-center gap-2 text-muted-foreground">
          <CircleDot className="size-10" />
          <p>No issues match this view.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-[#d0d7de] bg-[#f6f8fa] px-4 py-3 dark:border-[#30363d] dark:bg-[#161b22]">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">
            {issues.filter((issue) => issue.status === "open").length} Open
          </span>
          <span className="text-muted-foreground">
            {issues.filter((issue) => issue.status === "closed").length} Closed
          </span>
        </div>
        <Button
          className="cursor-pointer bg-[#1f883d] text-white hover:bg-[#1a7f37]"
          size="sm"
          onClick={onNew}
        >
          <Plus className="size-4" />
          New issue
        </Button>
      </div>
      {issues.map((issue) => (
        <button
          id={issue.id}
          key={issue.id}
          className="flex w-full cursor-pointer gap-3 border-b border-[#d0d7de] p-4 text-left last:border-b-0 hover:bg-[#f6f8fa] dark:border-[#30363d] dark:hover:bg-[#161b22]"
          onClick={() => onOpen(issue.id)}
          type="button"
        >
          {issue.status === "open" ? (
            <CircleDot className="mt-1 size-5 text-green-600" />
          ) : (
            <CheckCircle2 className="mt-1 size-5 text-purple-600" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium">{issue.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              #{issue.number} opened {relativeTime(issue.createdAt)} by {userName(issue.authorId)}
              {" · "}updated {relativeTime(issueActivityTime(issue))}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Created {formatGitHubTimestamp(issue.createdAt)} · Last activity{" "}
              {formatGitHubTimestamp(issueActivityTime(issue))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            {issue.assigneeIds.map((id) => (
              <Avatar key={id} size="sm">
                <AvatarFallback>{userInitials(id)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          <MessageSquare className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{issue.comments.length}</span>
        </button>
      ))}
    </div>
  );
}

function PullList({
  pulls,
  onOpen,
  onNew,
}: {
  pulls: GitHubPullRequest[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  if (pulls.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-md border border-[#d0d7de] bg-white text-muted-foreground dark:border-[#30363d] dark:bg-[#0d1117]">
        <GitPullRequest className="size-10" />
        <p>No pull requests match this view.</p>
        <Button onClick={onNew} className="mt-4 bg-[#1f883d] text-white hover:bg-[#1a7f37]">
          New pull request
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={onNew} className="bg-[#1f883d] text-white hover:bg-[#1a7f37]">
          New pull request
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
        {pulls.map((pull) => (
          <button
            key={pull.id}
            className="flex w-full cursor-pointer gap-3 border-b border-[#d0d7de] p-4 text-left last:border-b-0 hover:bg-[#f6f8fa] dark:border-[#30363d] dark:hover:bg-[#161b22]"
            onClick={() => onOpen(pull.id)}
            type="button"
          >
            {pull.status === "open" ? (
              <GitPullRequest className="mt-1 size-5 text-green-600" />
            ) : pull.status === "merged" ? (
              <GitMerge className="mt-1 size-5 text-purple-600" />
            ) : (
              <GitPullRequestClosed className="mt-1 size-5 text-red-600" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium">{pull.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                #{pull.number} from {pull.sourceBranch} into {pull.targetBranch} by{" "}
                {userName(pull.authorId)}
                {" · "}updated {relativeTime(pullActivityTime(pull))}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Created {formatGitHubTimestamp(pull.createdAt)} · Last activity{" "}
                {formatGitHubTimestamp(pullActivityTime(pull))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {pull.checks.map((check) => (
                  <Badge
                    key={check.name}
                    variant={check.status === "passing" ? "secondary" : "outline"}
                  >
                    {check.name}: {check.status}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="hidden items-center gap-1 sm:flex">
              {pull.reviewerIds.slice(0, 3).map((id) => (
                <Avatar key={id} size="sm">
                  <AvatarFallback>{userInitials(id)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <MessageSquare className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{pull.comments.length}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function NewPullForm({
  repo,
  onCancel,
  onCreate,
}: {
  repo: GitHubRepo;
  onCancel: () => void;
  onCreate: (input: {
    title: string;
    body: string;
    sourceBranch: string;
    targetBranch: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceBranch, setSourceBranch] = useState("feature-branch");
  const targetBranch = repo.defaultBranch;

  return (
    <form
      className="grid gap-4 lg:grid-cols-[1fr_18rem]"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate({ title, body, sourceBranch, targetBranch });
      }}
    >
      <div className="rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
        <div className="border-b border-[#d0d7de] bg-[#f6f8fa] px-4 py-3 dark:border-[#30363d] dark:bg-[#161b22]">
          <div className="font-semibold">Open a pull request</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-[#ddf4ff] px-1.5 py-0.5 text-[#0969da] dark:bg-[#0c2d48] dark:text-[#58a6ff]">
              {targetBranch}
            </span>
            <span>&larr;</span>
            <Input
              value={sourceBranch}
              onChange={(e) => setSourceBranch(e.target.value)}
              className="h-6 w-32 px-1 py-0 text-xs"
            />
          </div>
        </div>
        <div className="space-y-3 p-4">
          <Input
            autoFocus
            className="h-10"
            placeholder="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Textarea
            className="min-h-56 resize-none"
            placeholder="Leave a comment"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button className="cursor-pointer" type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#1f883d] text-white hover:bg-[#1a7f37]"
              disabled={!title.trim() || !sourceBranch.trim()}
              type="submit"
            >
              Create pull request
            </Button>
          </div>
        </div>
      </div>
      <aside className="space-y-3">
        <div className="rounded-md border border-[#d0d7de] bg-white p-3 text-xs text-muted-foreground dark:border-[#30363d] dark:bg-[#0d1117]">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <GitPullRequest className="size-4" />
            Pull Request
          </div>
          Create a pull request to propose and collaborate on changes to a repository.
        </div>
      </aside>
    </form>
  );
}

function NewIssueForm({
  repo,
  activeUserId,
  onCancel,
  onCreate,
}: {
  repo: GitHubRepo;
  activeUserId: string;
  onCancel: () => void;
  onCreate: (input: {
    title: string;
    body: string;
    labels: string[];
    assigneeIds: string[];
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [labels, setLabels] = useState<string[]>(["triage"]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([activeUserId]);
  const labelOptions = ["bug", "enhancement", "frontend", "backend", "privacy", "triage"];

  function toggleValue(value: string, values: string[], onChange: (next: string[]) => void) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <form
      className="grid gap-4 lg:grid-cols-[1fr_18rem]"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate({ title, body, labels, assigneeIds });
      }}
    >
      <div className="rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
        <div className="border-b border-[#d0d7de] bg-[#f6f8fa] px-4 py-3 dark:border-[#30363d] dark:bg-[#161b22]">
          <div className="font-semibold">Open a new issue</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {repo.owner}/{repo.name} · authored by {userName(activeUserId)}
          </div>
        </div>
        <div className="space-y-3 p-4">
          <Input
            autoFocus
            className="h-10"
            placeholder="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Textarea
            className="min-h-56 resize-none"
            placeholder="Leave a comment"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button className="cursor-pointer" type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#1f883d] text-white hover:bg-[#1a7f37]"
              disabled={!title.trim()}
              type="submit"
            >
              Submit new issue
            </Button>
          </div>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
          <div className="border-b border-[#d0d7de] px-3 py-2 text-xs font-medium text-muted-foreground dark:border-[#30363d]">
            Assignees
          </div>
          <div className="space-y-1 p-2">
            {repo.memberIds.map((memberId) => (
              <button
                key={memberId}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#f6f8fa] dark:hover:bg-[#161b22]",
                  assigneeIds.includes(memberId) && "bg-[#ddf4ff] dark:bg-[#0c2d48]",
                )}
                onClick={() => toggleValue(memberId, assigneeIds, setAssigneeIds)}
                type="button"
              >
                <Avatar size="sm">
                  <AvatarFallback>{userInitials(memberId)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm">{userName(memberId)}</span>
                {assigneeIds.includes(memberId) && (
                  <CheckCircle2 className="size-4 text-green-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
          <div className="border-b border-[#d0d7de] px-3 py-2 text-xs font-medium text-muted-foreground dark:border-[#30363d]">
            Labels
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            {labelOptions.map((label) => (
              <button
                key={label}
                className={cn(
                  "cursor-pointer rounded-full border px-2 py-1 text-xs hover:bg-[#f6f8fa] dark:hover:bg-[#161b22]",
                  labels.includes(label) &&
                    "border-[#0969da] bg-[#ddf4ff] text-[#0969da] dark:bg-[#0c2d48] dark:text-[#58a6ff]",
                )}
                onClick={() => toggleValue(label, labels, setLabels)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#d0d7de] bg-white p-3 text-xs text-muted-foreground dark:border-[#30363d] dark:bg-[#0d1117]">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <GitBranch className="size-4" />
            Issue workflow
          </div>
          New issues open immediately, notify assigned users, and can be closed or reopened from the
          detail view.
        </div>
      </aside>
    </form>
  );
}

function TimelineComment({
  comment,
}: {
  comment: { id: string; authorId: string; body: string; timestamp: number };
}) {
  return (
    <div
      id={comment.id}
      className="flex gap-3 rounded-md border border-[#d0d7de] bg-white p-3 dark:border-[#30363d] dark:bg-[#0d1117]"
    >
      <Avatar>
        <AvatarFallback>{userInitials(comment.authorId)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="text-sm">
          <span className="font-medium">{userName(comment.authorId)}</span>{" "}
          <span className="text-xs text-muted-foreground">
            commented {relativeTime(comment.timestamp)}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-line leading-6">{comment.body}</p>
      </div>
    </div>
  );
}

function IssueDetail({
  issue,
  repo,
  activeUserId,
  draft,
  onDraft,
  onBack,
  onComment,
  onStatus,
  onLabels,
  onAssignees,
}: {
  issue: GitHubIssue;
  repo: GitHubRepo;
  activeUserId: string;
  draft: string;
  onDraft: (value: string) => void;
  onBack: () => void;
  onComment: () => void;
  onStatus: (status: "open" | "closed") => void;
  onLabels: (labels: string[]) => void;
  onAssignees: (assignees: string[]) => void;
}) {
  const labelOptions = ["bug", "enhancement", "frontend", "backend", "privacy", "triage"];
  function toggleValue(value: string, values: string[], onChange: (next: string[]) => void) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <DetailShell
      title={issue.title}
      subtitle={`#${issue.number} opened ${formatGitHubTimestamp(issue.createdAt)} by ${userName(issue.authorId)} · updated ${formatGitHubTimestamp(issueActivityTime(issue))}`}
      onBack={onBack}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant={issue.status === "open" ? "secondary" : "outline"}>
              {issue.status}
            </Badge>
            {issue.labels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
            <Button
              className="ml-auto cursor-pointer"
              size="sm"
              variant="outline"
              onClick={() => onStatus(issue.status === "open" ? "closed" : "open")}
            >
              {issue.status === "open" ? "Close issue" : "Reopen issue"}
            </Button>
          </div>
          <TimelineComment
            comment={{
              id: `${issue.id}-body`,
              authorId: issue.authorId,
              body: issue.body,
              timestamp: issue.timestamp,
            }}
          />
          <div className="mt-3 space-y-3">
            {issue.comments.map((comment) => (
              <TimelineComment key={comment.id} comment={comment} />
            ))}
          </div>
          <CommentBox
            activeUserId={activeUserId}
            draft={draft}
            onDraft={onDraft}
            onSubmit={onComment}
          />
        </div>
        <aside className="space-y-3">
          <div className="rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
            <div className="border-b border-[#d0d7de] px-3 py-2 text-xs font-medium text-muted-foreground dark:border-[#30363d]">
              Assignees
            </div>
            <div className="space-y-1 p-2">
              {repo.memberIds.map((memberId) => (
                <button
                  key={memberId}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#f6f8fa] dark:hover:bg-[#161b22]",
                    issue.assigneeIds.includes(memberId) && "bg-[#ddf4ff] dark:bg-[#0c2d48]",
                  )}
                  onClick={() => toggleValue(memberId, issue.assigneeIds, onAssignees)}
                  type="button"
                >
                  <Avatar size="sm">
                    <AvatarFallback>{userInitials(memberId)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm">{userName(memberId)}</span>
                  {issue.assigneeIds.includes(memberId) && (
                    <CheckCircle2 className="size-4 text-green-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
            <div className="border-b border-[#d0d7de] px-3 py-2 text-xs font-medium text-muted-foreground dark:border-[#30363d]">
              Labels
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {labelOptions.map((label) => (
                <button
                  key={label}
                  className={cn(
                    "cursor-pointer rounded-full border px-2 py-1 text-xs hover:bg-[#f6f8fa] dark:hover:bg-[#161b22]",
                    issue.labels.includes(label) &&
                      "border-[#0969da] bg-[#ddf4ff] text-[#0969da] dark:bg-[#0c2d48] dark:text-[#58a6ff]",
                  )}
                  onClick={() => toggleValue(label, issue.labels, onLabels)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </DetailShell>
  );
}

function PullDetail({
  pull,
  activeUserId,
  draft,
  onDraft,
  onBack,
  onComment,
  onMerge,
}: {
  pull: GitHubPullRequest;
  activeUserId: string;
  draft: string;
  onDraft: (value: string) => void;
  onBack: () => void;
  onComment: () => void;
  onMerge: () => void;
}) {
  return (
    <DetailShell
      title={pull.title}
      subtitle={`#${pull.number} wants to merge ${pull.sourceBranch} into ${pull.targetBranch} · opened ${formatGitHubTimestamp(
        pull.createdAt,
      )} · updated ${formatGitHubTimestamp(pullActivityTime(pull))}`}
      onBack={onBack}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant={pull.status === "open" ? "secondary" : "outline"}>{pull.status}</Badge>
        {pull.checks.map((check) => (
          <Badge key={check.name} variant={check.status === "passing" ? "secondary" : "outline"}>
            {check.name}: {check.status}
          </Badge>
        ))}
        <Button
          className="ml-auto cursor-pointer bg-[#1f883d] text-white hover:bg-[#1a7f37]"
          size="sm"
          disabled={pull.status !== "open"}
          onClick={onMerge}
        >
          Merge pull request
        </Button>
      </div>
      <TimelineComment
        comment={{
          id: `${pull.id}-body`,
          authorId: pull.authorId,
          body: pull.body,
          timestamp: pull.timestamp,
        }}
      />
      <div className="my-4 rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
        {pull.changedFiles.map((file) => (
          <div
            key={file.path}
            className="flex items-center gap-3 border-b border-[#d0d7de] px-3 py-2 last:border-b-0 dark:border-[#30363d]"
          >
            <FileCode2 className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{file.path}</span>
            <span className="text-xs text-green-600">+{file.additions}</span>
            <span className="text-xs text-red-600">-{file.deletions}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        {pull.comments.map((comment) => (
          <TimelineComment key={comment.id} comment={comment} />
        ))}
      </div>
      <CommentBox
        activeUserId={activeUserId}
        draft={draft}
        onDraft={onDraft}
        onSubmit={onComment}
      />
    </DetailShell>
  );
}

function DetailShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Button variant="ghost" className="mb-3 cursor-pointer" onClick={onBack}>
        Back
      </Button>
      <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      <Separator className="my-4" />
      {children}
    </div>
  );
}

function CommentBox({
  activeUserId,
  draft,
  onDraft,
  onSubmit,
}: {
  activeUserId: string;
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="mt-4 flex gap-3 rounded-md border border-[#d0d7de] bg-white p-3 dark:border-[#30363d] dark:bg-[#0d1117]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Avatar>
        <AvatarFallback>{userInitials(activeUserId)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <Textarea
          placeholder="Leave a comment"
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
        />
        <Button
          className="mt-2 cursor-pointer bg-[#1f883d] text-white hover:bg-[#1a7f37]"
          size="sm"
          disabled={!draft.trim()}
          type="submit"
        >
          Comment
        </Button>
      </div>
    </form>
  );
}

function CodeView({
  files,
  selectedPath,
  selectedContent,
  onPath,
  onSaveContent,
}: {
  files: Array<{ path: string; type: "file" | "folder"; content: string }>;
  selectedPath: string;
  selectedContent: string;
  onPath: (path: string) => void;
  onSaveContent?: (content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(selectedContent);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(selectedContent);
    setEditing(false);
  }, [selectedContent]);

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <div className="overflow-hidden rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
        <div className="border-b border-[#d0d7de] bg-[#f6f8fa] px-3 py-2 text-xs font-medium text-muted-foreground dark:border-[#30363d] dark:bg-[#161b22]">
          Repository files
        </div>
        {files.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No files match this search.
          </div>
        ) : (
          files.map((file) => (
            <button
              key={file.path}
              className={cn(
                "flex w-full items-center gap-2 border-b border-[#d0d7de] px-3 py-2 text-left last:border-b-0 dark:border-[#30363d]",
                file.type === "file"
                  ? "cursor-pointer hover:bg-[#f6f8fa] dark:hover:bg-[#161b22]"
                  : "cursor-default text-muted-foreground",
                selectedPath === file.path && "bg-[#f6f8fa] dark:bg-[#161b22]",
              )}
              onClick={() => file.type === "file" && onPath(file.path)}
              aria-disabled={file.type === "folder"}
              type="button"
            >
              <FileCode2 className="size-4 text-muted-foreground" />
              <span className="truncate">{file.path}</span>
            </button>
          ))
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-[#d0d7de] bg-white flex flex-col min-h-64 dark:border-[#30363d] dark:bg-[#0d1117]">
        <div className="border-b border-[#d0d7de] bg-[#f6f8fa] px-3 py-2 font-mono text-xs flex justify-between items-center dark:border-[#30363d] dark:bg-[#161b22]">
          <span>{selectedPath || "No file selected"}</span>
          {selectedPath &&
            onSaveContent &&
            (editing ? (
              <div className="flex gap-2">
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setEditing(false)}
                >
                  <X className="size-3" />
                </Button>
                <Button
                  size="sm"
                  className="cursor-pointer bg-[#1f883d] text-white hover:bg-[#1a7f37]"
                  onClick={() => {
                    onSaveContent(draft);
                    setEditing(false);
                  }}
                >
                  Save
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            ))}
        </div>
        {editing ? (
          <Textarea
            className="flex-1 w-full font-mono text-xs rounded-none border-0 shadow-none focus-visible:ring-0 p-4 min-h-[300px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : selectedContent ? (
          <pre className="overflow-auto p-4 text-xs leading-6">
            <code>{selectedContent}</code>
          </pre>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            Select a file to view its contents.
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationList({
  notifications,
  onOpen,
  onDismiss,
  onMarkAllRead,
}: {
  notifications: GitHubNotification[];
  onOpen: (notification: GitHubNotification) => void;
  onDismiss: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  if (notifications.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-[#d0d7de] bg-white text-muted-foreground dark:border-[#30363d] dark:bg-[#0d1117]">
        No notifications
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-[#d0d7de] bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-[#d0d7de] bg-[#f6f8fa] px-4 py-3 dark:border-[#30363d] dark:bg-[#161b22]">
        <span className="font-semibold text-sm">Notifications</span>
        <Button variant="outline" size="sm" onClick={onMarkAllRead}>
          Mark all as read
        </Button>
      </div>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="group flex w-full items-center gap-3 border-b border-[#d0d7de] p-4 text-left last:border-b-0 hover:bg-[#f6f8fa] dark:border-[#30363d] dark:hover:bg-[#161b22]"
        >
          <button
            className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer"
            onClick={() => onOpen(notification)}
            type="button"
          >
            {notification.unread ? (
              <CircleDot className="size-4 text-blue-600" />
            ) : (
              <CheckCircle2 className="size-4 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{notification.title}</div>
              <div className="text-xs text-muted-foreground">
                {notification.reason} in {notification.repoId} ·{" "}
                {relativeTime(notification.timestamp)}
              </div>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {notification.targetType === "issue" ? (
              <CircleDot className="size-4 text-muted-foreground" />
            ) : (
              <GitPullRequest className="size-4 text-muted-foreground" />
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDismiss(notification.id)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
