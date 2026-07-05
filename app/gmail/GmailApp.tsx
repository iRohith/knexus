"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  Bold,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Forward,
  Inbox,
  Italic,
  Mail,
  Menu,
  MoreVertical,
  Paperclip,
  Pencil,
  Reply,
  ReplyAll,
  Search,
  ShieldAlert,
  Star,
  Tag,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PAGE_SIZE,
  folders,
  formatRecipients,
  getInitials,
  parseRecipients,
  parseSearchQuery,
  useGmailMailStore,
  type Attachment,
  type Conversation,
  type Draft,
  type DraftMode,
  type Folder,
  type MailAction,
  type Message,
  type SystemLabel,
} from "@/app/gmail/mail-state";
import { appUsers, userToRecipient } from "@/lib/users";
import { useActiveUser } from "@/lib/stores/user-store";

type ListItem =
  | {
      type: "conversation";
      id: string;
      conversation: Conversation;
      messages: Message[];
      latestMessage: Message;
    }
  | {
      type: "draft";
      id: string;
      draft: Draft;
    };

function normalizeFolder(value: string | null): Folder {
  return folders.some((folder) => folder.key === value) ? (value as Folder) : "inbox";
}

function matchesText(value: string, needle?: string) {
  return !needle || value.toLowerCase().includes(needle);
}

function messageRecipients(message: Message) {
  return [...message.to, ...message.cc, ...message.bcc];
}

function mailboxKey(email: string) {
  return (
    email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") ?? ""
  );
}

function sameMailbox(left: string, right: string) {
  return left === right || (mailboxKey(left) !== "" && mailboxKey(left) === mailboxKey(right));
}

function messageIncludesRecipient(message: Message, email: string) {
  return messageRecipients(message).some((recipient) => sameMailbox(recipient.email, email));
}

function userParticipatesInConversation(messages: Message[], email: string) {
  return messages.some(
    (message) => sameMailbox(message.from.email, email) || messageIncludesRecipient(message, email),
  );
}

function conversationMatchesFolder({
  conversation,
  messages,
  draftCount,
  folder,
  activeEmail,
}: {
  conversation: Conversation;
  messages: Message[];
  draftCount: number;
  folder: Folder;
  activeEmail: string;
}) {
  const isTrash = conversation.systemLabels.includes("trash");
  const isSpam = conversation.systemLabels.includes("spam");
  const participates = userParticipatesInConversation(messages, activeEmail);
  const sentByActiveUser = messages.some((message) => sameMailbox(message.from.email, activeEmail));
  const receivedByActiveUser = messages.some(
    (message) =>
      !sameMailbox(message.from.email, activeEmail) &&
      messageIncludesRecipient(message, activeEmail),
  );

  if (!participates && draftCount === 0) return false;
  if (folder === "all") return participates && !isTrash && !isSpam;
  if (folder === "starred") return participates && conversation.starred && !isTrash && !isSpam;
  if (folder === "important") return participates && conversation.important && !isTrash && !isSpam;
  if (folder === "snoozed")
    return participates && Boolean(conversation.snoozedUntil) && !isTrash && !isSpam;
  if (folder === "drafts") return draftCount > 0;
  if (folder === "sent") return sentByActiveUser && !isTrash && !isSpam;
  if (folder === "inbox")
    return receivedByActiveUser && !isTrash && !isSpam && !conversation.snoozedUntil;
  if (folder === "spam") return participates && isSpam;
  if (folder === "trash") return participates && isTrash;
  return false;
}

function conversationMatchesSearch({
  conversation,
  messages,
  query,
  label,
}: {
  conversation: Conversation;
  messages: Message[];
  query: string;
  label: string;
}) {
  const filters = parseSearchQuery(query);
  const haystack = [
    conversation.subject,
    conversation.userLabels.join(" "),
    ...messages.flatMap((message) => [
      message.from.name,
      message.from.email,
      formatRecipients(message.to),
      formatRecipients(message.cc),
      formatRecipients(message.bcc),
      message.body,
      message.attachments.map((attachment) => attachment.name).join(" "),
    ]),
  ]
    .join(" ")
    .toLowerCase();

  if (label && !conversation.userLabels.some((item) => item.toLowerCase() === label.toLowerCase()))
    return false;
  if (
    filters.label &&
    !conversation.userLabels.some((item) => item.toLowerCase() === filters.label)
  )
    return false;
  if (filters.subject && !conversation.subject.toLowerCase().includes(filters.subject))
    return false;
  if (
    filters.from &&
    !messages.some((message) =>
      matchesText(`${message.from.name} ${message.from.email}`, filters.from),
    )
  )
    return false;
  if (
    filters.to &&
    !messages.some((message) => matchesText(formatRecipients(message.to), filters.to))
  )
    return false;
  if (
    filters.cc &&
    !messages.some((message) => matchesText(formatRecipients(message.cc), filters.cc))
  )
    return false;
  if (
    filters.bcc &&
    !messages.some((message) => matchesText(formatRecipients(message.bcc), filters.bcc))
  )
    return false;
  if (filters.is === "read" && conversation.unreadCount > 0) return false;
  if (filters.is === "unread" && conversation.unreadCount === 0) return false;
  if (filters.is === "starred" && !conversation.starred) return false;
  if (filters.has === "attachment" && conversation.attachmentCount === 0) return false;
  if (filters.text.some((text) => !haystack.includes(text))) return false;
  return true;
}

