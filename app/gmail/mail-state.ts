import { create } from "zustand";
import type { LucideIcon } from "lucide-react";
import { AlertOctagon, Archive, Clock, Inbox, Pencil, Send, Star, Tag, Trash2 } from "lucide-react";

import { appUsers, userToRecipient } from "@/lib/users";
import { useUserStore } from "@/lib/stores/user-store";
import { loadSeedRoutePage, type SeedCard } from "@/lib/seed-data";
import { usePatchStore, getGlobalPatchesForApp, type AppPatch } from "@/lib/stores/patch-store";

export type Folder =
  "inbox" | "sent" | "drafts" | "spam" | "trash" | "starred" | "snoozed" | "important" | "all";
export type SystemLabel = "inbox" | "sent" | "drafts" | "spam" | "trash";
export type DraftMode = "compose" | "reply" | "replyAll" | "forward";
export type MailAction =
  | "archive"
  | "trash"
  | "restore"
  | "spam"
  | "notSpam"
  | "deleteForever"
  | "read"
  | "unread"
  | "star"
  | "unstar"
  | "important"
  | "notImportant"
  | "unsnooze";

export type Recipient = {
  name: string;
  email: string;
};

export type Attachment = {
  id: string;
  name: string;
  type: string;
  size: string;
  sampleUrl: string;
};

export type Message = {
  id: string;
  conversationId: string;
  from: Recipient;
  to: Recipient[];
  cc: Recipient[];
  bcc: Recipient[];
  body: string;
  date: string;
  time: string;
  timestamp: number;
  attachments: Attachment[];
  read: boolean;
  sentByMe: boolean;
};

export type Conversation = {
  id: string;
  subject: string;
  messageIds: string[];
  systemLabels: SystemLabel[];
  userLabels: string[];
  starred: boolean;
  important: boolean;
  snoozedUntil: string | null;
  lastMessageAt: number;
  unreadCount: number;
  attachmentCount: number;
};

export type Draft = {
  id: string;
  conversationId: string | null;
  mode: DraftMode;
  from: Recipient;
  to: Recipient[];
  cc: Recipient[];
  bcc: Recipient[];
  subject: string;
  body: string;
  attachments: Attachment[];
  minimized: boolean;
};

export type MailSnapshot = {
  conversations: Record<string, Conversation>;
  messages: Record<string, Message>;
  drafts: Record<string, Draft>;
};

export type MailFolderItem = {
  key: Folder;
  label: string;
  icon: LucideIcon;
};

export type SearchFilters = {
  text: string[];
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  label?: string;
  in?: Folder;
  is?: "read" | "unread" | "starred";
  has?: "attachment";
};

export type UndoState = {
  label: string;
  snapshot: MailSnapshot;
} | null;

export const PAGE_SIZE = 50;
export function getCurrentUser(): Recipient {
  const activeUserId = useUserStore.getState().activeUserId;
  const user = appUsers.find((user) => user.id === activeUserId) ?? appUsers[0];
  return userToRecipient(user);
}
export const userLabels = ["Finance", "Team", "Product", "Travel", "Legal", "Customers"];

export const folders: MailFolderItem[] = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "starred", label: "Starred", icon: Star },
  { key: "snoozed", label: "Snoozed", icon: Clock },
  { key: "important", label: "Important", icon: Tag },
  { key: "sent", label: "Sent", icon: Send },
  { key: "drafts", label: "Drafts", icon: Pencil },
  { key: "spam", label: "Spam", icon: AlertOctagon },
  { key: "trash", label: "Trash", icon: Trash2 },
  { key: "all", label: "All Mail", icon: Archive },
];

function firstRecipientFromValue(value: unknown, fallback: Recipient): Recipient {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return parseRecipients(value)[0] ?? fallback;
}

export function parseRecipients(value: string): Recipient[] {
  return value
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.*)<(.+)>$/);
      if (match) return { name: match[1].trim(), email: match[2].trim() };
      return { name: entry.split("@")[0] || entry, email: entry };
    });
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

