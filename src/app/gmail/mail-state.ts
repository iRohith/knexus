import { create } from "zustand";
import type { LucideIcon } from "lucide-react";
import { AlertOctagon, Archive, Clock, Inbox, Pencil, Send, Star, Tag, Trash2 } from "lucide-react";

import { appUsers, defaultUser, userToRecipient } from "@/lib/users";

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
  mockUrl: string;
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
export const CURRENT_USER: Recipient = userToRecipient(defaultUser);
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

const externalContacts: Recipient[] = [
  { name: "Maya Chen", email: "maya.chen@northstar.example" },
  { name: "Ari Patel", email: "ari@linear.example" },
  { name: "GitHub", email: "notifications@github.example" },
  { name: "Google Workspace", email: "workspace-noreply@example.com" },
  { name: "HubSpot", email: "updates@hubspot.example" },
  { name: "Nora Williams", email: "nora@corp.example" },
  { name: "Jira", email: "jira@atlassian.example" },
  { name: "Slack", email: "feedback@slack.example" },
  { name: "Fireflies", email: "notes@fireflies.example" },
  { name: "Confluence", email: "updates@confluence.example" },
];

const contacts: Recipient[] = [...appUsers.map(userToRecipient), ...externalContacts];

const subjects = [
  "Q3 planning notes and follow ups",
  "Invoice ready for review",
  "Security alert for connected app",
  "Weekly product digest",
  "Contract redlines from legal",
  "Design review agenda",
  "Build failed on main",
  "Meeting transcript is ready",
  "Customer expansion opportunity",
  "Shared drive access request",
];

const snippets = [
  "Here is the latest context before the working session starts.",
  "Please take a look when you have a window today.",
  "The team left comments and two open questions for you.",
  "This includes the revised scope, dates, and owner list.",
  "No action is needed unless the details look off.",
];

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

