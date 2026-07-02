"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, FileText, Menu, MessageSquare, Plus, Search, Star } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { appUsers } from "@/lib/users";
import { useActiveUser } from "@/lib/user-store";
import { cn } from "@/lib/utils";
import {
  canAccessPage,
  canAccessSpace,
  relativeTime,
  useConfluenceStore,
  type ConfluenceComment,
  type ConfluencePage,
  type ConfluenceSnapshot,
  type ConfluenceSpace,
} from "@/app/confluence/confluence-state";

function userName(id: string) {
  return appUsers.find((user) => user.id === id)?.name ?? "Unknown";
}

function initials(id: string) {
  return appUsers.find((user) => user.id === id)?.initials ?? "??";
}

export function ConfluenceApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeUser = useActiveUser();
  const spaces = useConfluenceStore((state) => state.spaces);
  const pages = useConfluenceStore((state) => state.pages);
  const createPage = useConfluenceStore((state) => state.createPage);
  const updatePage = useConfluenceStore((state) => state.updatePage);
  const addComment = useConfluenceStore((state) => state.addComment);
  const toggleWatch = useConfluenceStore((state) => state.toggleWatch);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [commentState, setCommentState] = useState({ key: "", value: "" });
  const previousUserId = useRef(activeUser.id);

  const snapshot = useMemo<ConfluenceSnapshot>(() => ({ spaces, pages }), [spaces, pages]);
  const accessibleSpaces = useMemo(
    () => Object.values(spaces).filter((space) => canAccessSpace(space, activeUser.id)),
    [activeUser.id, spaces],
  );
  const fallbackSpace = accessibleSpaces[0]?.id ?? "company";
  const spaceParam = searchParams.get("space");
  const spaceId = canAccessSpace(spaces[spaceParam ?? ""], activeUser.id)
    ? (spaceParam ?? fallbackSpace)
    : fallbackSpace;
  const pageId = searchParams.get("page");
  const query = searchParams.get("q") ?? "";
  const normalizedQuery = query.trim().toLowerCase();
  const commentDraft = commentState.key === pageId ? commentState.value : "";

  function setCommentDraft(value: string) {
    setCommentState({ key: pageId ?? "", value });
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
    const nextSpace =
      Object.values(spaces).find((space) => canAccessSpace(space, activeUser.id))?.id ?? "company";
    router.replace(`${pathname}?space=${nextSpace}`);
  }, [activeUser.id, pathname, router, spaces]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    if (!canAccessSpace(spaces[spaceParam ?? ""], activeUser.id)) {
      params.set("space", fallbackSpace);
      params.delete("page");
      params.delete("q");
      changed = true;
    }
    if (
      pageId &&
      (!canAccessPage(snapshot, pages[pageId], activeUser.id) || pages[pageId]?.spaceId !== spaceId)
    ) {
      params.delete("page");
      changed = true;
    }
    if (changed) router.replace(`${pathname}?${params.toString()}`);
  }, [
    activeUser.id,
    fallbackSpace,
    pageId,
    pages,
    pathname,
    router,
    searchParams,
    snapshot,
    spaceId,
    spaceParam,
    spaces,
  ]);

  const spacePages = Object.values(pages)
    .filter((page) => page.spaceId === spaceId && canAccessPage(snapshot, page, activeUser.id))
    .filter(
      (page) =>
        !normalizedQuery ||
        [
          page.title,
          page.body,
          page.labels.join(" "),
          page.comments.map((comment) => comment.body).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const selectedPage =
    pageId && canAccessPage(snapshot, pages[pageId], activeUser.id)
      ? pages[pageId]
      : (spacePages[0] ?? null);

  const sidebar = (
    <Sidebar
      spaces={accessibleSpaces}
      activeSpaceId={spaceId}
      pages={spacePages}
      activePageId={selectedPage?.id ?? ""}
      onSpace={(id) => {
        updateUrl({ space: id, page: null, q: null });
        setSidebarOpen(false);
      }}
      onPage={(id) => {
        updateUrl({ page: id });
        setSidebarOpen(false);
      }}
    />
  );

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 bg-[#f7f8f9] text-sm text-[#172b4d] dark:bg-[#111418] dark:text-[#e9f2ff]">
      <aside className="hidden w-80 shrink-0 border-r border-[#dfe1e6] bg-white lg:block dark:border-[#2b3138] dark:bg-[#17202a]">
        {sidebar}
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-80 border-[#dfe1e6] bg-white p-0 dark:border-[#2b3138] dark:bg-[#17202a]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Confluence navigation</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#dfe1e6] bg-white dark:border-[#2b3138] dark:bg-[#17202a]">
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
              <div className="font-semibold">{spaces[spaceId]?.name}</div>
              <div className="text-xs text-muted-foreground">{spaces[spaceId]?.description}</div>
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
          <div className="px-4 pb-3">
            <div className="relative max-w-md">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 bg-white pl-9 dark:bg-[#111418]"
                placeholder="Search pages"
                value={query}
                onChange={(event) => updateUrl({ q: event.target.value || null, page: null })}
              />
            </div>
          </div>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            {selectedPage ? (
              <PageDetail
                page={selectedPage}
                activeUserId={activeUser.id}
                commentDraft={commentDraft}
                onCommentDraft={setCommentDraft}
                onSave={(title, body) => updatePage(selectedPage.id, activeUser.id, title, body)}
                onWatch={() => toggleWatch(selectedPage.id, activeUser.id)}
                onComment={() => {
                  addComment(selectedPage.id, activeUser.id, commentDraft);
                  setCommentDraft("");
                }}
              />
            ) : (
              <Empty />
            )}
          </div>
        </ScrollArea>
      </section>
      <CreatePageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(input) => {
          const id = createPage({
            ...input,
            spaceId,
            actorId: activeUser.id,
            parentId: selectedPage?.id ?? null,
          });
          if (id) {
            setCreateOpen(false);
            updateUrl({ page: id, q: null });
          }
        }}
      />
    </main>
  );
}

function Sidebar({
  spaces,
  activeSpaceId,
  pages,
  activePageId,
  onSpace,
  onPage,
}: {
  spaces: ConfluenceSpace[];
  activeSpaceId: string;
  pages: ConfluencePage[];
  activePageId: string;
  onSpace: (id: string) => void;
  onPage: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#dfe1e6] p-4 dark:border-[#2b3138]">
        <div className="font-semibold">Confluence</div>
        <div className="text-xs text-muted-foreground">Spaces and docs</div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">Spaces</div>
          {spaces.map((space) => (
            <button
              key={space.id}
              className={cn(
                "mb-1 w-full cursor-pointer rounded-md px-3 py-2 text-left hover:bg-[#f1f2f4] dark:hover:bg-[#222b35]",
                activeSpaceId === space.id &&
                  "bg-[#e9f2ff] text-[#0c66e4] dark:bg-[#092957] dark:text-[#85b8ff]",
              )}
              onClick={() => onSpace(space.id)}
              type="button"
            >
              <div className="font-medium">{space.name}</div>
              <div className="text-xs text-muted-foreground">{space.key}</div>
            </button>
          ))}
          <div className="mt-4 mb-2 px-2 text-xs font-medium text-muted-foreground">Pages</div>
          {pages.map((page) => (
            <button
              key={page.id}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-[#f1f2f4] dark:hover:bg-[#222b35]",
                activePageId === page.id && "bg-[#f1f2f4] dark:bg-[#222b35]",
                page.parentId && "pl-7",
              )}
              onClick={() => onPage(page.id)}
              type="button"
            >
              <FileText className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{page.title}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function PageDetail({
  page,
  activeUserId,
  commentDraft,
  onCommentDraft,
  onSave,
  onWatch,
  onComment,
}: {
  page: ConfluencePage;
  activeUserId: string;
  commentDraft: string;
  onCommentDraft: (value: string) => void;
  onSave: (title: string, body: string) => void;
  onWatch: () => void;
  onComment: () => void;
}) {
  const [draft, setDraft] = useState({ key: "", title: "", body: "" });
  const title = draft.key === page.id ? draft.title : page.title;
  const body = draft.key === page.id ? draft.body : page.body;
  const watching = page.watchers.includes(activeUserId);
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="size-4" />
        <span>Updated {relativeTime(page.updatedAt)}</span>
        <span>Owner {userName(page.ownerId)}</span>
      </div>
      <div className="rounded-md border border-[#dfe1e6] bg-white p-5 dark:border-[#2b3138] dark:bg-[#17202a]">
        <Input
          className="h-auto border-transparent px-0 text-3xl font-semibold shadow-none focus-visible:ring-0"
          value={title}
          onChange={(event) => setDraft({ key: page.id, title: event.target.value, body })}
          onBlur={() => onSave(title, body)}
        />
        <Textarea
          className="mt-4 min-h-72 resize-none border-transparent px-0 text-base leading-7 shadow-none focus-visible:ring-0"
          value={body}
          onChange={(event) => setDraft({ key: page.id, title, body: event.target.value })}
          onBlur={() => onSave(title, body)}
        />
        <div className="mt-4 flex flex-wrap gap-1">
          {page.labels.map((label) => (
            <Badge key={label} variant="secondary">
              {label}
            </Badge>
          ))}
        </div>
        <Button
          variant={watching ? "secondary" : "outline"}
          className="mt-4 cursor-pointer"
          onClick={onWatch}
        >
          <Star className={cn("size-4", watching && "fill-yellow-400 text-yellow-500")} />
          {watching ? "Watching" : "Watch"}
        </Button>
      </div>
      <div className="mt-4 rounded-md border border-[#dfe1e6] bg-white p-4 dark:border-[#2b3138] dark:bg-[#17202a]">
        <div className="mb-3 font-semibold">Comments</div>
        <div className="space-y-3">
          {page.comments.map((comment) => (
            <Comment key={comment.id} comment={comment} />
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
              placeholder="Add a comment"
              value={commentDraft}
              onChange={(event) => onCommentDraft(event.target.value)}
            />
            <Button
              className="mt-2 cursor-pointer bg-[#0c66e4] text-white hover:bg-[#0052cc]"
              size="sm"
              disabled={!commentDraft.trim()}
              type="submit"
            >
              <MessageSquare className="size-4" />
              Comment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Comment({ comment }: { comment: ConfluenceComment }) {
  return (
    <div className="flex gap-3">
      <Avatar>
        <AvatarFallback>{initials(comment.authorId)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 rounded-md bg-[#f7f8f9] p-3 dark:bg-[#222b35]">
        <div className="text-xs text-muted-foreground">
          {userName(comment.authorId)} · {relativeTime(comment.timestamp)}
        </div>
        <p className="mt-1 whitespace-pre-line">{comment.body}</p>
      </div>
    </div>
  );
}

function CreatePageDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: { title: string; body: string; labels: string[] }) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [labels, setLabels] = useState("draft, spec");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create page</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            autoFocus
            placeholder="Page title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Textarea
            className="min-h-40"
            placeholder="Page body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Input
            placeholder="Labels"
            value={labels}
            onChange={(event) => setLabels(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="cursor-pointer bg-[#0c66e4] text-white hover:bg-[#0052cc]"
            disabled={!title.trim()}
            onClick={() =>
              onCreate({
                title,
                body,
                labels: labels
                  .split(",")
                  .map((label) => label.trim())
                  .filter(Boolean),
              })
            }
          >
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Empty() {
  return (
    <div className="flex h-72 items-center justify-center rounded-md border border-[#dfe1e6] bg-white text-muted-foreground dark:border-[#2b3138] dark:bg-[#17202a]">
      No pages match this view.
    </div>
  );
}