export function formatRecipients(recipients: Recipient[]) {
  return recipients.map((recipient) => recipient.email).join(", ");
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function makeSampleAttachment(seed: string, index = 0): Attachment {
  const extension = index % 3 === 0 ? "pdf" : index % 3 === 1 ? "docx" : "png";
  return {
    id: `att-${seed}-${index}`,
    name: `${seed}-brief.${extension}`,
    type: extension.toUpperCase(),
    size: `${120 + index * 48} KB`,
    sampleUrl: "#",
  };
}

export function parseSearchQuery(query: string): SearchFilters {
  const filters: SearchFilters = { text: [] };
  const tokens = query.match(/"[^"]+"|\S+/g) ?? [];

  tokens.forEach((rawToken) => {
    const token = rawToken.replace(/^"|"$/g, "");
    const [key, ...rest] = token.split(":");
    const value = rest.join(":");

    if (!value) {
      filters.text.push(token.toLowerCase());
      return;
    }

    const lowerValue = value.toLowerCase();
    if (key === "from") filters.from = lowerValue;
    else if (key === "to") filters.to = lowerValue;
    else if (key === "cc") filters.cc = lowerValue;
    else if (key === "bcc") filters.bcc = lowerValue;
    else if (key === "subject") filters.subject = lowerValue;
    else if (key === "label") filters.label = lowerValue;
    else if (key === "in") filters.in = lowerValue as Folder;
    else if (key === "is" && ["read", "unread", "starred"].includes(lowerValue)) {
      filters.is = lowerValue as SearchFilters["is"];
    } else if (key === "has" && lowerValue === "attachment") {
      filters.has = "attachment";
    } else {
      filters.text.push(token.toLowerCase());
    }
  });

  return filters;
}

function makeMessage({
  id,
  conversationId,
  from,
  to,
  cc = [],
  bcc = [],
  subject,
  body,
  timestamp,
  attachments = [],
  read,
  sentByMe,
}: {
  id: string;
  conversationId: string;
  from: Recipient;
  to: Recipient[];
  cc?: Recipient[];
  bcc?: Recipient[];
  subject: string;
  body: string;
  timestamp: number;
  attachments?: Attachment[];
  read: boolean;
  sentByMe: boolean;
}): Message {
  void subject;
  const date = new Date(timestamp);
  return {
    id,
    conversationId,
    from,
    to,
    cc,
    bcc,
    body,
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    timestamp,
    attachments,
    read,
    sentByMe,
  };
}

function makeConversationFromMessages({
  id,
  subject,
  messages,
  systemLabels,
  userLabels: labels,
  starred,
  important,
  snoozedUntil = null,
}: {
  id: string;
  subject: string;
  messages: Message[];
  systemLabels: SystemLabel[];
  userLabels: string[];
  starred: boolean;
  important: boolean;
  snoozedUntil?: string | null;
}): Conversation {
  return {
    id,
    subject,
    messageIds: messages.map((message) => message.id),
    systemLabels,
    userLabels: labels,
    starred,
    important,
    snoozedUntil,
    lastMessageAt: Math.max(...messages.map((message) => message.timestamp)),
    unreadCount: messages.filter((message) => !message.read && !message.sentByMe).length,
    attachmentCount: messages.reduce((sum, message) => sum + message.attachments.length, 0),
  };
}

function stableNumber(seed: string, modulo: number) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % modulo;
}

function extractHeader(message: string, key: "from" | "to" | "cc" | "bcc") {
  return message.match(new RegExp(`^${key}:\\s*(.+)$`, "im"))?.[1] ?? "";
}

function messageBlocks(card: SeedCard) {
  const blocks = card.text
    .split(/\n(?=From:\s)/g)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.length > 0 ? blocks : [card.text];
}

function attachmentFromName(name: string, index: number): Attachment {
  const extension = name.split(".").pop()?.toUpperCase() || "FILE";
  return {
    id: `att-${index}-${name}`,
    name,
    type: extension,
    size: `${120 + index * 32} KB`,
    sampleUrl: "#",
  };
}

