"use client";

import { create } from "zustand";

import { appUsers } from "@/lib/users";
import {
  activeCorpusUserIds,
  corpusEventsFor,
  corpusNormalizedRecords,
  corpusText,
  corpusUserIdFromName,
  loadCorpusEventsFor,
} from "@/lib/corpus-app-data";

export type SlackAttachment = {
  id: string;
  name: string;
  type: string;
  size: string;
};

export type SlackReaction = {
  emoji: string;
  userIds: string[];
};

export type SlackChannel = {
  id: string;
  name: string;
  description: string;
  topic: string;
  memberIds: string[];
  starredBy: string[];
};

export type SlackDm = {
  id: string;
  participantIds: string[];
};

export type SlackMessage = {
  id: string;
  surfaceId: string;
  surfaceType: "channel" | "dm";
  threadParentId: string | null;
  authorId: string;
  body: string;
  timestamp: number;
  edited: boolean;
  deleted: boolean;
  readBy: string[];
  reactions: SlackReaction[];
  attachments: SlackAttachment[];
};

export type SlackSnapshot = {
  channels: Record<string, SlackChannel>;
  dms: Record<string, SlackDm>;
  messages: Record<string, SlackMessage>;
};

export type SlackState = SlackSnapshot & {
  loadCorpusPage: (page?: number) => Promise<number>;
  sendMessage: (input: {
    surfaceType: "channel" | "dm";
    surfaceId: string;
    authorId: string;
    body: string;
    threadParentId?: string | null;
    attachments?: SlackAttachment[];
  }) => string;
  editMessage: (id: string, userId: string, body: string) => void;
  deleteMessage: (id: string, userId: string) => void;
  toggleReaction: (id: string, userId: string, emoji: string) => void;
  markSurfaceRead: (surfaceId: string, userId: string) => void;
  makeAttachment: (seed: string) => SlackAttachment;
  createChannel: (name: string, description: string, topic: string, creatorId: string) => string;
  createDm: (participantIds: string[]) => string;
  updateChannelTopic: (channelId: string, topic: string, userId: string) => void;
  addChannelMembers: (channelId: string, memberIds: string[], userId: string) => void;
};

function makeId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function canAuthorPost(
  snapshot: SlackSnapshot,
  input: { surfaceType: "channel" | "dm"; surfaceId: string; userId: string },
) {
  if (input.surfaceType === "channel") {
    return Boolean(snapshot.channels[input.surfaceId]?.memberIds.includes(input.userId));
  }
  return Boolean(snapshot.dms[input.surfaceId]?.participantIds.includes(input.userId));
}

function makeAttachment(seed: string): SlackAttachment {
  const index = Math.abs(seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0));
  const extension = ["pdf", "png", "fig", "csv"][index % 4];
  return {
    id: `slack-att-${seed}-${index}`,
    name: `${seed.replace(/\s+/g, "-").toLowerCase()}.${extension}`,
    type: extension.toUpperCase(),
    size: `${120 + (index % 9) * 35} KB`,
  };
}

