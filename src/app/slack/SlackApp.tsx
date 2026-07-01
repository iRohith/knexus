"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AtSign,
  Bell,
  ChevronRight,
  Edit3,
  FileText,
  Hash,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useActiveUser } from "@/lib/user-store";
import { cn } from "@/lib/utils";
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

export function SlackApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeUser = useActiveUser();
  const channels = useSlackStore((state) => state.channels);
  const dms = useSlackStore((state) => state.dms);
  const messages = useSlackStore((state) => state.messages);
  const sendMessage = useSlackStore((state) => state.sendMessage);
  const editMessage = useSlackStore((state) => state.editMessage);
  const deleteMessage = useSlackStore((state) => state.deleteMessage);
  const toggleReaction = useSlackStore((state) => state.toggleReaction);
  const markSurfaceRead = useSlackStore((state) => state.markSurfaceRead);
  const makeAttachment = useSlackStore((state) => state.makeAttachment);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [threadDraft, setThreadDraft] = useState("");
  const [attachments, setAttachments] = useState<SlackAttachment[]>([]);
  const previousUserId = useRef(activeUser.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const channelParam = searchParams.get("channel");
  const dmParam = searchParams.get("dm");
  const threadId = searchParams.get("thread");
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
    });
    if (!id) {
      toast.error("Reply could not be sent");
      return;
    }
    setThreadDraft("");
  }

  const sidebar = (
    <SlackSidebar
      activeUserId={activeUser.id}
      channels={channels}
      dms={dms}
      activeSurfaceId={surfaceId}
      activeSurfaceType={surfaceType}
      unreadBySurface={unreadBySurface}
      onChannel={(id) => {
        updateUrl({ channel: id, dm: null, thread: null, q: null });
        setSidebarOpen(false);
      }}
      onDm={(id) => {
        updateUrl({ dm: id, channel: null, thread: null, q: null });
        setSidebarOpen(false);
      }}
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
            <div className="truncate font-semibold">{currentTitle}</div>
            <div className="truncate text-xs text-muted-foreground">{currentSubtitle}</div>
          </div>
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
                <SlackMessageRow
                  key={message.id}
                  message={message}
                  replyCount={
                    Object.values(messages).filter((item) => item.threadParentId === message.id)
                      .length
                  }
                  activeUserId={activeUser.id}
                  onThread={() => updateUrl({ thread: message.id })}
                  onReact={(emoji) => toggleReaction(message.id, activeUser.id, emoji)}
                  onEdit={(body) => editMessage(message.id, activeUser.id, body)}
                  onDelete={() => deleteMessage(message.id, activeUser.id)}
                />
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
          <aside className="hidden w-[26rem] shrink-0 border-l bg-white text-foreground xl:flex xl:flex-col dark:border-white/10 dark:bg-[#1a1d21] dark:text-zinc-100">
            <div className="flex h-14 items-center justify-between border-b px-4 dark:border-white/10">
              <div>
                <div className="font-semibold">Thread</div>
                <div className="text-xs text-muted-foreground">{currentTitle}</div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                onClick={() => updateUrl({ thread: null })}
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
              <Textarea
                className="min-h-20 resize-none"
                placeholder="Reply in thread"
                value={threadDraft}
                onChange={(event) => setThreadDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  sendThreadReply();
                }}
              />
              <Button
                className="mt-2 cursor-pointer gap-2"
                size="sm"
                type="submit"
                disabled={!threadDraft.trim()}
              >
                <Send className="size-4" />
                Reply
              </Button>
            </form>
          </aside>
        )}
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
  onChannel,
  onDm,
}: {
  activeUserId: string;
  channels: ReturnType<typeof useSlackStore.getState>["channels"];
  dms: ReturnType<typeof useSlackStore.getState>["dms"];
  activeSurfaceId: string;
  activeSurfaceType: "channel" | "dm";
  unreadBySurface: Record<string, number>;
  onChannel: (id: string) => void;
  onDm: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 p-4">
        <div className="text-base font-semibold">Corp OS</div>
        <div className="mt-1 text-xs text-white/60">Slack workspace replica</div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          <SidebarSection title="Channels">
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
          <SidebarSection title="Direct messages">
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
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-1 flex items-center gap-1 px-2 text-xs font-medium text-white/60">
        <ChevronRight className="size-3" />
        {title}
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
    <div className="group flex gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
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
