"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { appUsers } from "@/lib/users";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AtSign,
  Bell,
  ChevronRight,
  Edit2,
  Edit3,
  FileText,
  Hash,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  SmilePlus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { captureActivityEvent } from "@/app/admin/activity-capture";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useActiveUser } from "@/lib/user-store";
import { cn } from "@/lib/utils";
import { refreshCorpusManifest } from "@/lib/corpus-app-data";
import {
  canAccessSurface,
  dmTitle,
  formatSlackTime,
  useSlackStore,
  userColor,
  userInitials,
  userName,
  type SlackAttachment,
  type SlackMessage,
} from "@/app/slack/slack-state";

function firstAccessibleChannel(
  channels: ReturnType<typeof useSlackStore.getState>["channels"],
  userId: string,
) {
  return Object.values(channels).find((channel) => channel.memberIds.includes(userId))?.id;
}

export function SlackApp({
  onAction,
}: { onAction?: (action: { type: string; payload: unknown }) => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeUser = useActiveUser();
  const channels = useSlackStore((state) => state.channels);
  const dms = useSlackStore((state) => state.dms);
  const messages = useSlackStore((state) => state.messages);
  const loadCorpusPage = useSlackStore((state) => state.loadCorpusPage);
  const sendMessage = useSlackStore((state) => state.sendMessage);
  const editMessage = useSlackStore((state) => state.editMessage);
  const deleteMessage = useSlackStore((state) => state.deleteMessage);
  const toggleReaction = useSlackStore((state) => state.toggleReaction);
  const markSurfaceRead = useSlackStore((state) => state.markSurfaceRead);
  const makeAttachment = useSlackStore((state) => state.makeAttachment);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [threadDraft, setThreadDraft] = useState("");
  const [threadAttachments, setThreadAttachments] = useState<SlackAttachment[]>([]);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelDesc, setChannelDesc] = useState("");
  const [startDmOpen, setStartDmOpen] = useState(false);
  const [dmMembers, setDmMembers] = useState<string[]>([]);
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const createChannel = useSlackStore((state) => state.createChannel);
  const createDm = useSlackStore((state) => state.createDm);
  const updateChannelTopic = useSlackStore((state) => state.updateChannelTopic);
  const addChannelMembers = useSlackStore((state) => state.addChannelMembers);
  const [attachments, setAttachments] = useState<SlackAttachment[]>([]);
  const [corpusPage, setCorpusPage] = useState(0);
  const [corpusPageCount, setCorpusPageCount] = useState(0);
  const [corpusEventCount, setCorpusEventCount] = useState(0);
  const [corpusLoading, setCorpusLoading] = useState(false);
  const previousUserId = useRef(activeUser.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialCorpus() {
      setCorpusLoading(true);
      try {
        const manifest = await refreshCorpusManifest();
        const app = manifest.apps.slack;
        if (cancelled) return;
        setCorpusPageCount(app?.pageCount ?? 0);
        setCorpusEventCount(app?.count ?? 0);
        const count = await loadCorpusPage(1);
        if (cancelled) return;
        if (count > 0) setCorpusPage(1);
      } finally {
        if (!cancelled) setCorpusLoading(false);
      }
    }

    void loadInitialCorpus();
    return () => {
      cancelled = true;
    };
  }, [loadCorpusPage]);

  async function loadNextCorpusPage() {
    if (corpusLoading || corpusPage >= corpusPageCount) return;
    const nextPage = corpusPage + 1;
    setCorpusLoading(true);
    try {
      const count = await loadCorpusPage(nextPage);
      if (count > 0) setCorpusPage(nextPage);
    } finally {
      setCorpusLoading(false);
    }
  }

  const channelParam = searchParams.get("channel");
  const dmParam = searchParams.get("dm");
  const threadId = searchParams.get("thread");
  const messageId = searchParams.get("message");
  const query = searchParams.get("q") ?? "";
  const fallbackChannel = firstAccessibleChannel(channels, activeUser.id) ?? "team-updates";
  const surfaceType: "channel" | "dm" =
    dmParam && dms[dmParam]?.participantIds.includes(activeUser.id) ? "dm" : "channel";
  const surfaceId =
    surfaceType === "dm"
      ? (dmParam ?? "")
      : channelParam && channels[channelParam]?.memberIds.includes(activeUser.id)
        ? channelParam
        : fallbackChannel;
  const surfaceAllowed = canAccessSurface(
    { channels, dms, messages },
    { surfaceType, surfaceId, userId: activeUser.id },
  );

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
    setSidebarOpen(false);
    setDraft("");
    setThreadDraft("");
    setThreadAttachments([]);
    setCreateChannelOpen(false);
    setStartDmOpen(false);
    setAttachments([]);
    const nextChannel = firstAccessibleChannel(channels, activeUser.id) ?? "team-updates";
    router.replace(`${pathname}?channel=${nextChannel}`);
  }, [activeUser.id, channels, pathname, router]);

  useEffect(() => {
    if (!surfaceAllowed) {
      router.replace(`${pathname}?channel=${fallbackChannel}`);
      return;
    }
    markSurfaceRead(surfaceId, activeUser.id);
  }, [
    activeUser.id,
    fallbackChannel,
    markSurfaceRead,
    pathname,
    router,
    surfaceAllowed,
    surfaceId,
  ]);

  const surfaceMessages = useMemo(
    () =>
      Object.values(messages)
        .filter(
          (message) =>
            message.surfaceId === surfaceId &&
            message.surfaceType === surfaceType &&
            !message.threadParentId,
        )
        .filter((message) => !query || message.body.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.timestamp - b.timestamp),
    [messages, query, surfaceId, surfaceType],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [surfaceId, surfaceMessages.length]);

  const threadParent = threadId ? messages[threadId] : null;
  const threadReplies = useMemo(
    () =>
      Object.values(messages)
        .filter((message) => message.threadParentId === threadId)
        .sort((a, b) => a.timestamp - b.timestamp),
    [messages, threadId],
  );

  useEffect(() => {
    if (!messageId) return;
    window.setTimeout(() => {
      const element = document.getElementById(messageId);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-blue-400", "ring-offset-2");
      window.setTimeout(() => {
        element.classList.remove("ring-2", "ring-blue-400", "ring-offset-2");
      }, 2200);
    }, 100);
  }, [messageId, surfaceId, threadId, surfaceMessages.length, threadReplies.length]);
  const unreadBySurface = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(messages).forEach((message) => {
      if (!message.threadParentId && !message.readBy.includes(activeUser.id)) {
        counts[message.surfaceId] = (counts[message.surfaceId] ?? 0) + 1;
      }
    });
    return counts;
  }, [activeUser.id, messages]);

  const currentTitle =
    surfaceType === "channel"
      ? `# ${channels[surfaceId]?.name ?? "channel"}`
      : dmTitle(dms[surfaceId], activeUser.id);
  const currentSubtitle =
    surfaceType === "channel"
      ? channels[surfaceId]?.topic
      : `${dms[surfaceId]?.participantIds.map(userName).join(", ")}`;

  function sendCurrentMessage(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const id = sendMessage({
      surfaceType,
      surfaceId,
      authorId: activeUser.id,
      body: draft,
      attachments,
    });
    if (id) {
      onAction?.({
        type: "SEND_MESSAGE",
        payload: { id, surfaceType, surfaceId, authorId: activeUser.id, body: draft, attachments },
      });
      captureActivityEvent({
        sourceApp: "slack",
        actorId: activeUser.id,
        type: "message",
        action: surfaceType === "channel" ? "Posted channel message" : "Sent direct message",
        title: `Slack ${surfaceType === "channel" ? currentTitle : "direct message"}`,
        body:
          draft || `${attachments.length} attachment${attachments.length === 1 ? "" : "s"} sent`,
        sourceEntityId: id,
        sourceEntityType: surfaceType === "channel" ? "channel_message" : "direct_message",
        sourceUrl:
          surfaceType === "channel"
            ? `/slack?channel=${surfaceId}&message=${id}#${id}`
            : `/slack?dm=${surfaceId}&message=${id}#${id}`,
        metadata: { surfaceType, surfaceId, attachmentCount: attachments.length },
      });
    }
    if (!id) {
      toast.error("Message could not be sent in this conversation");
      return;
    }
    setDraft("");
    setAttachments([]);
    if (query) updateUrl({ q: null });
    toast.success("Message sent");
  }

  function sendThreadReply(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!threadParent) return;
    const id = sendMessage({
      surfaceType: threadParent.surfaceType,
      surfaceId: threadParent.surfaceId,
      authorId: activeUser.id,
      body: threadDraft,
      threadParentId: threadParent.id,
      attachments: threadAttachments,
    });
    if (id) {
      onAction?.({
        type: "SEND_REPLY",
        payload: {
          id,
          surfaceType: threadParent.surfaceType,
          surfaceId: threadParent.surfaceId,
          authorId: activeUser.id,
          body: threadDraft,
          threadParentId: threadParent.id,
          attachments: threadAttachments,
        },
      });
      captureActivityEvent({
        sourceApp: "slack",
        actorId: activeUser.id,
        type: "reply",
        action: "Replied in Slack thread",
        title: `Thread reply in ${currentTitle}`,
        body:
          threadDraft ||
          `${threadAttachments.length} attachment${threadAttachments.length === 1 ? "" : "s"} sent`,
        sourceEntityId: id,
        sourceEntityType: "thread_reply",
        sourceUrl:
          threadParent.surfaceType === "channel"
            ? `/slack?channel=${threadParent.surfaceId}&thread=${threadParent.id}&message=${id}#${id}`
            : `/slack?dm=${threadParent.surfaceId}&thread=${threadParent.id}&message=${id}#${id}`,
        metadata: {
          surfaceType: threadParent.surfaceType,
          surfaceId: threadParent.surfaceId,
          threadParentId: threadParent.id,
          attachmentCount: threadAttachments.length,
        },
      });
    }
    if (!id) {
      toast.error("Reply could not be sent");
      return;
    }
    setThreadDraft("");
    setThreadAttachments([]);
    setCreateChannelOpen(false);
    setStartDmOpen(false);
  }

  const sidebar = (
    <SlackSidebar
      activeUserId={activeUser.id}
      channels={channels}
      dms={dms}
      activeSurfaceId={surfaceId}
      activeSurfaceType={surfaceType}
      unreadBySurface={unreadBySurface}
      onCreateChannel={() => setCreateChannelOpen(true)}
      onCreateDm={() => setStartDmOpen(true)}
      onChannel={(id) => {
        updateUrl({ channel: id, dm: null, thread: null, q: null });
        setSidebarOpen(false);
      }}
      onDm={(id) => {
        updateUrl({ dm: id, channel: null, thread: null, message: null, q: null });
        setSidebarOpen(false);
      }}
      corpusPage={corpusPage}
      corpusPageCount={corpusPageCount}
      corpusEventCount={corpusEventCount}
      corpusLoading={corpusLoading}
      onLoadMore={loadNextCorpusPage}
    />
  );

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 bg-[#f8f5f8] text-sm text-foreground dark:bg-[#1d1028]">
      <aside className="hidden w-72 shrink-0 border-r border-[#3f0e40]/20 bg-[#4a154b] text-white lg:block dark:border-white/10 dark:bg-[#1d1028]">
        {sidebar}
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-80 border-[#3f0e40]/20 bg-[#4a154b] p-0 text-white dark:border-white/10 dark:bg-[#1d1028]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Slack navigation</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <section className="flex min-w-0 flex-1 flex-col bg-white text-foreground dark:bg-[#1a1d21] dark:text-zinc-100">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-3 dark:border-white/10 dark:bg-[#19171d]">
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{currentTitle}</span>
              {surfaceType === "channel" && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setTopicDraft(channels[surfaceId]?.topic || "");
                    setTopicOpen(true);
                  }}
                >
                  <Edit2 className="size-3" />
                </Button>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">{currentSubtitle}</div>
          </div>
          {surfaceType === "channel" && (
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:flex"
              onClick={() => setAddMemberOpen(true)}
            >
              <UserPlus className="size-4 mr-2" />
              Add
            </Button>
          )}
          <div className="relative hidden w-80 sm:block">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Search visible messages"
              value={query}
              onChange={(event) => updateUrl({ q: event.target.value || null })}
            />
          </div>
          <Button variant="ghost" size="icon-sm" className="cursor-pointer">
            <Bell />
          </Button>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto max-w-5xl px-4 py-4">
            {surfaceMessages.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center gap-2 text-muted-foreground">
                <MessageSquare className="size-10" />
                <p>No visible messages here.</p>
              </div>
            ) : (
              surfaceMessages.map((message) => (
                <div
                  key={message.id}
                  className={
                    query
                      ? "cursor-pointer rounded border border-blue-500/30 bg-blue-50/50 dark:bg-blue-900/20"
                      : ""
                  }
                  onClick={() => {
                    if (query) {
                      updateUrl({ q: null });
                      // Basic visual cue
                      setTimeout(() => {
                        const el = document.getElementById(message.id);
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                          el.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
                          setTimeout(() => {
                            el.style.backgroundColor = "";
                          }, 2000);
                        }
                      }, 100);
                    }
                  }}
                >
                  <div id={message.id}>
                    <SlackMessageRow
                      message={message}
                      replyCount={
                        Object.values(messages).filter((item) => item.threadParentId === message.id)
                          .length
                      }
                      activeUserId={activeUser.id}
                      onThread={() => updateUrl({ thread: message.id, message: null })}
                      onReact={(emoji) => toggleReaction(message.id, activeUser.id, emoji)}
                      onEdit={(body) => editMessage(message.id, activeUser.id, body)}
                      onDelete={() => deleteMessage(message.id, activeUser.id)}
                    />
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <form
          className="shrink-0 border-t bg-white p-3 dark:border-white/10 dark:bg-[#1a1d21]"
          onSubmit={sendCurrentMessage}
        >
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <Badge key={attachment.id} variant="outline" className="gap-2">
                  <FileText className="size-3.5" />
                  {attachment.name}
                  <button
                    className="cursor-pointer"
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((item) => item.id !== attachment.id),
                      )
                    }
                    type="button"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="rounded-lg border bg-white p-2 shadow-sm dark:border-white/15 dark:bg-[#222529]">
            <Textarea
              className="min-h-20 resize-none border-0 shadow-none focus-visible:ring-0"
              placeholder={`Message ${currentTitle}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) return;
                event.preventDefault();
                sendCurrentMessage();
              }}
            />
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                type="button"
                onClick={() =>
                  setAttachments((current) => [...current, makeAttachment(`slack-${Date.now()}`)])
                }
              >
                <Paperclip />
              </Button>
              <Button
                className="ml-auto cursor-pointer gap-2 bg-[#007a5a] text-white hover:bg-[#148567]"
                size="sm"
                type="button"
                onClick={() => sendCurrentMessage()}
                disabled={!draft.trim() && attachments.length === 0}
              >
                <Send className="size-4" />
                Send
              </Button>
            </div>
          </div>
        </form>
      </section>

      {threadParent &&
        canAccessSurface(
          { channels, dms, messages },
          {
            surfaceType: threadParent.surfaceType,
            surfaceId: threadParent.surfaceId,
            userId: activeUser.id,
          },
        ) && (
          <aside className="hidden w-104 shrink-0 border-l bg-white text-foreground xl:flex xl:flex-col dark:border-white/10 dark:bg-[#1a1d21] dark:text-zinc-100">
            <div className="flex h-14 items-center justify-between border-b px-4 dark:border-white/10">
              <div>
                <div className="font-semibold">Thread</div>
                <div className="text-xs text-muted-foreground">{currentTitle}</div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                onClick={() => updateUrl({ thread: null, message: null })}
              >
                <X />
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-4">
                <SlackMessageRow
                  message={threadParent}
                  replyCount={threadReplies.length}
                  activeUserId={activeUser.id}
                  onThread={() => undefined}
                  onReact={(emoji) => toggleReaction(threadParent.id, activeUser.id, emoji)}
                  onEdit={(body) => editMessage(threadParent.id, activeUser.id, body)}
                  onDelete={() => deleteMessage(threadParent.id, activeUser.id)}
                />
                <Separator className="my-4" />
                {threadReplies.map((reply) => (
                  <SlackMessageRow
                    key={reply.id}
                    message={reply}
                    replyCount={0}
                    activeUserId={activeUser.id}
                    onThread={() => undefined}
                    onReact={(emoji) => toggleReaction(reply.id, activeUser.id, emoji)}
                    onEdit={(body) => editMessage(reply.id, activeUser.id, body)}
                    onDelete={() => deleteMessage(reply.id, activeUser.id)}
                  />
                ))}
              </div>
            </ScrollArea>
            <form className="border-t p-3 dark:border-white/10" onSubmit={sendThreadReply}>
              {threadAttachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {threadAttachments.map((attachment) => (
                    <Badge key={attachment.id} variant="outline" className="gap-2">
                      <FileText className="size-3.5" />
                      {attachment.name}
                      <button
                        className="cursor-pointer"
                        onClick={() =>
                          setThreadAttachments((current) =>
                            current.filter((item) => item.id !== attachment.id),
                          )
                        }
                        type="button"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="rounded-lg border bg-white p-2 shadow-sm dark:border-white/15 dark:bg-[#222529]">
                <Textarea
                  className="min-h-20 resize-none border-0 shadow-none focus-visible:ring-0"
                  placeholder="Reply in thread"
                  value={threadDraft}
                  onChange={(event) => setThreadDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey) return;
                    event.preventDefault();
                    sendThreadReply();
                  }}
                />
                <div className="flex items-center gap-1 mt-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer"
                    type="button"
                    onClick={() =>
                      setThreadAttachments([...threadAttachments, makeAttachment("thread")])
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                  <div className="flex-1" />
                  <Button
                    className="cursor-pointer gap-2"
                    size="sm"
                    type="submit"
                    disabled={!threadDraft.trim() && threadAttachments.length === 0}
                  >
                    <Send className="size-4" />
                    Reply
                  </Button>
                </div>
              </div>
            </form>
          </aside>
        )}

      <Dialog open={createChannelOpen} onOpenChange={setCreateChannelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. plan-budget"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={channelDesc} onChange={(e) => setChannelDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateChannelOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!channelName.trim()) return;
                const id = createChannel(channelName, channelDesc, "", activeUser.id);
                onAction?.({
                  type: "CREATE_CHANNEL",
                  payload: {
                    id,
                    name: channelName,
                    description: channelDesc,
                    authorId: activeUser.id,
                  },
                });
                captureActivityEvent({
                  sourceApp: "slack",
                  actorId: activeUser.id,
                  type: "create",
                  action: "Created Slack channel",
                  title: `Created #${channelName}`,
                  body: channelDesc || "New Slack channel created.",
                  sourceEntityId: id,
                  sourceEntityType: "channel",
                  sourceUrl: `/slack?channel=${id}`,
                  metadata: { name: channelName, description: channelDesc },
                });
                setCreateChannelOpen(false);
                setChannelName("");
                setChannelDesc("");
                updateUrl({ channel: id, dm: null });
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={startDmOpen} onOpenChange={setStartDmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Direct messages</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">To:</Label>
            <ScrollArea className="h-40 rounded-md border p-2">
              <div className="space-y-2">
                {appUsers
                  .filter((u) => u.id !== activeUser.id)
                  .map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={dmMembers.includes(u.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setDmMembers([...dmMembers, u.id]);
                          else setDmMembers(dmMembers.filter((id) => id !== u.id));
                        }}
                      />
                      {u.name}
                    </label>
                  ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (dmMembers.length === 0) return;
                const ids = [activeUser.id, ...dmMembers];
                // Check if DM exists
                const existing = Object.values(dms).find(
                  (dm) =>
                    dm.participantIds.length === ids.length &&
                    dm.participantIds.every((id) => ids.includes(id)),
                );
                if (existing) {
                  updateUrl({ dm: existing.id, channel: null });
                } else {
                  const id = createDm(ids);
                  updateUrl({ dm: id, channel: null });
                }
                setStartDmOpen(false);
                setDmMembers([]);
              }}
            >
              Go
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={topicOpen} onOpenChange={setTopicOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit channel topic</DialogTitle>
          </DialogHeader>
          <Textarea
            className="min-h-24"
            value={topicDraft}
            onChange={(e) => setTopicDraft(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopicOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                updateChannelTopic(surfaceId, topicDraft, activeUser.id);
                setTopicOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add members</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-40 rounded-md border p-2">
              <div className="space-y-2">
                {appUsers
                  .filter((u) => !channels[surfaceId]?.memberIds.includes(u.id))
                  .map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={newMembers.includes(u.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setNewMembers([...newMembers, u.id]);
                          else setNewMembers(newMembers.filter((id) => id !== u.id));
                        }}
                      />
                      {u.name}
                    </label>
                  ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (newMembers.length > 0) {
                  addChannelMembers(surfaceId, newMembers, activeUser.id);
                }
                setAddMemberOpen(false);
                setNewMembers([]);
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SlackSidebar({
  activeUserId,
  channels,
  dms,
  activeSurfaceId,
  activeSurfaceType,
  unreadBySurface,
  onCreateChannel,
  onCreateDm,
  onChannel,
  onDm,
  corpusPage,
  corpusPageCount,
  corpusEventCount,
  corpusLoading,
  onLoadMore,
}: {
  onCreateChannel: () => void;
  onCreateDm: () => void;
  activeUserId: string;
  channels: ReturnType<typeof useSlackStore.getState>["channels"];
  dms: ReturnType<typeof useSlackStore.getState>["dms"];
  activeSurfaceId: string;
  activeSurfaceType: "channel" | "dm";
  unreadBySurface: Record<string, number>;
  onChannel: (id: string) => void;
  onDm: (id: string) => void;
  corpusPage: number;
  corpusPageCount: number;
  corpusEventCount: number;
  corpusLoading: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 p-4">
        <div className="text-base font-semibold">Corp OS</div>
        <div className="mt-1 text-xs text-white/60">Workspace</div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          <SidebarSection
            title="Channels"
            action={
              <button
                className="cursor-pointer hover:bg-white/10 rounded p-1"
                onClick={onCreateChannel}
              >
                <Plus className="size-3" />
              </button>
            }
          >
            {Object.values(channels)
              .filter((channel) => channel.memberIds.includes(activeUserId))
              .map((channel) => (
                <SidebarButton
                  key={channel.id}
                  active={activeSurfaceType === "channel" && activeSurfaceId === channel.id}
                  count={unreadBySurface[channel.id]}
                  icon={Hash}
                  label={channel.name}
                  onClick={() => onChannel(channel.id)}
                />
              ))}
          </SidebarSection>
          <SidebarSection
            title="Direct messages"
            action={
              <button className="cursor-pointer hover:bg-white/10 rounded p-1" onClick={onCreateDm}>
                <Plus className="size-3" />
              </button>
            }
          >
            {Object.values(dms)
              .filter((dm) => dm.participantIds.includes(activeUserId))
              .map((dm) => (
                <SidebarButton
                  key={dm.id}
                  active={activeSurfaceType === "dm" && activeSurfaceId === dm.id}
                  count={unreadBySurface[dm.id]}
                  icon={AtSign}
                  label={dmTitle(dm, activeUserId)}
                  onClick={() => onDm(dm.id)}
                />
              ))}
          </SidebarSection>
        </div>
      </ScrollArea>
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-white/60">
          <span className="truncate">Corpus</span>
          <span className="shrink-0">
            {corpusPageCount > 0 ? `${corpusPage}/${corpusPageCount}` : "0/0"}
          </span>
        </div>
        <div className="mb-2 truncate text-xs text-white/50">
          {new Intl.NumberFormat("en-US").format(corpusEventCount)} Slack events available
        </div>
        <Button
          className="h-8 w-full cursor-pointer border-white/15 bg-white/10 text-white hover:bg-white/15"
          disabled={corpusLoading || corpusPage >= corpusPageCount || corpusPageCount === 0}
          onClick={onLoadMore}
          size="sm"
          type="button"
          variant="outline"
        >
          {corpusLoading
            ? "Loading..."
            : corpusPage >= corpusPageCount && corpusPageCount > 0
              ? "All loaded"
              : "Load more"}
        </Button>
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="mb-1 flex items-center justify-between px-2 text-xs font-medium text-white/60">
        <div className="flex items-center gap-1">
          <ChevronRight className="size-3" />
          {title}
        </div>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarButton({
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  count?: number;
  icon: typeof Hash;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm text-white/75 hover:bg-white/10 hover:text-white",
        active && "bg-[#1164a3] text-white hover:bg-[#1164a3]",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {Boolean(count) && <span className="rounded bg-white/20 px-1.5 text-xs">{count}</span>}
    </button>
  );
}

function SlackMessageRow({
  message,
  replyCount,
  activeUserId,
  onThread,
  onReact,
  onEdit,
  onDelete,
}: {
  message: SlackMessage;
  replyCount: number;
  activeUserId: string;
  onThread: () => void;
  onReact: (emoji: string) => void;
  onEdit: (body: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(message.body);
  const own = message.authorId === activeUserId;

  return (
    <div id={message.id} className="group flex gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
      <Avatar>
        <AvatarFallback className={cn("text-xs font-semibold", userColor(message.authorId))}>
          {userInitials(message.authorId)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-semibold">{userName(message.authorId)}</span>
          <span className="text-xs text-muted-foreground">
            {formatSlackTime(message.timestamp)}
          </span>
          {message.edited && <span className="text-xs text-muted-foreground">(edited)</span>}
        </div>
        {editing ? (
          <div className="mt-2 rounded-md border p-2">
            <Textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  onEdit(editBody);
                  setEditing(false);
                }}
              >
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p
            className={cn(
              "mt-0.5 whitespace-pre-line leading-6",
              message.deleted && "text-muted-foreground",
            )}
          >
            {message.body}
          </p>
        )}
        {message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <Badge key={attachment.id} variant="outline" className="gap-2 rounded-md">
                <FileText className="size-3.5" />
                {attachment.name}
                <span className="text-muted-foreground">{attachment.size}</span>
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {message.reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              className={cn(
                "flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted",
                reaction.userIds.includes(activeUserId) &&
                  "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/40",
              )}
              onClick={() => onReact(reaction.emoji)}
              type="button"
            >
              {reaction.emoji}
              {reaction.userIds.length}
            </button>
          ))}
          {replyCount > 0 && (
            <button
              className="cursor-pointer text-xs font-medium text-blue-600 hover:underline"
              onClick={onThread}
              type="button"
            >
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      </div>
      <div className="opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon-sm" className="cursor-pointer bg-background">
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer" onClick={() => onReact("✅")}>
                <SmilePlus className="size-4" />
                React
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={onThread}>
                <MessageSquare className="size-4" />
                Reply thread
              </DropdownMenuItem>
              {own && !message.deleted && (
                <DropdownMenuItem className="cursor-pointer" onClick={() => setEditing(true)}>
                  <Edit3 className="size-4" />
                  Edit message
                </DropdownMenuItem>
              )}
              {own && !message.deleted && (
                <DropdownMenuItem className="cursor-pointer text-destructive" onClick={onDelete}>
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