function buildInitialSnapshot(corpusThreads = corpusEventsFor("slack")): SlackSnapshot {
  if (corpusThreads.length > 0) {
    const channels: Record<string, SlackChannel> = {};
    const messages: Record<string, SlackMessage> = {};
    const memberIds = Array.from(
      new Set([...activeCorpusUserIds(), ...appUsers.slice(0, 8).map((u) => u.id)]),
    );

    const dmUsers = memberIds.slice(0, 4);
    const dms = Object.fromEntries(
      dmUsers
        .slice(1)
        .map((userId) => [
          `dm-${dmUsers[0]}-${userId}`,
          { id: `dm-${dmUsers[0]}-${userId}`, participantIds: [dmUsers[0], userId] },
        ]),
    );

    corpusThreads.forEach((event, index) => {
      const isDm = index % 8 === 0;
      const surfaceType = isDm ? "dm" : "channel";
      const channelName = event.title.match(/^#([^:]+):/)?.[1] ?? "all-hands";
      const dmId = `dm-${dmUsers[0]}-${dmUsers[(index % 3) + 1]}`;
      const surfaceId = isDm ? dmId : channelName;

      if (!isDm && !channels[channelName]) {
        channels[channelName] = {
          id: channelName,
          name: channelName,
          description: `Redwood ${channelName} activity from the enterprise corpus.`,
          topic: "Customer signals, decisions, and implementation follow-through",
          memberIds,
          starredBy: memberIds.slice(0, 3),
        };
      }

      const parentId = event.sourceEntityId;
      const threadMessages = corpusNormalizedRecords(event, "messages");
      const visibleMessages =
        threadMessages.length > 0
          ? threadMessages
          : [{ id: "turn-1", author: event.actorId, body: corpusText(event, 1800) }];

      visibleMessages.forEach((threadMessage, messageIndex) => {
        const messageId = messageIndex === 0 ? parentId : `${parentId}-reply-${messageIndex}`;
        const author =
          typeof threadMessage.author === "string" && threadMessage.author.trim()
            ? threadMessage.author
            : event.actorId;
        const body =
          typeof threadMessage.body === "string" && threadMessage.body.trim()
            ? threadMessage.body
            : corpusText(event, 1800);

        messages[messageId] = {
          id: messageId,
          surfaceId,
          surfaceType,
          threadParentId: messageIndex === 0 ? null : parentId,
          authorId: corpusUserIdFromName(author, event.actorId),
          body,
          timestamp: event.occurredAt + messageIndex * 7 * 60 * 1000,
          edited: false,
          deleted: false,
          readBy: memberIds.filter((_, memberIndex) => memberIndex % 4 !== index % 4),
          reactions:
            messageIndex === 0 && index % 2 === 0
              ? [{ emoji: index % 3 === 0 ? "✅" : "👀", userIds: memberIds.slice(0, 3) }]
              : [],
          attachments:
            messageIndex === 0 && index % 5 === 0 ? [makeAttachment(event.sourceEntityId)] : [],
        };
      });
    });

    return { channels, dms, messages };
  }

  return { channels: {}, dms: {}, messages: {} };
}

export function userName(userId: string) {
  return appUsers.find((user) => user.id === userId)?.name ?? "Unknown User";
}

export function userInitials(userId: string) {
  return appUsers.find((user) => user.id === userId)?.initials ?? "??";
}

export function userColor(userId: string) {
  return appUsers.find((user) => user.id === userId)?.color ?? "bg-muted text-muted-foreground";
}

export function formatSlackTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dmTitle(dm: SlackDm, activeUserId: string) {
  return dm.participantIds
    .filter((id) => id !== activeUserId)
    .map(userName)
    .join(", ");
}

export function canAccessSurface(
  snapshot: SlackSnapshot,
  input: { surfaceType: "channel" | "dm"; surfaceId: string; userId: string },
) {
  return canAuthorPost(snapshot, input);
}

const initialSnapshot = buildInitialSnapshot();

export const useSlackStore = create<SlackState>((set, get) => ({
  ...initialSnapshot,

  loadCorpusPage: async (page = 1) => {
    const events = await loadCorpusEventsFor("slack", page);
    const snapshot = buildInitialSnapshot(events);
    set((state) => ({
      channels: { ...state.channels, ...snapshot.channels },
      dms: { ...state.dms, ...snapshot.dms },
      messages: { ...state.messages, ...snapshot.messages },
    }));
    return events.length;
  },

  createChannel: (name, description, topic, creatorId) => {
    const id = makeId("slack-channel");
    set((state) => ({
      channels: {
        ...state.channels,
        [id]: {
          id,
          name: name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-"),
          description: description.trim(),
          topic: topic.trim(),
          memberIds: [creatorId],
          starredBy: [],
        },
      },
    }));
    return id;
  },

  createDm: (participantIds) => {
    const id = makeId("slack-dm");
    set((state) => ({
      dms: {
        ...state.dms,
        [id]: { id, participantIds },
      },
    }));
    return id;
  },

  updateChannelTopic: (channelId, topic, userId) => {
    set((state) => {
      const channel = state.channels[channelId];
      if (!channel || !channel.memberIds.includes(userId)) return state;
      return {
        channels: {
          ...state.channels,
          [channelId]: { ...channel, topic: topic.trim() },
        },
      };
    });
  },

  addChannelMembers: (channelId, memberIds, userId) => {
    set((state) => {
      const channel = state.channels[channelId];
      if (!channel || !channel.memberIds.includes(userId)) return state;
      const newMemberIds = Array.from(new Set([...channel.memberIds, ...memberIds]));
      return {
        channels: {
          ...state.channels,
          [channelId]: { ...channel, memberIds: newMemberIds },
        },
      };
    });
  },

  sendMessage: ({
    surfaceType,
    surfaceId,
    authorId,
    body,
    threadParentId = null,
    attachments = [],
  }) => {
    const trimmedBody = body.trim();
    if (!trimmedBody && attachments.length === 0) return "";

    const state = get();
    if (!canAuthorPost(state, { surfaceType, surfaceId, userId: authorId })) return "";

    const latestSurfaceTimestamp = Math.max(
      0,
      ...Object.values(state.messages)
        .filter((message) => {
          if (message.surfaceId !== surfaceId || message.surfaceType !== surfaceType) return false;
          if (!threadParentId) return true;
          return message.id === threadParentId || message.threadParentId === threadParentId;
        })
        .map((message) => message.timestamp),
    );
    const timestamp = Math.max(Date.now(), latestSurfaceTimestamp + 60 * 1000);
    const id = makeId("slack-msg");
    set((state) => ({
      messages: {
        ...state.messages,
        [id]: {
          id,
          surfaceId,
          surfaceType,
          threadParentId,
          authorId,
          body: trimmedBody,
          timestamp,
          edited: false,
          deleted: false,
          readBy: [authorId],
          reactions: [],
          attachments,
        },
      },
    }));
    return id;
  },

  editMessage: (id, userId, body) => {
    set((state) => {
      const message = state.messages[id];
      if (!message || message.authorId !== userId || message.deleted) return state;
      return {
        messages: {
          ...state.messages,
          [id]: { ...message, body: body.trim(), edited: true },
        },
      };
    });
  },

  deleteMessage: (id, userId) => {
    set((state) => {
      const message = state.messages[id];
      if (!message || message.authorId !== userId) return state;
      return {
        messages: {
          ...state.messages,
          [id]: { ...message, body: "This message was deleted.", deleted: true, reactions: [] },
        },
      };
    });
  },

  toggleReaction: (id, userId, emoji) => {
    set((state) => {
      const message = state.messages[id];
      if (!message || message.deleted) return state;
      const reactions = [...message.reactions];
      const existingIndex = reactions.findIndex((reaction) => reaction.emoji === emoji);
      if (existingIndex >= 0) {
        const reaction = reactions[existingIndex];
        const hasUser = reaction.userIds.includes(userId);
        reactions[existingIndex] = {
          ...reaction,
          userIds: hasUser
            ? reaction.userIds.filter((id) => id !== userId)
            : [...reaction.userIds, userId],
        };
      } else {
        reactions.push({ emoji, userIds: [userId] });
      }
      return {
        messages: {
          ...state.messages,
          [id]: { ...message, reactions: reactions.filter((reaction) => reaction.userIds.length) },
        },
      };
    });
  },

  markSurfaceRead: (surfaceId, userId) => {
    set((state) => {
      const messages = { ...state.messages };
      Object.values(messages).forEach((message) => {
        if (message.surfaceId !== surfaceId || message.readBy.includes(userId)) return;
        messages[message.id] = { ...message, readBy: [...message.readBy, userId] };
      });
      return { messages };
    });
  },

  makeAttachment,
}));
