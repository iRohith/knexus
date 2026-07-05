/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { create } from "zustand";

import { SeedCard, loadAppCorpus } from "@/lib/seed-data";
import { usePatchStore, getGlobalPatchesForApp } from "@/lib/stores/patch-store";
import { useUserStore } from "@/lib/stores/user-store";
import { appUsers } from "@/lib/users";

export type FirefliesView = "all" | "mine" | "shared" | "actions";

export type TranscriptLine = {
  id: string;
  speakerId: string;
  timestamp: string;
  text: string;
};

export type ActionItem = {
  id: string;
  ownerId: string;
  text: string;
  completed: boolean;
};

export type MeetingComment = {
  id: string;
  authorId: string;
  body: string;
  timestamp: number;
};

export type Meeting = {
  id: string;
  title: string;
  ownerId: string;
  attendeeIds: string[];
  sharedWith: string[];
  date: string;
  duration: string;
  source: "Zoom" | "Meet" | "Teams";
  summary: string;
  topics: string[];
  sentiment: "Positive" | "Neutral" | "Mixed";
  transcript: TranscriptLine[];
  actionItems: ActionItem[];
  comments: MeetingComment[];
  updatedAt: number;
};

export type FirefliesSnapshot = {
  meetings: Record<string, Meeting>;
};

export type FirefliesState = FirefliesSnapshot & {
  loadCorpusPage: () => Promise<void>;
  importMeeting: (input: {
    actorId: string;
    title: string;
    attendeeIds: string[];
    summary: string;
    topics: string[];
  }) => string;
  updateMeetingText: (
    meetingId: string,
    actorId: string,
    summary: string,
    topics: string[],
  ) => void;
  addActionItem: (meetingId: string, actorId: string, text: string, ownerId: string) => void;
  toggleActionItem: (meetingId: string, actionId: string, actorId: string) => void;
  addComment: (meetingId: string, actorId: string, body: string) => void;
  shareMeeting: (meetingId: string, actorId: string, userId: string) => void;
};

export const firefliesViews: FirefliesView[] = ["all", "mine", "shared", "actions"];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function comment(authorId: string, body: string, timestamp: number): MeetingComment {
  return { id: makeId("ff-comment"), authorId, body, timestamp };
}

function buildInitialSnapshot(cards: SeedCard[] = []): FirefliesSnapshot {
  const meetings: Record<string, Meeting> = {};

  if (cards.length > 0) {
    const memberIds = appUsers.map((u) => u.id);

    cards.forEach((card, index) => {
      const ownerId = card.peopleIds[0] ?? memberIds[0];
      const attendees = Array.from(
        new Set([ownerId, ...memberIds.slice(index % 5, (index % 5) + 4)]),
      );

      meetings[card.id] = {
        id: card.id,
        title: card.title || "Meeting",
        ownerId,
        attendeeIds: attendees,
        sharedWith: memberIds.filter((id) => !attendees.includes(id)).slice(0, 5),
        date: dateTimeText(card.occurredAt),
        duration: "45m",
        source: "Zoom",
        summary:
          (card.source as any)?.summary ||
          ((card.source as any)?.transcript || "").slice(0, 300) + "..." ||
          "Meeting summary from seed data.",
        topics: ["meeting", "sync"],
        sentiment: "Positive",
        transcript: [
          {
            id: `${card.id}-line-1`,
            speakerId: ownerId,
            timestamp: "00:00",
            text: card.text || "",
          },
        ],
        actionItems: ((card.source as any)?.action_items || []).map((text: string, i: number) => ({
          id: `${card.id}-action-${i}`,
          ownerId: attendees[1] ?? ownerId,
          text: text,
          completed: false,
        })),
        comments: [],
        updatedAt: card.occurredAt,
      };
    });
  }

  return { meetings };
}

export function canAccessMeeting(meeting: Meeting | undefined, userId: string) {
  return Boolean(
    meeting &&
    (meeting.ownerId === userId ||
      meeting.attendeeIds.includes(userId) ||
      meeting.sharedWith.includes(userId)),
  );
}