function useUndoToast() {
  const undo = useGmailMailStore((state) => state.undo);
  return (message: string) => {
    toast.success(message, {
      action: {
        label: "Undo",
        onClick: undo,
      },
    });
  };
}

export function GmailApp({
  onAction,
}: { onAction?: (action: { type: string; payload: unknown }) => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeUser = useActiveUser();
  const currentUser = activeUser ?? appUsers[0];
  const activeRecipient = userToRecipient(currentUser);
  const folder = normalizeFolder(searchParams.get("folder"));
  const query = searchParams.get("q") ?? "";
  const label = searchParams.get("label") ?? "";
  const selectedId = searchParams.get("id");
  const composeId = searchParams.get("compose");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const conversations = useGmailMailStore((state) => state.conversations);
  const messages = useGmailMailStore((state) => state.messages);
  const drafts = useGmailMailStore((state) => state.drafts);
  const labels = useGmailMailStore((state) => state.labels);
  const loadCorpusPage = useGmailMailStore((state) => state.loadCorpusPage);
  const createDraft = useGmailMailStore((state) => state.createDraft);
  const mutateConversations = useGmailMailStore((state) => state.mutateConversations);
  const markRead = useGmailMailStore((state) => state.markRead);
  const toggleStar = useGmailMailStore((state) => state.toggleStar);
  const toggleImportant = useGmailMailStore((state) => state.toggleImportant);
  const addLabels = useGmailMailStore((state) => state.addLabels);
  const removeLabel = useGmailMailStore((state) => state.removeLabel);
  const moveTo = useGmailMailStore((state) => state.moveTo);
  const snooze = useGmailMailStore((state) => state.snooze);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const showUndo = useUndoToast();

  useEffect(() => {
    void loadCorpusPage();
  }, [loadCorpusPage, page]);

  function updateUrl(next: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value === null || value === "") params.delete(key);
      else params.set(key, String(value));
    });
    router.push(`${pathname}?${params.toString()}`);
  }

  const listItems = useMemo<ListItem[]>(() => {
    const parsedQuery = parseSearchQuery(query);
    const effectiveFolder = parsedQuery.in ?? folder;
    if (effectiveFolder === "drafts") {
      return Object.values(drafts)
        .filter((draft) => draft.from.email === activeRecipient.email)
        .filter((draft) => {
          const haystack = [
            draft.subject,
            draft.body,
            formatRecipients(draft.to),
            formatRecipients(draft.cc),
            formatRecipients(draft.bcc),
          ]
            .join(" ")
            .toLowerCase();
          return parsedQuery.text.every((text) => haystack.includes(text));
        })
        .map((draft) => ({ type: "draft" as const, id: draft.id, draft }))
        .sort(
          (a, b) => (Number(b.id.replace(/\D/g, "")) || 0) - (Number(a.id.replace(/\D/g, "")) || 0),
        );
    }

    const draftCounts = Object.values(drafts).reduce<Record<string, number>>((counts, draft) => {
      if (draft.from.email === activeRecipient.email && draft.conversationId)
        counts[draft.conversationId] = (counts[draft.conversationId] ?? 0) + 1;
      return counts;
    }, {});

    const conversationItems = Object.values(conversations)
      .map((conversation) => {
        const conversationMessages = conversation.messageIds
          .map((id) => messages[id])
          .filter(Boolean);
        const latestMessage = conversationMessages.at(-1);
        if (!latestMessage) return null;
        if (
          !conversationMatchesFolder({
            conversation,
            messages: conversationMessages,
            draftCount: draftCounts[conversation.id] ?? 0,
            folder: effectiveFolder,
            activeEmail: currentUser.email,
          })
        )
          return null;
        if (
          !conversationMatchesSearch({ conversation, messages: conversationMessages, query, label })
        )
          return null;
        return {
          type: "conversation" as const,
          id: conversation.id,
          conversation,
          messages: conversationMessages,
          latestMessage,
        };
      })
      .filter(Boolean) as ListItem[];

    return conversationItems.sort((a, b) => {
      const aTime =
        a.type === "draft" ? Number(a.id.replace(/\D/g, "")) || 0 : a.conversation.lastMessageAt;
      const bTime =
        b.type === "draft" ? Number(b.id.replace(/\D/g, "")) || 0 : b.conversation.lastMessageAt;
      return bTime - aTime;
    });
  }, [
    activeRecipient.email,
    currentUser.email,
    conversations,
    drafts,
    folder,
    label,
    messages,
    query,
  ]);

  const totalPages = Math.max(1, Math.ceil(listItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = listItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleConversationIds = pageItems
    .filter(
      (item): item is Extract<ListItem, { type: "conversation" }> => item.type === "conversation",
    )
    .map((item) => item.id);
  const matchingConversationIds = useMemo(
    () =>
      new Set(
        listItems
          .filter(
            (item): item is Extract<ListItem, { type: "conversation" }> =>
              item.type === "conversation",
          )
          .map((item) => item.id),
      ),
    [listItems],
  );
  const actionIds = selectAllMatching
    ? Array.from(matchingConversationIds)
    : Array.from(selectedIds).filter((id) => matchingConversationIds.has(id));
  const allVisibleSelected =
    visibleConversationIds.length > 0 && visibleConversationIds.every((id) => selectedIds.has(id));
  const rawSelectedConversation = selectedId ? conversations[selectedId] : null;
  const rawSelectedMessages =
    rawSelectedConversation?.messageIds.map((id) => messages[id]).filter(Boolean) ?? [];
  const selectedConversation =
    rawSelectedConversation &&
    userParticipatesInConversation(rawSelectedMessages, currentUser.email)
      ? rawSelectedConversation
      : null;
  const selectedMessages = selectedConversation ? rawSelectedMessages : [];
  const currentDraft =
    composeId && drafts[composeId]?.from.email === currentUser.email ? drafts[composeId] : null;
  const previousActiveUserId = useRef(currentUser.id);

  useEffect(() => {
    if (previousActiveUserId.current === currentUser.id) return;
    previousActiveUserId.current = currentUser.id;
    setSelectedIds(new Set());
    setSelectAllMatching(false);
    setMobileSidebarOpen(false);

    const params = new URLSearchParams(searchParams.toString());
    params.set("folder", "inbox");
    params.set("page", "1");
    params.delete("id");
    params.delete("compose");
    params.delete("label");
    params.delete("q");
    router.replace(`${pathname}?${params.toString()}`);
  }, [currentUser.id, pathname, router, searchParams]);

  function openFolder(nextFolder: Folder) {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
    updateUrl({ folder: nextFolder, label: null, page: 1, id: null });
    setMobileSidebarOpen(false);
  }

  function openCompose(input?: Partial<Draft>) {
    const draftId = createDraft({ ...input, from: activeRecipient });
    updateUrl({ compose: draftId });
  }

  function toggleVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleConversationIds.forEach((id) => next.delete(id));
      else visibleConversationIds.forEach((id) => next.add(id));
      return next;
    });
    setSelectAllMatching(false);
  }

  function runAction(action: MailAction, message: string, ids = actionIds) {
    if (ids.length === 0) return;
    mutateConversations(ids, action);
    setSelectedIds(new Set());
    setSelectAllMatching(false);
    if (selectedId && ids.includes(selectedId)) updateUrl({ id: null });
    showUndo(message);
  }

  function runRead(read: boolean) {
    if (actionIds.length === 0) return;
    markRead(actionIds, read);
    setSelectedIds(new Set());
    setSelectAllMatching(false);
    showUndo(read ? "Marked as read" : "Marked as unread");
  }

  function refresh() {
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      toast.success("Mail synced");
    }, 500);
  }

  const sidebar = (
    <MailSidebar
      folder={folder}
      label={label}
      labels={labels}
      conversations={Object.values(conversations)}
      messagesById={messages}
      drafts={Object.values(drafts)}
      activeEmail={currentUser.email}
      onCompose={() => openCompose()}
      onFolder={openFolder}
      onLabel={(nextLabel) => updateUrl({ label: nextLabel, folder: "all", page: 1, id: null })}
    />
  );

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 bg-muted/30 text-sm text-foreground">
      <aside className="hidden w-64 shrink-0 border-r bg-background lg:block">{sidebar}</aside>
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Gmail navigation</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <GmailShell
        query={query}
        syncing={syncing}
        onMenu={() => setMobileSidebarOpen(true)}
        onQuery={(value) => updateUrl({ q: value, page: 1, id: null })}
      >
        <section className="mx-2 mt-2 flex min-h-0 flex-1 overflow-hidden rounded-2xl border bg-background shadow-xs">
          {selectedConversation ? (
            <ConversationDetail
              conversation={selectedConversation}
              messages={selectedMessages}
              labels={labels}
              onBack={() => updateUrl({ id: null })}
              onAction={(action) =>
                runAction(action, `${action} complete`, [selectedConversation.id])
              }
              onStar={() => toggleStar(selectedConversation.id)}
              onImportant={() => toggleImportant(selectedConversation.id)}
              onLabel={(nextLabels) => {
                addLabels([selectedConversation.id], nextLabels);
                showUndo("Label added");
              }}
              onRemoveLabel={(nextLabel) => {
                removeLabel([selectedConversation.id], nextLabel);
                showUndo("Label removed");
              }}
              onMove={(target) => {
                moveTo([selectedConversation.id], target);
                updateUrl({ id: null });
                showUndo("Moved conversation");
              }}
              onSnooze={(until) => {
                snooze([selectedConversation.id], until);
                updateUrl({ id: null });
                showUndo("Conversation snoozed");
              }}
              onRespond={(message, mode) =>
                openCompose({
                  conversationId: selectedConversation.id,
                  mode,
                  to:
                    mode === "forward"
                      ? []
                      : mode === "replyAll"
                        ? [message.from, ...message.to, ...message.cc].filter(
                            (recipient, index, recipients) =>
                              recipient.email !== currentUser.email &&
                              recipients.findIndex((item) => item.email === recipient.email) ===
                                index,
                          )
                        : [message.from].filter(
                            (recipient) => recipient.email !== currentUser.email,
                          ),
                  subject:
                    mode === "forward"
                      ? `Fwd: ${selectedConversation.subject}`
                      : `Re: ${selectedConversation.subject}`,
                  body:
                    mode === "forward"
                      ? `\n\nForwarded message\nFrom: ${message.from.name} <${message.from.email}>\nTo: ${formatRecipients(message.to)}\nDate: ${message.date}, ${message.time}\n\n${message.body}`
                      : "",
                  attachments: mode === "forward" ? message.attachments : [],
                })
              }
            />
          ) : (
            <div className="flex min-w-0 flex-1 flex-col">
              <MailToolbar
                selectedCount={actionIds.length}
                allVisibleSelected={allVisibleSelected}
                rangeText={
                  listItems.length === 0
                    ? "0 of 0"
                    : `${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, listItems.length)} of ${listItems.length}`
                }
                page={currentPage}
                totalPages={totalPages}
                syncing={syncing}
                labels={labels}
                onToggleVisible={toggleVisible}
                onSelectAllMatching={() => setSelectAllMatching(true)}
                onArchive={() => runAction("archive", "Archived")}
                onTrash={() => runAction("trash", "Moved to trash")}
                onSpam={() => runAction("spam", "Marked as spam")}
                onRead={() => runRead(true)}
                onUnread={() => runRead(false)}
                onRefresh={refresh}
                onMove={(target) => {
                  moveTo(actionIds, target);
                  setSelectedIds(new Set());
                  setSelectAllMatching(false);
                  showUndo("Moved conversations");
                }}
                onLabel={(nextLabels) => {
                  addLabels(actionIds, nextLabels);
                  setSelectedIds(new Set());
                  setSelectAllMatching(false);
                  showUndo("Labels updated");
                }}
                onSnooze={(until) => {
                  snooze(actionIds, until);
                  setSelectedIds(new Set());
                  setSelectAllMatching(false);
                  showUndo("Snoozed");
                }}
                onPrev={() => updateUrl({ page: currentPage - 1 })}
                onNext={() => updateUrl({ page: currentPage + 1 })}
              />
              {allVisibleSelected &&
                !selectAllMatching &&
                listItems.length > visibleConversationIds.length && (
                  <button
                    className="border-b bg-blue-50 py-2 text-center text-sm text-blue-700 hover:underline dark:bg-blue-950/30 dark:text-blue-200"
                    onClick={() => setSelectAllMatching(true)}
                    type="button"
                  >
                    Select all {listItems.length} conversations in this view
                  </button>
                )}
              <ConversationList
                items={pageItems}
                selectedIds={selectedIds}
                folder={folder}
                activeEmail={currentUser.email}
                onOpenConversation={(id) => {
                  markRead([id], true);
                  updateUrl({ id });
                }}
                onOpenDraft={(id) => updateUrl({ compose: id })}
                onSelect={(id) => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                  setSelectAllMatching(false);
                }}
                onStar={toggleStar}
                onImportant={toggleImportant}
                onArchive={(id) => runAction("archive", "Archived", [id])}
                onTrash={(id) => runAction("trash", "Moved to trash", [id])}
                onRead={(id, read) => {
                  markRead([id], read);
                  showUndo(read ? "Marked as read" : "Marked as unread");
                }}
                onSnooze={(id) => {
                  snooze([id], new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
                  showUndo("Snoozed until tomorrow");
                }}
              />
            </div>
          )}
        </section>
      </GmailShell>

      {currentDraft && (
        <ComposeWindow
          draft={currentDraft}
          onClose={() => updateUrl({ compose: null })}
          onSent={() => {
            updateUrl({ compose: null });
            showUndo("Message sent");
            onAction?.({
              type: "SEND_EMAIL",
              payload: { draftId: currentDraft.id, authorId: currentUser.id, ...currentDraft },
            });
          }}
        />
      )}
    </main>
  );
}