function cardToThread(card: SeedCard, activeUser: Recipient) {
  const messages = messageBlocks(card).map((block, index) => {
    const from = firstRecipientFromValue(extractHeader(block, "from"), activeUser);
    const to = parseRecipients(extractHeader(block, "to"));
    const cc = parseRecipients(extractHeader(block, "cc"));
    const bcc = parseRecipients(extractHeader(block, "bcc"));
    const timestamp = card.occurredAt + index * 23 * 60 * 1000;
    const body = block.replace(/^.+:\s.*$/gim, "").trim() || card.text;
    const attachments = card.links
      .filter((link) => /\.[a-z0-9]{2,5}$/i.test(link) || link.toLowerCase().includes("attachment"))
      .slice(0, 3)
      .map((name, i) => attachmentFromName(name, i));

    return makeMessage({
      id: `${card.id}:msg-${index + 1}`,
      conversationId: card.id,
      from,
      to: to.length > 0 ? to : [activeUser],
      cc,
      bcc,
      subject: card.title,
      body,
      timestamp,
      attachments,
      read: stableNumber(`${card.id}:${index}`, 4) !== 0,
      sentByMe: sameMailbox(from.email, activeUser.email),
    });
  });

  const systemLabels: SystemLabel[] = messages.some((m) => m.sentByMe) ? ["sent"] : ["inbox"];
  const conversation = makeConversationFromMessages({
    id: card.id,
    subject: card.title,
    messages,
    systemLabels,
    userLabels: card.tags.slice(0, 3),
    starred: stableNumber(card.id, 7) === 0,
    important: stableNumber(card.id, 3) === 0,
    snoozedUntil:
      stableNumber(card.id, 13) === 0
        ? new Date(card.occurredAt + 3 * 24 * 60 * 60 * 1000).toISOString()
        : null,
  });

  return { conversation, messages };
}

function buildInitialSnapshot(cards: SeedCard[] = []): MailSnapshot {
  const conversations: Record<string, Conversation> = {};
  const messages: Record<string, Message> = {};
  const drafts: Record<string, Draft> = {};

  if (cards.length > 0) {
    const activeUser = getCurrentUser();
    for (const card of cards) {
      const thread = cardToThread(card, activeUser);
      conversations[thread.conversation.id] = thread.conversation;
      for (const msg of thread.messages) messages[msg.id] = msg;
    }
  }

  return { conversations, messages, drafts };
}

function cloneSnapshot(snapshot: MailSnapshot): MailSnapshot {
  return {
    conversations: structuredClone(snapshot.conversations),
    messages: structuredClone(snapshot.messages),
    drafts: structuredClone(snapshot.drafts),
  };
}

function without<T>(items: T[], value: T) {
  return items.filter((item) => item !== value);
}

function withUnique<T>(items: T[], value: T) {
  return items.includes(value) ? items : [...items, value];
}

function recomputeConversation(
  conversation: Conversation,
  messages: Record<string, Message>,
): Conversation {
  const conversationMessages = conversation.messageIds.map((id) => messages[id]).filter(Boolean);
  return {
    ...conversation,
    lastMessageAt: Math.max(...conversationMessages.map((message) => message.timestamp), 0),
    unreadCount: conversationMessages.filter((message) => !message.read && !message.sentByMe)
      .length,
    attachmentCount: conversationMessages.reduce(
      (sum, message) => sum + message.attachments.length,
      0,
    ),
  };
}

function prepareUndo(state: GmailMailState, label: string): UndoState {
  return {
    label,
    snapshot: cloneSnapshot({
      conversations: state.conversations,
      messages: state.messages,
      drafts: state.drafts,
    }),
  };
}

function applyToConversations(
  state: GmailMailState,
  ids: Iterable<string>,
  updater: (conversation: Conversation) => Conversation | null,
) {
  const nextConversations = { ...state.conversations };
  Array.from(ids).forEach((id) => {
    const conversation = nextConversations[id];
    if (!conversation) return;
    const next = updater(conversation);
    if (next) nextConversations[id] = recomputeConversation(next, state.messages);
    else delete nextConversations[id];
  });
  return nextConversations;
}