export function makeMockAttachment(seed: string, index = 0): Attachment {
  const extension = index % 3 === 0 ? "pdf" : index % 3 === 1 ? "docx" : "png";
  return {
    id: `att-${seed}-${index}`,
    name: `${seed}-brief.${extension}`,
    type: extension.toUpperCase(),
    size: `${120 + index * 48} KB`,
    mockUrl: "#",
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

function buildInitialSnapshot(): MailSnapshot {
  const conversations: Record<string, Conversation> = {};
  const messages: Record<string, Message> = {};
  const drafts: Record<string, Draft> = {};
  const now = Date.UTC(2026, 6, 1, 12, 0);

  for (let index = 0; index < 286; index += 1) {
    const id = `conv-${index + 1}`;
    const mailboxUser = userToRecipient(appUsers[index % appUsers.length]);
    const otherUser = userToRecipient(appUsers[(index + 1) % appUsers.length]);
    const externalSender = externalContacts[index % externalContacts.length];
    const sender = index % 4 === 0 ? otherUser : externalSender;
    const subject = subjects[index % subjects.length];
    const label = userLabels[index % userLabels.length];
    const baseTime = now - index * 60 * 60 * 1000;
    const count = index % 7 === 0 ? 3 : index % 11 === 0 ? 2 : 1;
    const systemLabels: SystemLabel[] =
      index % 31 === 0 ? ["spam"] : index % 29 === 0 ? ["trash"] : ["inbox"];
    const threadMessages = Array.from({ length: count }, (_, messageIndex) => {
      const sentByMailboxUser = messageIndex % 2 === 1;
      const message = makeMessage({
        id: `${id}-msg-${messageIndex + 1}`,
        conversationId: id,
        from: sentByMailboxUser ? mailboxUser : sender,
        to: sentByMailboxUser ? [sender] : [mailboxUser],
        cc:
          messageIndex === 0 && index % 5 === 0
            ? [userToRecipient(appUsers[(index + 2) % appUsers.length])]
            : [],
        subject,
        body: sentByMailboxUser
          ? `Thanks for sending this over.\n\nI reviewed the ${label.toLowerCase()} details and added a few notes. Please confirm the owner list before the wider share.`
          : `Hi,\n\n${snippets[(index + messageIndex) % snippets.length]} The notes cover decisions, owners, risks, and the next checkpoint.\n\nThanks,\n${sender.name}`,
        timestamp: baseTime + messageIndex * 18 * 60 * 1000,
        attachments:
          messageIndex === 0 && index % 6 === 0
            ? [makeMockAttachment(label.toLowerCase(), index % 3)]
            : [],
        read: index % 4 !== 0 || sentByMailboxUser,
        sentByMe: sentByMailboxUser,
      });
      messages[message.id] = message;
      return message;
    });

    conversations[id] = makeConversationFromMessages({
      id,
      subject,
      messages: threadMessages,
      systemLabels,
      userLabels: index % 3 === 0 ? [label] : index % 5 === 0 ? [label, "Important"] : [],
      starred: index % 9 === 0,
      important: index % 5 === 0,
      snoozedUntil: index % 13 === 0 ? new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString() : null,
    });
  }

  for (let index = 0; index < 64; index += 1) {
    const id = `sent-conv-${index + 1}`;
    const sender = userToRecipient(appUsers[index % appUsers.length]);
    const recipient =
      index % 5 === 0
        ? userToRecipient(appUsers[(index + 1) % appUsers.length])
        : externalContacts[index % externalContacts.length];
    const subject = subjects[(index + 3) % subjects.length];
    const message = makeMessage({
      id: `${id}-msg-1`,
      conversationId: id,
      from: sender,
      to: [recipient],
      subject,
      body: `Sharing the promised follow up with context, action items, and owners.\n\nBest,\n${sender.name}`,
      timestamp: now - (index + 320) * 45 * 60 * 1000,
      attachments: index % 8 === 0 ? [makeMockAttachment("proposal", index % 3)] : [],
      read: true,
      sentByMe: true,
    });
    messages[message.id] = message;
    conversations[id] = makeConversationFromMessages({
      id,
      subject,
      messages: [message],
      systemLabels: ["sent"],
      userLabels: index % 4 === 0 ? ["Follow up"] : [],
      starred: index % 11 === 0,
      important: index % 6 === 0,
    });
  }

  const draftConversation = conversations["conv-2"];
  if (draftConversation) {
    const draftId = "draft-1";
    drafts[draftId] = {
      id: draftId,
      conversationId: draftConversation.id,
      mode: "reply",
      from: CURRENT_USER,
      to: [contacts[1]],
      cc: [],
      bcc: [],
      subject: `Re: ${draftConversation.subject}`,
      body: "Draft reply with the latest numbers attached.",
      attachments: [makeMockAttachment("draft", 0)],
      minimized: false,
    };
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

export const useGmailMailStore = create<GmailMailState>((set, get) => ({
  ...initialSnapshot,
  labels: [...userLabels, "Follow up", "Important"],
  undoState: null,

  createDraft: (input) => {
    const id = input?.id ?? `draft-${Date.now()}`;
    set((state) => ({
      drafts: {
        ...state.drafts,
        [id]: {
          id,
          conversationId: input?.conversationId ?? null,
          mode: input?.mode ?? "compose",
          from: input?.from ?? CURRENT_USER,
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
    set((state) => {
      const draft = state.drafts[id];
      if (!draft) return state;
      return { drafts: { ...state.drafts, [id]: { ...draft, ...patch } } };
    });
  },

  discardDraft: (id) => {
    set((state) => {
      const nextDrafts = { ...state.drafts };
      delete nextDrafts[id];
      return { drafts: nextDrafts };
    });
  },

  sendDraft: (id) => {
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

  startResponseDraft: (conversationId, messageId, mode, from = CURRENT_USER) => {
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
        makeMockAttachment("attachment", draft.attachments.length),
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
    const conversation = get().conversations[id];
    if (!conversation) return;
    get().mutateConversations([id], conversation.starred ? "unstar" : "star");
  },

  toggleImportant: (id) => {
    const conversation = get().conversations[id];
    if (!conversation) return;
    get().mutateConversations([id], conversation.important ? "notImportant" : "important");
  },

  addLabels: (ids, labels) => {
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
    set((state) => ({
      conversations: applyToConversations(state, ids, (conversation) => ({
        ...conversation,
        userLabels: without(conversation.userLabels, label),
      })),
      undoState: prepareUndo(state, "remove label"),
    }));
  },

  moveTo: (ids, target) => {
    set((state) => ({
      conversations: applyToConversations(state, ids, (conversation) => ({
        ...conversation,
        systemLabels: target === "inbox" ? ["inbox"] : [target],
      })),
      undoState: prepareUndo(state, "move"),
    }));
  },

  snooze: (ids, until) => {
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
