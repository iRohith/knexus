"use client";

import { create } from "zustand";

import { appUsers } from "@/lib/users";

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

const channelSeeds: SlackChannel[] = [
  {
    id: "team-updates",
    name: "team-updates",
    description: "Announcements, weekly goals, and launch notes.",
    topic: "Product launches, planning updates, and decision logs",
    memberIds: ["riley", "maya", "ari"],
    starredBy: ["riley", "maya"],
  },
  {
    id: "design-review",
    name: "design-review",
    description: "UX critiques and implementation handoff.",
    topic: "Review flows before engineering picks them up",
    memberIds: ["riley", "maya"],
    starredBy: ["maya"],
  },
  {
    id: "engineering",
    name: "engineering",
    description: "Builds, incidents, code review, and platform work.",
    topic: "Keep main green and unblock launches",
    memberIds: ["riley", "ari"],
    starredBy: ["ari"],
  },
  {
    id: "customer-room",
    name: "customer-room",
    description: "Customer escalations and expansion notes.",
    topic: "High-priority customer follow-up",
    memberIds: ["maya", "ari"],
    starredBy: [],
  },
];

const bodies = [
  "Morning update: the inbox polish pass is ready for review. I left notes on keyboard focus and empty states.",
  "Can someone sanity-check the launch checklist before standup?",
  "The customer call surfaced two follow-ups: permissions audit and export copy.",
  "I pushed a fixture update so account switching has more realistic cross-user activity.",
  "Heads up, the prototype now keeps detail views URL-backed without leaking stale state.",
  "The board looks clean. Only blocker is attachment preview copy.",
  "I added a short decision log to keep the thread readable later.",
  "This is good to ship after one more mobile pass.",
];

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

function buildInitialSnapshot(): SlackSnapshot {
  const channels = Object.fromEntries(channelSeeds.map((channel) => [channel.id, channel]));
  const dms: Record<string, SlackDm> = {
    "dm-riley-maya": { id: "dm-riley-maya", participantIds: ["riley", "maya"] },
    "dm-riley-ari": { id: "dm-riley-ari", participantIds: ["riley", "ari"] },
    "dm-maya-ari": { id: "dm-maya-ari", participantIds: ["maya", "ari"] },
  };
  const messages: Record<string, SlackMessage> = {};
  const now = Date.UTC(2026, 6, 2, 9, 0);
  let counter = 1;

  channelSeeds.forEach((channel, channelIndex) => {
    for (let index = 0; index < 14; index += 1) {
      const authorId = channel.memberIds[(index + channelIndex) % channel.memberIds.length];
      const id = `slack-msg-${counter}`;
      counter += 1;
      messages[id] = {
        id,
        surfaceId: channel.id,
        surfaceType: "channel",
        threadParentId: null,
        authorId,
        body: bodies[(index + channelIndex) % bodies.length],
        timestamp: now - (channelIndex * 20 + index) * 19 * 60 * 1000,
        edited: index % 9 === 0,
        deleted: false,
        readBy: index % 5 === 0 ? [authorId] : [...channel.memberIds],
        reactions:
          index % 3 === 0
            ? [{ emoji: index % 2 === 0 ? "✅" : "👀", userIds: channel.memberIds.slice(0, 2) }]
            : [],
        attachments: index % 6 === 0 ? [makeAttachment(`${channel.name}-${index}`)] : [],
      };

      if (index % 5 === 0) {
        const replyId = `slack-msg-${counter}`;
        counter += 1;
        messages[replyId] = {
          id: replyId,
          surfaceId: channel.id,
          surfaceType: "channel",
          threadParentId: id,
          authorId: channel.memberIds[(index + 1) % channel.memberIds.length],
          body: "Thread follow-up: I added the context and a concrete next step.",
          timestamp: messages[id].timestamp + 6 * 60 * 1000,
          edited: false,
          deleted: false,
          readBy: [...channel.memberIds],
          reactions: [],
          attachments: [],
        };
      }
    }
  });

  Object.values(dms).forEach((dm, dmIndex) => {
    for (let index = 0; index < 10; index += 1) {
      const authorId = dm.participantIds[index % 2];
      const id = `slack-msg-${counter}`;
      counter += 1;
      messages[id] = {
        id,
        surfaceId: dm.id,
        surfaceType: "dm",
        threadParentId: null,
        authorId,
        body:
          index % 3 === 0
            ? "Quick sync: I sent you the latest mock data notes."
            : bodies[(index + dmIndex + 2) % bodies.length],
        timestamp: now - (dmIndex * 16 + index) * 23 * 60 * 1000,
        edited: false,
        deleted: false,
        readBy: index % 4 === 0 ? [authorId] : [...dm.participantIds],
        reactions: index % 4 === 0 ? [{ emoji: "🙌", userIds: [dm.participantIds[1]] }] : [],
        attachments: index % 7 === 0 ? [makeAttachment(`dm-${dm.id}-${index}`)] : [],
      };
    }
  });

  return { channels, dms, messages };
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