function createMessageFromDraft({
  id,
  conversationId,
  draft,
  subject,
  body,
  timestamp = Date.now(),
}: {
  id: string;
  conversationId: string;
  draft: Draft;
  subject: string;
  body: string;
  timestamp?: number;
}): Message {
  return makeMessage({
    id,
    conversationId,
    from: draft.from,
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    subject,
    body,
    timestamp,
    attachments: draft.attachments,
    read: true,
    sentByMe: true,
  });
}

function makeConversationDraftSubject(mode: DraftMode, subject: string) {
  if (mode === "reply" || mode === "replyAll")
    return subject.startsWith("Re:") ? subject : `Re: ${subject}`;
  if (mode === "forward") return subject.startsWith("Fwd:") ? subject : `Fwd: ${subject}`;
  return subject;
}

export type GmailMailState = MailSnapshot & {
  labels: string[];
  undoState: UndoState;
  loadCorpusPage: (page?: number) => Promise<void>;
  createDraft: (input?: Partial<Draft>) => string;
  updateDraft: (id: string, patch: Partial<Omit<Draft, "id">>) => void;
  discardDraft: (id: string) => void;
  sendDraft: (id: string) => void;
  startResponseDraft: (
    conversationId: string,
    messageId: string,
    mode: DraftMode,
    from?: Recipient,
  ) => string;
  addDraftAttachment: (draftId: string) => void;
  removeDraftAttachment: (draftId: string, attachmentId: string) => void;
  mutateConversations: (ids: Iterable<string>, action: MailAction) => void;
  markRead: (ids: Iterable<string>, read: boolean) => void;
  toggleStar: (id: string) => void;
  toggleImportant: (id: string) => void;
  addLabels: (ids: Iterable<string>, labels: string[]) => void;
  removeLabel: (ids: Iterable<string>, label: string) => void;
  moveTo: (ids: Iterable<string>, target: SystemLabel | "inbox") => void;
  snooze: (ids: Iterable<string>, until: string) => void;
  undo: () => void;
  clearUndo: () => void;
};

const initialSnapshot = buildInitialSnapshot();

function recordPatch(
  op: AppPatch["op"],
  scope: string,
  targetId: string,
  payload: Record<string, unknown>,
) {
  usePatchStore.getState().appendPatch({
    app: "gmail",
    op,
    scope,
    targetId,
    actorId: useUserStore.getState().activeUserId || "unknown",
    payload,
  });
}

function applyPatch(state: GmailMailState, patch: AppPatch) {
  // Replay patches on top of seed data
  if (patch.scope === "gmail.draft") {
    if (patch.op === "create") {
      const draft = patch.payload as Draft;
      state.drafts[draft.id] = draft;
    } else if (patch.op === "update") {
      if (state.drafts[patch.targetId]) {
        state.drafts[patch.targetId] = { ...state.drafts[patch.targetId], ...patch.payload };
      }
    } else if (patch.op === "delete") {
      delete state.drafts[patch.targetId];
    }
  } else if (patch.scope === "gmail.sent" && patch.op === "create") {
    const draft = state.drafts[patch.targetId];
    if (draft) {
      const conversationId = draft.conversationId ?? `conv-new-${patch.targetId}`;
      const subject = draft.subject || "(no subject)";
      const message = createMessageFromDraft({
        id: `msg-${patch.targetId}`,
        conversationId,
        draft,
        subject,
        body: draft.body || "No message body",
      });
      state.messages[message.id] = message;
      if (state.conversations[conversationId]) {
        state.conversations[conversationId] = recomputeConversation(
          {
            ...state.conversations[conversationId],
            subject: state.conversations[conversationId].subject || subject,
            messageIds: [...state.conversations[conversationId].messageIds, message.id],
            systemLabels: withUnique(state.conversations[conversationId].systemLabels, "sent"),
          },
          state.messages,
        );
      } else {
        state.conversations[conversationId] = makeConversationFromMessages({
          id: conversationId,
          subject,
          messages: [message],
          systemLabels: ["sent"],
          userLabels: [],
          starred: false,
          important: false,
        });
      }
      delete state.drafts[patch.targetId];
    }
  } else if (patch.scope === "gmail.conversation" && patch.op === "update") {
    const conversation = state.conversations[patch.targetId];
    if (conversation) {
      if (patch.payload.toggleStar) conversation.starred = !conversation.starred;
      if (patch.payload.toggleImportant) conversation.important = !conversation.important;
      if (patch.payload.systemLabels)
        conversation.systemLabels = patch.payload.systemLabels as SystemLabel[];
      if (patch.payload.snoozedUntil !== undefined)
        conversation.snoozedUntil = patch.payload.snoozedUntil as string | null;
    }
  } else if (patch.scope === "gmail.labels" && patch.op === "update") {
    const conversation = state.conversations[patch.targetId];
    if (conversation) {
      if (patch.payload.add) {
        conversation.userLabels = Array.from(
          new Set([...conversation.userLabels, ...(patch.payload.add as string[])]),
        );
      }
      if (patch.payload.remove) {
        conversation.userLabels = without(conversation.userLabels, patch.payload.remove as string);
      }
    }
  } else if (patch.scope === "gmail.messages" && patch.op === "update") {
    const message = state.messages[patch.targetId];
    if (message) message.read = patch.payload.read as boolean;
  }
}