function GmailShell({
  children,
  query,
  syncing,
  onMenu,
  onQuery,
}: {
  children: React.ReactNode;
  query: string;
  syncing: boolean;
  onMenu: () => void;
  onQuery: (value: string) => void;
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-3">
        <Button variant="ghost" size="icon" className="cursor-pointer lg:hidden" onClick={onMenu}>
          <Menu />
        </Button>
        <div className="relative max-w-2xl flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 rounded-full border-transparent bg-muted pl-10 shadow-none"
            placeholder="Search mail, e.g. from:maya has:attachment"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </div>
        {syncing && <span className="text-xs text-muted-foreground">Syncing...</span>}
      </div>
      {children}
    </section>
  );
}

function MailSidebar({
  folder,
  label,
  labels,
  conversations,
  messagesById,
  drafts,
  activeEmail,
  onCompose,
  onFolder,
  onLabel,
}: {
  folder: Folder;
  label: string;
  labels: string[];
  conversations: Conversation[];
  messagesById: Record<string, Message>;
  drafts: Draft[];
  activeEmail: string;
  onCompose: () => void;
  onFolder: (folder: Folder) => void;
  onLabel: (label: string) => void;
}) {
  function countFor(nextFolder: Folder) {
    if (nextFolder === "drafts")
      return drafts.filter((draft) => draft.from.email === activeEmail).length;
    const draftCounts = drafts.reduce<Record<string, number>>((counts, draft) => {
      if (draft.from.email === activeEmail && draft.conversationId)
        counts[draft.conversationId] = (counts[draft.conversationId] ?? 0) + 1;
      return counts;
    }, {});

    return conversations.filter((conversation) => {
      const conversationMessages = conversation.messageIds
        .map((id) => messagesById[id])
        .filter(Boolean);
      return conversationMatchesFolder({
        conversation,
        messages: conversationMessages,
        draftCount: draftCounts[conversation.id] ?? 0,
        folder: nextFolder,
        activeEmail,
      });
    }).length;
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="p-3">
        <Button
          className="h-12 cursor-pointer gap-3 rounded-2xl bg-blue-100 px-5 text-blue-950 shadow-sm hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-50 dark:hover:bg-blue-900"
          onClick={onCompose}
        >
          <Pencil className="size-5" />
          Compose
        </Button>
      </div>
      <nav className="space-y-1 px-2 text-sm">
        {folders.map((item) => {
          const Icon = item.icon;
          const isActive = folder === item.key && !label;
          return (
            <button
              key={item.key}
              className={`flex h-8 w-full cursor-pointer items-center gap-3 rounded-r-full px-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                isActive
                  ? "bg-red-100 font-semibold text-red-950 dark:bg-red-950/60 dark:text-red-100"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              onClick={() => onFolder(item.key)}
              type="button"
            >
              <Icon className="size-4" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="text-xs">{countFor(item.key)}</span>
            </button>
          );
        })}
      </nav>
      <Separator className="my-3" />
      <div className="px-5 text-xs font-medium text-muted-foreground">Labels</div>
      <div className="mt-2 space-y-1 px-2 text-sm">
        {labels.map((item) => (
          <button
            key={item}
            className={`flex h-8 w-full cursor-pointer items-center gap-3 rounded-r-full px-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              label === item
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => onLabel(item)}
            type="button"
          >
            <Tag className="size-4" />
            <span>{item}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MailToolbar({
  selectedCount,
  allVisibleSelected,
  rangeText,
  page,
  totalPages,
  syncing,
  labels,
  onToggleVisible,
  onSelectAllMatching,
  onArchive,
  onTrash,
  onSpam,
  onRead,
  onUnread,
  onRefresh,
  onMove,
  onLabel,
  onSnooze,
  onPrev,
  onNext,
}: {
  selectedCount: number;
  allVisibleSelected: boolean;
  rangeText: string;
  page: number;
  totalPages: number;
  syncing: boolean;
  labels: string[];
  onToggleVisible: () => void;
  onSelectAllMatching: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onSpam: () => void;
  onRead: () => void;
  onUnread: () => void;
  onRefresh: () => void;
  onMove: (target: SystemLabel) => void;
  onLabel: (labels: string[]) => void;
  onSnooze: (until: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
      <Checkbox
        checked={allVisibleSelected}
        className="cursor-pointer"
        onCheckedChange={onToggleVisible}
      />
      {selectedCount > 0 ? (
        <>
          <span className="ml-2 text-sm font-medium">{selectedCount} selected</span>
          <ToolbarButton label="Archive" icon={Archive} onClick={onArchive} />
          <ToolbarButton label="Report spam" icon={ShieldAlert} onClick={onSpam} />
          <ToolbarButton label="Delete" icon={Trash2} onClick={onTrash} />
          <ToolbarButton label="Mark read" icon={Mail} onClick={onRead} />
          <ToolbarButton label="Mark unread" icon={Mail} onClick={onUnread} />
          <MoveToMenu onMove={onMove} />
          <LabelMenu labels={labels} onApply={onLabel} />
          <SnoozeMenu onSnooze={onSnooze} />
          <MoreMailActionsMenu
            items={[
              { label: "Select all matching conversations", onSelect: onSelectAllMatching },
              { label: "Remove from Snoozed", onSelect: () => onSnooze("") },
            ]}
          />
        </>
      ) : (
        <>
          <ToolbarButton
            label="Refresh"
            icon={syncing ? CalendarClock : Mail}
            onClick={onRefresh}
          />
        </>
      )}
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span>{rangeText}</span>
        <Button variant="ghost" size="icon-sm" disabled={page <= 1} onClick={onPrev}>
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={page >= totalPages} onClick={onNext}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function ConversationList({
  items,
  selectedIds,
  folder,
  activeEmail,
  onOpenConversation,
  onOpenDraft,
  onSelect,
  onStar,
  onImportant,
  onArchive,
  onTrash,
  onRead,
  onSnooze,
}: {
  items: ListItem[];
  selectedIds: Set<string>;
  folder: Folder;
  activeEmail: string;
  onOpenConversation: (id: string) => void;
  onOpenDraft: (id: string) => void;
  onSelect: (id: string) => void;
  onStar: (id: string) => void;
  onImportant: (id: string) => void;
  onArchive: (id: string) => void;
  onTrash: (id: string) => void;
  onRead: (id: string, read: boolean) => void;
  onSnooze: (id: string) => void;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      {items.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Mail className="size-10" />
          <p>No messages found</p>
        </div>
      ) : (
        items.map((item) =>
          item.type === "draft" ? (
            <DraftRow key={item.id} draft={item.draft} onOpen={() => onOpenDraft(item.id)} />
          ) : (
            <ConversationRow
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              folder={folder}
              activeEmail={activeEmail}
              onOpen={() => onOpenConversation(item.id)}
              onSelect={() => onSelect(item.id)}
              onStar={() => onStar(item.id)}
              onImportant={() => onImportant(item.id)}
              onArchive={() => onArchive(item.id)}
              onTrash={() => onTrash(item.id)}
              onRead={(read) => onRead(item.id, read)}
              onSnooze={() => onSnooze(item.id)}
            />
          ),
        )
      )}
    </ScrollArea>
  );
}

function DraftRow({ draft, onOpen }: { draft: Draft; onOpen: () => void }) {
  return (
    <button
      className="grid w-full cursor-pointer grid-cols-[2rem_minmax(8rem,12rem)_1fr_auto] items-center gap-2 border-b bg-muted/30 px-3 py-2 text-left hover:bg-muted"
      onClick={onOpen}
      type="button"
    >
      <Pencil className="size-4 text-red-600" />
      <span className="font-semibold text-red-600">Draft</span>
      <span className="truncate">
        {draft.subject || "(no subject)"}
        <span className="font-normal text-muted-foreground">
          {" "}
          - {draft.body || "No draft body"}
        </span>
      </span>
      <span className="text-xs text-muted-foreground">Draft</span>
    </button>
  );
}

function ConversationRow({
  item,
  selected,
  folder,
  activeEmail,
  onOpen,
  onSelect,
  onStar,
  onImportant,
  onArchive,
  onTrash,
  onRead,
  onSnooze,
}: {
  item: Extract<ListItem, { type: "conversation" }>;
  selected: boolean;
  folder: Folder;
  activeEmail: string;
  onOpen: () => void;
  onSelect: () => void;
  onStar: () => void;
  onImportant: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onRead: (read: boolean) => void;
  onSnooze: () => void;
}) {
  const { conversation, latestMessage, messages } = item;
  const senderText =
    folder === "sent" || latestMessage.from.email === activeEmail
      ? `To: ${formatRecipients(latestMessage.to)}`
      : latestMessage.from.name;
  const unread = conversation.unreadCount > 0;

  return (
    <div
      className={`group grid w-full cursor-pointer grid-cols-[2rem_2rem_2rem_minmax(8rem,12rem)_1fr_auto] items-center gap-2 border-b px-3 py-2 text-left transition-colors hover:relative hover:z-10 hover:bg-muted hover:shadow-sm focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:grid-cols-[2rem_2rem_1fr_auto] ${
        unread ? "bg-muted/40 font-semibold" : "bg-background"
      }`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <span onClick={(event) => event.stopPropagation()}>
        <Checkbox checked={selected} className="cursor-pointer" onCheckedChange={onSelect} />
      </span>
      <IconToggle
        active={conversation.starred}
        activeClass="fill-yellow-400 text-yellow-500"
        label="Star"
        icon={Star}
        onClick={onStar}
      />
      <IconToggle
        active={conversation.important}
        activeClass="fill-amber-400 text-amber-500"
        label="Important"
        icon={Tag}
        onClick={onImportant}
      />
      <span className="truncate max-md:hidden">{senderText}</span>
      <span className="min-w-0 truncate">
        <span>{conversation.subject}</span>
        {messages.length > 1 && (
          <span className="ml-1 text-muted-foreground">({messages.length})</span>
        )}
        <span className="font-normal text-muted-foreground"> - {latestMessage.body}</span>
        {conversation.userLabels.map((label) => (
          <Badge key={label} variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">
            {label}
          </Badge>
        ))}
      </span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {conversation.attachmentCount > 0 && <Paperclip className="size-3.5" />}
        <span className="group-hover:hidden">{latestMessage.time}</span>
        <span className="hidden gap-1 group-hover:flex">
          <RowAction icon={Archive} label="Archive" onClick={onArchive} />
          <RowAction icon={Trash2} label="Trash" onClick={onTrash} />
          <RowAction
            icon={Mail}
            label={unread ? "Mark read" : "Mark unread"}
            onClick={() => onRead(unread)}
          />
          <RowAction icon={CalendarClock} label="Snooze" onClick={onSnooze} />
        </span>
      </span>
    </div>
  );
}

function ConversationDetail({
  conversation,
  messages,
  labels,
  onBack,
  onAction,
  onStar,
  onImportant,
  onLabel,
  onRemoveLabel,
  onMove,
  onSnooze,
  onRespond,
}: {
  conversation: Conversation;
  messages: Message[];
  labels: string[];
  onBack: () => void;
  onAction: (action: MailAction) => void;
  onStar: () => void;
  onImportant: () => void;
  onLabel: (labels: string[]) => void;
  onRemoveLabel: (label: string) => void;
  onMove: (target: SystemLabel) => void;
  onSnooze: (until: string) => void;
  onRespond: (message: Message, mode: DraftMode) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
        <Button variant="ghost" size="icon-sm" className="cursor-pointer" onClick={onBack}>
          <ChevronLeft />
        </Button>
        <ToolbarButton label="Archive" icon={Archive} onClick={() => onAction("archive")} />
        <ToolbarButton label="Delete" icon={Trash2} onClick={() => onAction("trash")} />
        <ToolbarButton label="Report spam" icon={ShieldAlert} onClick={() => onAction("spam")} />
        <MoveToMenu onMove={onMove} />
        <LabelMenu labels={labels} onApply={onLabel} />
        <SnoozeMenu onSnooze={onSnooze} />
        <MoreMailActionsMenu
          items={[
            {
              label: conversation.unreadCount > 0 ? "Mark as read" : "Mark as unread",
              onSelect: () => onAction(conversation.unreadCount > 0 ? "read" : "unread"),
            },
            { label: "Restore to inbox", onSelect: () => onAction("restore") },
            { label: "Not spam", onSelect: () => onAction("notSpam") },
            { label: "Delete forever", onSelect: () => onAction("deleteForever") },
          ]}
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <article className="p-6">
          <h1 className="text-xl font-normal tracking-normal">{conversation.subject}</h1>
          <div className="mt-3 flex flex-wrap gap-1">
            {conversation.userLabels.map((label) => (
              <button key={label} onClick={() => onRemoveLabel(label)} type="button">
                <Badge variant="secondary" className="cursor-pointer">
                  {label}
                  <X className="size-3" />
                </Badge>
              </button>
            ))}
          </div>
          <div className="mt-6 space-y-5">
            {messages.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                conversation={conversation}
                onStar={onStar}
                onImportant={onImportant}
                onReply={() => onRespond(message, "reply")}
                onReplyAll={() => onRespond(message, "replyAll")}
                onForward={() => onRespond(message, "forward")}
              />
            ))}
          </div>
        </article>
      </ScrollArea>
    </div>
  );
}

function MessageCard({
  message,
  conversation,
  onStar,
  onImportant,
  onReply,
  onReplyAll,
  onForward,
}: {
  message: Message;
  conversation: Conversation;
  onStar: () => void;
  onImportant: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
}) {
  return (
    <section className="rounded-xl border bg-background p-4 shadow-xs">
      <div className="flex gap-3">
        <Avatar>
          <AvatarFallback>{getInitials(message.from.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">{message.from.name}</div>
              <div className="text-xs text-muted-foreground">
                {message.from.email} to {formatRecipients(message.to)}
                {message.cc.length > 0 && `, cc ${formatRecipients(message.cc)}`}
                {message.bcc.length > 0 && `, bcc ${formatRecipients(message.bcc)}`}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {message.date}, {message.time}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <IconToggle
              active={conversation.starred}
              activeClass="fill-yellow-400 text-yellow-500"
              label="Star"
              icon={Star}
              onClick={onStar}
            />
            <IconToggle
              active={conversation.important}
              activeClass="fill-amber-400 text-amber-500"
              label="Important"
              icon={Tag}
              onClick={onImportant}
            />
            <ToolbarButton label="Reply" icon={Reply} onClick={onReply} />
            <ToolbarButton label="Reply all" icon={ReplyAll} onClick={onReplyAll} />
            <ToolbarButton label="Forward" icon={Forward} onClick={onForward} />
          </div>
          <div className="mt-4 whitespace-pre-line leading-7">{message.body}</div>
          <AttachmentList attachments={message.attachments} />
        </div>
      </div>
    </section>
  );
}

function ComposeWindow({
  draft,
  onClose,
  onSent,
}: {
  draft: Draft;
  onClose: () => void;
  onSent: () => void;
}) {
  const updateDraft = useGmailMailStore((state) => state.updateDraft);
  const discardDraft = useGmailMailStore((state) => state.discardDraft);
  const sendDraft = useGmailMailStore((state) => state.sendDraft);
  const addAttachment = useGmailMailStore((state) => state.addDraftAttachment);
  const removeAttachment = useGmailMailStore((state) => state.removeDraftAttachment);

  const [localSubject, setLocalSubject] = useState(draft.subject);
  const [localBody, setLocalBody] = useState(draft.body);

  function updateRecipients(field: "to" | "cc" | "bcc", value: string) {
    updateDraft(draft.id, { [field]: parseRecipients(value) });
  }

  return (
    <div
      className={`fixed right-4 bottom-0 z-40 w-[min(38rem,calc(100vw-2rem))] overflow-hidden rounded-t-lg border bg-background shadow-2xl ${
        draft.minimized ? "h-11" : "h-128 max-h-[calc(100vh-6rem)]"
      }`}
    >
      <div className="flex h-11 items-center justify-between bg-foreground px-3 text-sm font-medium text-background">
        <span>
          {draft.mode === "compose"
            ? "New Message"
            : draft.mode === "forward"
              ? "Forward"
              : "Reply"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            className="cursor-pointer text-background hover:bg-background/15"
            onClick={() => updateDraft(draft.id, { minimized: !draft.minimized })}
          >
            <ChevronRight className="size-3 rotate-90" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="cursor-pointer text-background hover:bg-background/15"
            onClick={onClose}
          >
            <X className="size-3" />
          </Button>
        </div>
      </div>
      {!draft.minimized && (
        <div className="flex h-[calc(100%-2.75rem)] flex-col">
          <div className="flex h-9 items-center gap-2 border-b px-3 text-xs text-muted-foreground">
            <span className="w-8">From</span>
            <span className="truncate text-foreground">
              {draft.from.name} &lt;{draft.from.email}&gt;
            </span>
          </div>
          <RecipientLine
            label="To"
            value={formatRecipients(draft.to)}
            onChange={(value) => updateRecipients("to", value)}
          />
          <RecipientLine
            label="Cc"
            value={formatRecipients(draft.cc)}
            onChange={(value) => updateRecipients("cc", value)}
          />
          <RecipientLine
            label="Bcc"
            value={formatRecipients(draft.bcc)}
            onChange={(value) => updateRecipients("bcc", value)}
          />
          <Input
            className="rounded-none border-0 shadow-none focus-visible:ring-0"
            placeholder="Subject"
            value={localSubject}
            onChange={(event) => setLocalSubject(event.target.value)}
            onBlur={() => updateDraft(draft.id, { subject: localSubject })}
          />
          <Textarea
            className="min-h-0 flex-1 resize-none rounded-none border-0 shadow-none focus-visible:ring-0"
            value={localBody}
            onChange={(event) => setLocalBody(event.target.value)}
            onBlur={() => updateDraft(draft.id, { body: localBody })}
          />
          <AttachmentList
            attachments={draft.attachments}
            onRemove={(id) => removeAttachment(draft.id, id)}
          />
          <div className="flex h-12 items-center gap-1 border-t px-3">
            <Button
              className="h-8 cursor-pointer rounded-full bg-blue-600 px-5 hover:bg-blue-700"
              onClick={() => {
                updateDraft(draft.id, { subject: localSubject, body: localBody });
                sendDraft(draft.id);
                onSent();
              }}
            >
              Send
            </Button>
            {[Bold, Italic, Underline].map((Icon, index) => (
              <Button key={index} variant="ghost" size="icon-sm" className="cursor-pointer">
                <Icon />
              </Button>
            ))}
            <Button
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              onClick={() => addAttachment(draft.id)}
            >
              <Paperclip />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto cursor-pointer"
              onClick={() => {
                discardDraft(draft.id);
                onClose();
              }}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RecipientLine({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex h-9 items-center gap-2 border-b px-3">
      <span className="w-8 text-xs text-muted-foreground">{label}</span>
      <Input
        className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function AttachmentList({
  attachments,
  onRemove,
}: {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <Badge key={attachment.id} variant="outline" className="h-8 gap-2 rounded-md">
          <Paperclip className="size-3.5" />
          {attachment.name}
          <span className="text-muted-foreground">{attachment.size}</span>
          {onRemove && (
            <button
              className="cursor-pointer"
              onClick={() => onRemove(attachment.id)}
              type="button"
            >
              <X className="size-3" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Archive;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="cursor-pointer" onClick={onClick}>
            <Icon />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function RowAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Archive;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="rounded p-1 hover:bg-background"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      type="button"
    >
      <Icon className="size-4" />
    </button>
  );
}

function IconToggle({
  active,
  activeClass,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  activeClass: string;
  label: string;
  icon: typeof Star;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      className="cursor-pointer"
      variant="ghost"
      size="icon-sm"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon className={`size-4 ${active ? activeClass : "text-muted-foreground"}`} />
    </Button>
  );
}

function MoveToMenu({ onMove }: { onMove: (target: SystemLabel) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="cursor-pointer">
            <Inbox />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-44">
        {(["inbox", "sent", "spam", "trash"] as SystemLabel[]).map((target) => (
          <DropdownMenuItem
            key={target}
            className="cursor-pointer capitalize"
            onClick={() => onMove(target)}
          >
            {target}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LabelMenu({ labels, onApply }: { labels: string[]; onApply: (labels: string[]) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="cursor-pointer">
            <Tag />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-44">
        {labels.map((label) => (
          <DropdownMenuItem key={label} className="cursor-pointer" onClick={() => onApply([label])}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SnoozeMenu({ onSnooze }: { onSnooze: (until: string) => void }) {
  const options = [
    ["Later today", 6 * 60 * 60 * 1000],
    ["Tomorrow", 24 * 60 * 60 * 1000],
    ["Next week", 7 * 24 * 60 * 60 * 1000],
  ] as const;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="cursor-pointer">
            <CalendarClock />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-44">
        {options.map(([label, ms]) => (
          <DropdownMenuItem
            key={label}
            className="cursor-pointer"
            onClick={() => onSnooze(new Date(Date.now() + ms).toISOString())}
          >
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => onSnooze(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())}
        >
          Custom: 3 days
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreMailActionsMenu({ items }: { items: Array<{ label: string; onSelect: () => void }> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="cursor-pointer">
            <MoreVertical />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} className="cursor-pointer" onClick={item.onSelect}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
