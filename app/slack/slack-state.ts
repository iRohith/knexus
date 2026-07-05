"use client";

import { create } from "zustand";
import { appUsers } from "@/lib/users";
import { SeedCard, loadAppCorpus } from "@/lib/seed-data";
import { usePatchStore, getGlobalPatchesForApp, type AppPatch } from "@/lib/stores/patch-store";
import { useUserStore } from "@/lib/stores/user-store";

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
  loadCorpusPage: () => Promise<number>;
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

function buildInitialSnapshot(cards: SeedCard[] = []): SlackSnapshot {
  if (cards.length > 0) {
    const channels: Record<string, SlackChannel> = {};
    const messages: Record<string, SlackMessage> = {};
    const memberIds = appUsers.map((u) => u.id);

    const dmUsers = memberIds.slice(0, 4);
    const dms = Object.fromEntries(
      dmUsers
        .slice(1)
        .map((userId) => [
          `dm-${dmUsers[0]}-${userId}`,
          { id: `dm-${dmUsers[0]}-${userId}`, participantIds: [dmUsers[0], userId] },
        ]),
    );

    cards.forEach((card, index) => {
      const isDm = index % 8 === 0;
      const surfaceType = isDm ? "dm" : "channel";
      const channelName = card.title.match(/^#([^:]+):/)?.[1] ?? "all-hands";
      const dmId = `dm-${dmUsers[0]}-${dmUsers[(index % 3) + 1]}`;
      const surfaceId = isDm ? dmId : channelName;

      if (!isDm && !channels[channelName]) {
        channels[channelName] = {
          id: channelName,
          name: channelName,
          description: `Generated activity for ${channelName}`,
          topic: "Discussion and implementation follow-through",
          memberIds,
          starredBy: memberIds.slice(0, 3),
        };
      }

      const parentId = card.id;
      const threadMessages: string[] = [];
      const lines = card.text.split(/\n/);
      let currentMessage = "";

      lines.forEach((line) => {
        const isNewMessage =
          line.match(/^([A-Z][a-z]+ [A-Z][a-zA-Z']+):/) ||
          line.match(/^(incident-bot|github|system|pagerduty):/i);

        if (isNewMessage && currentMessage) {
          threadMessages.push(currentMessage.trim());
          currentMessage = line;
        } else {
          currentMessage += (currentMessage ? "\n" : "") + line;
        }
      });
      if (currentMessage) threadMessages.push(currentMessage.trim());

      const visibleMessages = threadMessages.filter((body) => {
        const match = body.match(/^([^:\n]+):\s*([\s\S]*)/);
        return match ? match[2].trim().length > 0 : body.trim().length > 0;
      });

      if (visibleMessages.length === 0) return;

      visibleMessages.forEach((body, messageIndex) => {
        const messageId = messageIndex === 0 ? parentId : `${parentId}-reply-${messageIndex}`;

        let author = card.peopleIds[0] ?? memberIds[0];
        let actualBody = body;
        const match = body.match(/^([^:\n]+):\s*([\s\S]*)/);
        if (match) {
          author =
            appUsers.find((u) => u.name.toLowerCase() === match[1].toLowerCase().trim())?.id ||
            match[1].trim();
          actualBody = match[2];
        }

        messages[messageId] = {
          id: messageId,
          surfaceId,
          surfaceType,
          threadParentId: messageIndex === 0 ? null : parentId,
          authorId: author,
          body: actualBody,
          timestamp: card.occurredAt + messageIndex * 7 * 60 * 1000,
          edited: false,
          deleted: false,
          readBy: memberIds.filter((_, memberIndex) => memberIndex % 4 !== index % 4),
          reactions:
            messageIndex === 0 && index % 2 === 0
              ? [{ emoji: index % 3 === 0 ? "✅" : "👀", userIds: memberIds.slice(0, 3) }]
              : [],
          attachments: messageIndex === 0 && index % 5 === 0 ? [makeAttachment(card.id)] : [],
        };
      });
    });

    return { channels, dms, messages };
  }

  return { channels: {}, dms: {}, messages: {} };
}

export function userName(userId: string) {
  return appUsers.find((user) => user.id === userId)?.name ?? userId;
}

export function userInitials(userId: string) {
  return appUsers.find((user) => user.id === userId)?.initials ?? userId.slice(0, 2).toUpperCase();
}

export function userColor(userId: string) {
  return appUsers.find((user) => user.id === userId)?.color ?? "bg-zinc-200 text-zinc-600";
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

export const useSlackStore = create<SlackState>()((set, get) => ({
  ...initialSnapshot,

  loadCorpusPage: async () => {
    const activeUserId = useUserStore.getState().activeUserId;
    if (!activeUserId) return 0;

    const cards = await loadAppCorpus("slack", activeUserId);
    const snapshot = buildInitialSnapshot(cards);

    const stateWithPatches = JSON.parse(JSON.stringify(snapshot)) as SlackSnapshot;
    const patches = getGlobalPatchesForApp("slack");
    patches.forEach((patch) => applyPatch(stateWithPatches, patch));

    set((state: SlackState) => ({
      channels: { ...state.channels, ...stateWithPatches.channels },
      dms: { ...state.dms, ...stateWithPatches.dms },
      messages: { ...state.messages, ...stateWithPatches.messages },
    }));
    return cards.length;
  },

  createChannel: (name: string, description: string, topic: string, creatorId: string): string => {
    const id = makeId("slack-channel");
    const channel: SlackChannel = {
      id,
      name: name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-"),
      description: description.trim(),
      topic: topic.trim(),
      memberIds: [creatorId],
      starredBy: [],
    };
    usePatchStore.getState().appendPatch({
      app: "slack",
      op: "create",
      scope: "slack.channel",
      targetId: id,
      actorId: creatorId,
      payload: channel as unknown as Record<string, unknown>,
    });
    set((state: SlackState) => ({ channels: { ...state.channels, [id]: channel } }));
    return id;
  },

  createDm: (participantIds: string[]): string => {
    const id = makeId("slack-dm");
    const dm: SlackDm = { id, participantIds };
    usePatchStore.getState().appendPatch({
      app: "slack",
      op: "create",
      scope: "slack.dm",
      targetId: id,
      actorId: participantIds[0],
      payload: dm as unknown as Record<string, unknown>,
    });
    set((state: SlackState) => ({ dms: { ...state.dms, [id]: dm } }));
    return id;
  },

  updateChannelTopic: (channelId: string, topic: string, userId: string): void => {
    usePatchStore.getState().appendPatch({
      app: "slack",
      op: "update",
      scope: "slack.channel",
      targetId: channelId,
      actorId: userId,
      payload: { topic: topic.trim() },
    });
    set((state: SlackState) => {
      const channel = state.channels[channelId];
      if (!channel || !channel.memberIds.includes(userId)) return state;
      return { channels: { ...state.channels, [channelId]: { ...channel, topic: topic.trim() } } };
    });
  },

  addChannelMembers: (channelId: string, memberIds: string[], userId: string): void => {
    set((state: SlackState) => {
      const channel = state.channels[channelId];
      if (!channel || !channel.memberIds.includes(userId)) return state;
      const newMemberIds = Array.from(new Set([...channel.memberIds, ...memberIds]));
      usePatchStore.getState().appendPatch({
        app: "slack",
        op: "update",
        scope: "slack.channel",
        targetId: channelId,
        actorId: userId,
        payload: { memberIds: newMemberIds },
      });
      return {
        channels: { ...state.channels, [channelId]: { ...channel, memberIds: newMemberIds } },
      };
    });
  },

  sendMessage: (input: {
    surfaceType: "channel" | "dm";
    surfaceId: string;
    authorId: string;
    body: string;
    threadParentId?: string | null;
    attachments?: SlackAttachment[];
  }): string => {
    const {
      surfaceType,
      surfaceId,
      authorId,
      body,
      threadParentId = null,
      attachments = [],
    } = input;
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
    const newMessage: SlackMessage = {
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
    };

    usePatchStore.getState().appendPatch({
      app: "slack",
      op: "create",
      scope: "slack.message",
      targetId: id,
      actorId: authorId,
      payload: newMessage as unknown as Record<string, unknown>,
    });

    set((state: SlackState) => ({ messages: { ...state.messages, [id]: newMessage } }));
    return id;
  },

  editMessage: (id: string, userId: string, body: string): void => {
    usePatchStore.getState().appendPatch({
      app: "slack",
      op: "update",
      scope: "slack.message",
      targetId: id,
      actorId: userId,
      payload: { body: body.trim(), edited: true },
    });
    set((state: SlackState) => {
      const message = state.messages[id];
      if (!message || message.authorId !== userId || message.deleted) return state;
      return {
        messages: { ...state.messages, [id]: { ...message, body: body.trim(), edited: true } },
      };
    });
  },

  deleteMessage: (id: string, userId: string): void => {
    usePatchStore.getState().appendPatch({
      app: "slack",
      op: "update",
      scope: "slack.message",
      targetId: id,
      actorId: userId,
      payload: { body: "This message was deleted.", deleted: true, reactions: [] },
    });
    set((state: SlackState) => {
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

  toggleReaction: (id: string, userId: string, emoji: string): void => {
    usePatchStore.getState().appendPatch({
      app: "slack",
      op: "update",
      scope: "slack.reaction",
      targetId: id,
      actorId: userId,
      payload: { emoji, userId },
    });
    set((state: SlackState) => {
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
          [id]: { ...message, reactions: reactions.filter((r) => r.userIds.length) },
        },
      };
    });
  },

  markSurfaceRead: (surfaceId: string, userId: string): void => {
    set((state: SlackState) => {
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

function applyPatch(state: SlackSnapshot, patch: AppPatch) {
  if (patch.scope === "slack.channel" && patch.op === "create") {
    const channel = patch.payload as SlackChannel;
    state.channels[channel.id] = channel;
  } else if (patch.scope === "slack.dm" && patch.op === "create") {
    const dm = patch.payload as SlackDm;
    state.dms[dm.id] = dm;
  } else if (patch.scope === "slack.channel" && patch.op === "update") {
    if (state.channels[patch.targetId]) {
      state.channels[patch.targetId] = { ...state.channels[patch.targetId], ...patch.payload };
    }
  } else if (patch.scope === "slack.message" && patch.op === "create") {
    const msg = patch.payload as SlackMessage;
    state.messages[msg.id] = msg;
  } else if (patch.scope === "slack.message" && patch.op === "update") {
    if (state.messages[patch.targetId]) {
      state.messages[patch.targetId] = { ...state.messages[patch.targetId], ...patch.payload };
    }
  } else if (patch.scope === "slack.reaction" && patch.op === "update") {
    if (state.messages[patch.targetId]) {
      const msg = state.messages[patch.targetId];
      const emoji = patch.payload.emoji as string;
      const userId = patch.payload.userId as string;
      const reactions = [...msg.reactions];
      const existingIndex = reactions.findIndex((r) => r.emoji === emoji);
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
      state.messages[patch.targetId] = {
        ...msg,
        reactions: reactions.filter((r) => r.userIds.length),
      };
    }
  }
}

usePatchStore.subscribe((state, prevState) => {
  if (state.batches === prevState.batches) return;
  const newBatches = state.batches.filter((b) => !prevState.batches.includes(b));
  if (newBatches.length === 0) return;
  const newPatches = newBatches.flatMap((b) => b.patches).filter((p) => p.app === "slack");
  if (newPatches.length === 0) return;

  useSlackStore.setState((draftState) => {
    const nextState = JSON.parse(JSON.stringify(draftState));
    newPatches.forEach((patch) => applyPatch(nextState, patch));
    return nextState;
  });
});