export function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return "just now";
  const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function applyPatch(state: any, patch: any) {
  if ((patch as any).type === "create" && patch.scope === "fireflies.meeting") {
    state.meetings[patch.targetId] = patch.payload as any;
  } else if ((patch as any).type === "update" && patch.scope === "fireflies.meeting") {
    if (state.meetings[patch.targetId]) {
      state.meetings[patch.targetId] = { ...state.meetings[patch.targetId], ...patch.payload };
    }
  }
}

usePatchStore.subscribe((state, prevState) => {
  if (state.batches === prevState.batches) return;
  const newBatches = state.batches.filter((b) => !prevState.batches.includes(b));
  if (newBatches.length === 0) return;
  const newPatches = newBatches.flatMap((b) => b.patches).filter((p) => p.app === "fireflies");
  if (newPatches.length === 0) return;

  useFirefliesStore.setState((draftState: any) => {
    const nextState = JSON.parse(JSON.stringify(draftState));
    newPatches.forEach((patch) => applyPatch(nextState, patch));
    return nextState;
  });
});

const initialSnapshot = buildInitialSnapshot();

export const useFirefliesStore = create<FirefliesState>((set) => ({
  ...initialSnapshot,
  loadCorpusPage: async () => {
    const activeUserId = useUserStore.getState().activeUserId;
    if (!activeUserId) return;
    const pageData = await loadAppCorpus("fireflies", activeUserId);
    if (!pageData) return;
    const snapshot = buildInitialSnapshot(pageData);

    const stateWithPatches = JSON.parse(JSON.stringify(snapshot)) as FirefliesSnapshot;
    const patches = getGlobalPatchesForApp("fireflies");
    patches.forEach((patch) => applyPatch(stateWithPatches, patch));

    set((state: any) => ({
      meetings: { ...state.meetings, ...stateWithPatches.meetings },
    }));
  },
  importMeeting: (input) => {
    const title = input.title.trim();
    if (!title) return "";
    const id = makeId("meeting");
    usePatchStore.getState().appendPatch({
      app: "fireflies",
      targetId: id,
      actorId: input.actorId,
      op: "create",
      scope: "fireflies.meeting",
      payload: { ...input, id, title },
    });
    return id;
  },
  updateMeetingText: (meetingId, actorId, summary, topics) => {
    usePatchStore.getState().appendPatch({
      app: "fireflies",
      targetId: meetingId,
      actorId,
      op: "update",
      scope: "fireflies.meeting",
      payload: { summary, topics },
    });
  },
  addActionItem: (meetingId, actorId, text, ownerId) => {
    set((state) => {
      const meeting = state.meetings[meetingId];
      if (!canAccessMeeting(meeting, actorId)) return state;
      return {
        meetings: {
          ...state.meetings,
          [meetingId]: {
            ...meeting,
            actionItems: [
              ...meeting.actionItems,
              { id: makeId("action"), ownerId, text: text.trim(), completed: false },
            ],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  toggleActionItem: (meetingId, actionId, actorId) => {
    set((state) => {
      const meeting = state.meetings[meetingId];
      if (!canAccessMeeting(meeting, actorId)) return state;
      return {
        meetings: {
          ...state.meetings,
          [meetingId]: {
            ...meeting,
            updatedAt: Date.now(),
            actionItems: meeting.actionItems.map((item) =>
              item.id === actionId && item.ownerId === actorId
                ? { ...item, completed: !item.completed }
                : item,
            ),
          },
        },
      };
    });
  },
  addComment: (meetingId, actorId, body) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    set((state) => {
      const meeting = state.meetings[meetingId];
      if (!canAccessMeeting(meeting, actorId)) return state;
      const timestamp = Date.now();
      return {
        meetings: {
          ...state.meetings,
          [meetingId]: {
            ...meeting,
            updatedAt: timestamp,
            comments: [...meeting.comments, comment(actorId, trimmed, timestamp)],
          },
        },
      };
    });
  },
  shareMeeting: (meetingId, actorId, userId) => {
    set((state) => {
      const meeting = state.meetings[meetingId];
      if (!meeting || meeting.ownerId !== actorId || userId === actorId) return state;
      return {
        meetings: {
          ...state.meetings,
          [meetingId]: {
            ...meeting,
            sharedWith: meeting.sharedWith.includes(userId)
              ? meeting.sharedWith
              : [...meeting.sharedWith, userId],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
}));

export function dateTimeText(timestamp: number) {
  const d = new Date(timestamp);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0") +
    " " +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}