export const useGmailMailStore = create<GmailMailState>((set, get) => ({
  ...initialSnapshot,
  labels: [...userLabels, "Follow up", "Important"],
  undoState: null,

  loadCorpusPage: async (page = 1) => {
    const activeUserId = useUserStore.getState().activeUserId;
    if (!activeUserId) return;
    const cards = await loadSeedRoutePage(`users/${activeUserId}/gmail`, page);
    const snapshot = buildInitialSnapshot(cards);

    const stateWithPatches = cloneSnapshot(snapshot) as GmailMailState;
    const patches = getGlobalPatchesForApp("gmail");
    patches.forEach((patch) => applyPatch(stateWithPatches, patch));

    set((state) => ({
      conversations: { ...state.conversations, ...stateWithPatches.conversations },
      messages: { ...state.messages, ...stateWithPatches.messages },
      drafts: { ...state.drafts, ...stateWithPatches.drafts },
    }));
  },

  createDraft: (input) => {
    const newId = input?.id ?? `draft-${Date.now()}`;
    recordPatch("create", "gmail.draft", newId, input ?? {});
    const id = input?.id ?? `draft-${Date.now()}`;
    set((state) => ({
      drafts: {
        ...state.drafts,
        [id]: {
          id,
          conversationId: input?.conversationId ?? null,
          mode: input?.mode ?? "compose",
          from: input?.from ?? getCurrentUser(),
          to: input?.to ?? [],
          cc: input?.cc ?? [],
          bcc: input?.bcc ?? [],
          subject: input?.subject ?? "",
          body: input?.body ?? "",
          attachments: input?.attachments ?? [],
          minimized: input?.minimized ?? false,
        },
      },
    }));
    return id;
  },

  updateDraft: (id, patch) => {
    recordPatch("update", "gmail.draft", id, patch);
    set((state) => {
      const draft = state.drafts[id];
      if (!draft) return state;
      return { drafts: { ...state.drafts, [id]: { ...draft, ...patch } } };
    });
  },

  discardDraft: (id) => {
    recordPatch("delete", "gmail.draft", id, {});
    set((state) => {
      const nextDrafts = { ...state.drafts };
      delete nextDrafts[id];
      return { drafts: nextDrafts };
    });
  },

  sendDraft: (id) => {
    recordPatch("create", "gmail.sent", id, { draftId: id });
    set((state) => {
      const draft = state.drafts[id];
      if (!draft) return state;
      const undoState = prepareUndo(state, "send");
      const conversations = { ...state.conversations };
      const messages = { ...state.messages };
      const drafts = { ...state.drafts };
      const conversationId = draft.conversationId ?? `conv-new-${Date.now()}`;
      const subject = makeConversationDraftSubject(draft.mode, draft.subject || "(no subject)");
      const message = createMessageFromDraft({
        id: `msg-${Date.now()}`,
        conversationId,
        draft,
        subject,
        body: draft.body || "No message body",
      });

      messages[message.id] = message;
      if (conversations[conversationId]) {
        conversations[conversationId] = recomputeConversation(
          {
            ...conversations[conversationId],
            subject: conversations[conversationId].subject || subject,
            messageIds: [...conversations[conversationId].messageIds, message.id],
            systemLabels: withUnique(conversations[conversationId].systemLabels, "sent"),
          },
          messages,
        );
      } else {
        conversations[conversationId] = makeConversationFromMessages({
          id: conversationId,
          subject,
          messages: [message],
          systemLabels: ["sent"],
          userLabels: [],
          starred: false,
          important: false,
        });
      }

      delete drafts[id];
      return { conversations, messages, drafts, undoState };
    });
  },

  startResponseDraft: (conversationId, messageId, mode, from = getCurrentUser()) => {
    const state = get();
    const conversation = state.conversations[conversationId];
    const message = state.messages[messageId];
    const id = `draft-${Date.now()}`;
    if (!conversation || !message) return id;

    const to =
      mode === "forward"
        ? []
        : mode === "replyAll"
          ? [message.from, ...message.to, ...message.cc].filter(
              (recipient, index, recipients) =>
                recipient.email !== from.email &&
                recipients.findIndex((item) => item.email === recipient.email) === index,
            )
          : [message.from].filter((recipient) => recipient.email !== from.email);
    const body =
      mode === "forward"
        ? `\n\nForwarded message\nFrom: ${message.from.name} <${message.from.email}>\nTo: ${formatRecipients(message.to)}\nDate: ${message.date}, ${message.time}\n\n${message.body}`
        : "";

    get().createDraft({
      id,
      conversationId,
      mode,
      to,
      cc: [],
      bcc: [],
      from,
      subject: makeConversationDraftSubject(mode, conversation.subject),
      body,
      attachments: mode === "forward" ? message.attachments : [],
    });
    return id;
  },

  addDraftAttachment: (draftId) => {
    const draft = get().drafts[draftId];
    if (!draft) return;
    get().updateDraft(draftId, {
      attachments: [
        ...draft.attachments,
        makeSampleAttachment("attachment", draft.attachments.length),
      ],
    });
  },

  removeDraftAttachment: (draftId, attachmentId) => {
    const draft = get().drafts[draftId];
    if (!draft) return;
    get().updateDraft(draftId, {
      attachments: draft.attachments.filter((attachment) => attachment.id !== attachmentId),
    });
  },

  mutateConversations: (ids, action) => {
    set((state) => {
      const undoState = prepareUndo(state, action);
      const idList = Array.from(ids);
      const messages = { ...state.messages };
      let conversations = { ...state.conversations };

      if (action === "deleteForever") {
        idList.forEach((id) => {
          conversations[id]?.messageIds.forEach((messageId) => delete messages[messageId]);
          delete conversations[id];
        });
        return { conversations, messages, undoState };
      }

      conversations = applyToConversations(state, idList, (conversation) => {
        if (action === "archive")
          return { ...conversation, systemLabels: without(conversation.systemLabels, "inbox") };
        if (action === "trash") return { ...conversation, systemLabels: ["trash"] };
        if (action === "restore") return { ...conversation, systemLabels: ["inbox"] };
        if (action === "spam") return { ...conversation, systemLabels: ["spam"] };
        if (action === "notSpam") return { ...conversation, systemLabels: ["inbox"] };
        if (action === "star") return { ...conversation, starred: true };
        if (action === "unstar") return { ...conversation, starred: false };
        if (action === "important") return { ...conversation, important: true };
        if (action === "notImportant") return { ...conversation, important: false };
        if (action === "unsnooze") return { ...conversation, snoozedUntil: null };
        return conversation;
      });

      if (action === "read" || action === "unread") {
        idList.forEach((id) => {
          state.conversations[id]?.messageIds.forEach((messageId) => {
            messages[messageId] = { ...messages[messageId], read: action === "read" };
          });
        });
        conversations = applyToConversations(
          { ...state, messages },
          idList,
          (conversation) => conversation,
        );
      }

      return { conversations, messages, undoState };
    });
  },

  markRead: (ids, read) => {
    Array.from(ids).forEach((id) => recordPatch("update", "gmail.messages", id, { read }));
    set((state) => {
      const undoState = prepareUndo(state, read ? "mark read" : "mark unread");
      const messages = { ...state.messages };
      const idList = Array.from(ids);
      idList.forEach((id) => {
        state.conversations[id]?.messageIds.forEach((messageId) => {
          messages[messageId] = { ...messages[messageId], read };
        });
      });
      return {
        messages,
        conversations: applyToConversations(
          { ...state, messages },
          idList,
          (conversation) => conversation,
        ),
        undoState,
      };
    });
  },

  toggleStar: (id) => {
    recordPatch("update", "gmail.conversation", id, { toggleStar: true });
    const conversation = get().conversations[id];
    if (!conversation) return;
    get().mutateConversations([id], conversation.starred ? "unstar" : "star");
  },

  toggleImportant: (id) => {
    recordPatch("update", "gmail.conversation", id, { toggleImportant: true });
    const conversation = get().conversations[id];
    if (!conversation) return;
    get().mutateConversations([id], conversation.important ? "notImportant" : "important");
  },

  addLabels: (ids, labels) => {
    Array.from(ids).forEach((id) => recordPatch("update", "gmail.labels", id, { add: labels }));
    set((state) => {
      const undoState = prepareUndo(state, "label");
      const conversations = applyToConversations(state, ids, (conversation) => ({
        ...conversation,
        userLabels: Array.from(new Set([...conversation.userLabels, ...labels])),
      }));
      return {
        conversations,
        labels: Array.from(new Set([...state.labels, ...labels])),
        undoState,
      };
    });
  },

  removeLabel: (ids, label) => {
    Array.from(ids).forEach((id) => recordPatch("update", "gmail.labels", id, { remove: label }));
    set((state) => ({
      conversations: applyToConversations(state, ids, (conversation) => ({
        ...conversation,
        userLabels: without(conversation.userLabels, label),
      })),
      undoState: prepareUndo(state, "remove label"),
    }));
  },

  moveTo: (ids, target) => {
    Array.from(ids).forEach((id) =>
      recordPatch("update", "gmail.conversation", id, { systemLabels: [target] }),
    );
    set((state) => ({
      conversations: applyToConversations(state, ids, (conversation) => ({
        ...conversation,
        systemLabels: target === "inbox" ? ["inbox"] : [target],
      })),
      undoState: prepareUndo(state, "move"),
    }));
  },

  snooze: (ids, until) => {
    Array.from(ids).forEach((id) =>
      recordPatch("update", "gmail.conversation", id, { snoozedUntil: until, systemLabels: [] }),
    );
    set((state) => ({
      conversations: applyToConversations(state, ids, (conversation) => ({
        ...conversation,
        snoozedUntil: until,
        systemLabels: without(conversation.systemLabels, "inbox"),
      })),
      undoState: prepareUndo(state, "snooze"),
    }));
  },

  undo: () => {
    const undoState = get().undoState;
    if (!undoState) return;
    set({ ...cloneSnapshot(undoState.snapshot), undoState: null });
  },

  clearUndo: () => set({ undoState: null }),
}));

usePatchStore.subscribe((state, prevState) => {
  if (state.batches === prevState.batches) return;
  const newBatches = state.batches.filter((b) => !prevState.batches.includes(b));
  if (newBatches.length === 0) return;

  const newPatches = newBatches.flatMap((b) => b.patches).filter((p) => p.app === "gmail");
  if (newPatches.length === 0) return;

  useGmailMailStore.setState((draftState) => {
    const nextState = cloneSnapshot(draftState) as GmailMailState;
    newPatches.forEach((patch) => applyPatch(nextState, patch));
    return nextState;
  });
});
