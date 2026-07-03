import { create } from "zustand";
import type { LucideIcon } from "lucide-react";
import { AlertOctagon, Archive, Clock, Inbox, Pencil, Send, Star, Tag, Trash2 } from "lucide-react";

import { appUsers, defaultUser, userToRecipient } from "@/lib/users";
import { useUserStore } from "@/lib/user-store";
import {
  activeCorpusUserIds,
  actorEmail,
  actorName,
  corpusEventsFor,
  corpusLabels,
  corpusNormalizedRecords,
  corpusNormalizedStrings,
  corpusText,
  loadCorpusEventsFor,
  stableNumber,
} from "@/lib/corpus-app-data";

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
  const user = appUsers.find((user) => user.id === activeUserId) ?? defaultUser;
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

const contacts: Recipient[] = appUsers.map(userToRecipient);

function externalRecipientFromCorpus(body: string, fallbackSeed: string): Recipient {
  const matches = Array.from(body.matchAll(/([^<>\n;,]+?)\s*<([^<>\s]+@[^<>\s]+)>/g));
  const external = matches.find((match) => !match[2].includes("redwood"));
  if (external) {
    return {
      name: external[1].trim().replace(/^From:\s*/i, "") || external[2].split("@")[0],
      email: external[2].trim(),
    };
  }
  const domain = fallbackSeed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    name: "Customer Contact",
    email: `contact@${domain || "customer"}.example`,
  };
}

function firstRecipientFromValue(value: unknown, fallback: Recipient): Recipient {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return parseRecipients(value)[0] ?? fallback;
}

function recipientsFromValue(value: unknown): Recipient[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => (typeof item === "string" ? parseRecipients(item) : []));
  }
  return typeof value === "string" ? parseRecipients(value) : [];
}

function timestampFromEmailDate(value: unknown, fallback: number) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
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

function buildInitialSnapshot(corpusThreads = corpusEventsFor("gmail")): MailSnapshot {
  const conversations: Record<string, Conversation> = {};
  const messages: Record<string, Message> = {};
  const drafts: Record<string, Draft> = {};
  if (corpusThreads.length > 0) {
    const activeUserIds = activeCorpusUserIds();
    const activeRecipients = activeUserIds
      .flatMap((id) => {
        const user = appUsers.find((item) => item.id === id);
        return user ? [user] : [];
      })
      .map(userToRecipient);

    corpusThreads.forEach((event, index) => {
      const id = event.sourceEntityId;
      const actor = { name: actorName(event), email: actorEmail(event) };
      const supportingRecipients =
        activeRecipients.length > 0
          ? activeRecipients.filter((recipient) => recipient.email !== actor.email).slice(0, 4)
          : contacts.slice(0, 3);
      const customerSender = externalRecipientFromCorpus(event.body, event.title);
      const isSent = index % 5 === 0;
      const normalizedMessages = corpusNormalizedRecords(event, "messages");
      const eventAttachments = corpusNormalizedStrings(event, "attachments");
      const threadMessages = (
        normalizedMessages.length > 0
          ? normalizedMessages
          : [
              {
                id: "email-1",
                from: isSent ? `${actor.name} <${actor.email}>` : customerSender.email,
                to: isSent ? [customerSender.email] : [actor.email],
                cc: supportingRecipients.slice(0, 2).map((recipient) => recipient.email),
                body: corpusText(event, 2200),
                date: "",
              },
            ]
      ).map((emailMessage, messageIndex) => {
        const from = firstRecipientFromValue(
          emailMessage.from,
          messageIndex === 0 && !isSent ? customerSender : actor,
        );
        const to = recipientsFromValue(emailMessage.to);
        const cc = recipientsFromValue(emailMessage.cc);
        const bcc = recipientsFromValue(emailMessage.bcc);
        const attachmentNames = [
          ...(Array.isArray(emailMessage.attachments)
            ? emailMessage.attachments.filter(
                (attachment): attachment is string => typeof attachment === "string",
              )
            : []),
          ...eventAttachments,
        ];
        const message = makeMessage({
          id: `${id}-msg-${messageIndex + 1}`,
          conversationId: id,
          from,
          to: to.length > 0 ? to : isSent ? [customerSender] : [actor],
          cc,
          bcc,
          subject: event.title,
          body:
            typeof emailMessage.body === "string" && emailMessage.body.trim()
              ? emailMessage.body
              : corpusText(event, 2200),
          timestamp: timestampFromEmailDate(
            emailMessage.date,
            event.occurredAt + messageIndex * 34 * 60 * 1000,
          ),
          attachments:
            attachmentNames.length > 0 || stableNumber(`${event.id}-${messageIndex}`, 9) === 0
              ? [makeSampleAttachment(id, messageIndex)]
              : [],
          read: stableNumber(`${event.id}-${messageIndex}`, 3) !== 0,
          sentByMe:
            sameMailbox(from.email, getCurrentUser().email) || (isSent && messageIndex === 0),
        });
        messages[message.id] = message;
        return message;
      });

      const systemLabels: SystemLabel[] =
        stableNumber(event.id, 31) === 0
          ? ["spam"]
          : stableNumber(event.id, 29) === 0
            ? ["trash"]
            : isSent
              ? ["sent"]
              : ["inbox"];
      conversations[id] = makeConversationFromMessages({
        id,
        subject: event.title,
        messages: threadMessages,
        systemLabels,
        userLabels: corpusLabels(event, ["Customers"]).slice(0, 4),
        starred: stableNumber(event.id, 5) === 0,
        important: stableNumber(event.id, 3) === 0,
        snoozedUntil:
          stableNumber(event.id, 13) === 0
            ? new Date(event.occurredAt + 3 * 24 * 60 * 60 * 1000).toISOString()
            : null,
      });
    });

    const draftSource = Object.values(conversations).find((conversation) =>
      conversation.systemLabels.includes("inbox"),
    );
    if (draftSource) {
      drafts["draft-private-upgrade-followup"] = {
        id: "draft-private-upgrade-followup",
        conversationId: draftSource.id,
        mode: "reply",
        from: userToRecipient(defaultUser),
        to: contacts[0] ? [contacts[0]] : [],
        cc: activeRecipients.slice(0, 2),
        bcc: [],
        subject: `Re: ${draftSource.subject}`,
        body: "Drafting the follow-up with the latest evidence and owner list.",
        attachments: [makeSampleAttachment("redwood-draft", 0)],
        minimized: false,
      };
    }

    return { conversations, messages, drafts };
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

export const useGmailMailStore = create<GmailMailState>((set, get) => ({
  ...initialSnapshot,
  labels: [...userLabels, "Follow up", "Important"],
  undoState: null,

  loadCorpusPage: async (page = 1) => {
    const events = await loadCorpusEventsFor("gmail", page);
    const snapshot = buildInitialSnapshot(events);
    set((state) => ({
      conversations: { ...state.conversations, ...snapshot.conversations },
      messages: { ...state.messages, ...snapshot.messages },
      drafts: { ...state.drafts, ...snapshot.drafts },
    }));
  },

  createDraft: (input) => {
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
