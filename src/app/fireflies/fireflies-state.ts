"use client";

import { create } from "zustand";

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

const now = Date.now() - 50 * 60 * 1000;

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function comment(authorId: string, body: string, timestamp: number): MeetingComment {
  return { id: makeId("ff-comment"), authorId, body, timestamp };
}

function buildInitialSnapshot(): FirefliesSnapshot {
  const meetings: Record<string, Meeting> = {};
  const titles = [
    "App planning review",
    "Customer expansion sync",
    "Design critique",
    "Engineering standup",
    "Launch readiness",
    "Pipeline inspection",
    "Research synthesis",
    "Incident follow-up",
  ];
  const users = ["riley", "maya", "ari"];
  for (let index = 0; index < 24; index += 1) {
    const ownerId = users[index % users.length];
    const attendeeIds = users.filter(
      (_, userIndex) => (userIndex + index) % 2 === 0 || users[userIndex] === ownerId,
    );
    const timestamp = now - (index + 1) * 3 * 60 * 60 * 1000;
    const id = `meeting-${index + 1}`;
    meetings[id] = {
      id,
      title: titles[index % titles.length],
      ownerId,
      attendeeIds,
      sharedWith: index % 3 === 0 ? users.filter((userId) => !attendeeIds.includes(userId)) : [],
      date: `2026-07-${String(1 + (index % 20)).padStart(2, "0")} ${String(9 + (index % 7)).padStart(2, "0")}:00`,
      duration: `${24 + (index % 6) * 8}m`,
      source: ["Zoom", "Meet", "Teams"][index % 3] as Meeting["source"],
      summary:
        "The meeting covered current progress, blockers, ownership, and concrete follow-ups. Decisions were captured with enough context for async review.",
      topics: [
        ["apps", "quality"],
        ["sales", "customer"],
        ["design", "accessibility"],
        ["infra", "release"],
      ][index % 4],
      sentiment: ["Positive", "Neutral", "Mixed"][index % 3] as Meeting["sentiment"],
      transcript: Array.from({ length: 8 }, (_, lineIndex) => ({
        id: `${id}-line-${lineIndex + 1}`,
        speakerId: attendeeIds[lineIndex % attendeeIds.length],
        timestamp: `00:${String(lineIndex * 3 + 1).padStart(2, "0")}`,
        text: [
          "Let us anchor this on the user-visible workflow first.",
          "The default records should include enough edge cases for validation.",
          "I can take the follow-up and update the acceptance notes.",
          "The privacy reset behavior needs to be part of the definition of done.",
        ][lineIndex % 4],
      })),
      actionItems: Array.from({ length: 3 }, (_, actionIndex) => ({
        id: `${id}-action-${actionIndex + 1}`,
        ownerId: attendeeIds[actionIndex % attendeeIds.length],
        text: ["Send recap", "Update implementation notes", "Verify mobile layout"][actionIndex],
        completed: actionIndex === 2 && index % 2 === 0,
      })),
      comments:
        index % 4 === 0
          ? [
              comment(
                ownerId,
                "Shared the recap with the project thread.",
                timestamp + 20 * 60 * 1000,
              ),
            ]
          : [],
      updatedAt: timestamp,
    };
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

const initialSnapshot = buildInitialSnapshot();

export const useFirefliesStore = create<FirefliesState>((set) => ({
  ...initialSnapshot,
  importMeeting: (input) => {
    const title = input.title.trim();
    if (!title) return "";
    let id = "";
    set((state) => {
      id = makeId("meeting");
      const timestamp = Date.now();
      return {
        meetings: {
          ...state.meetings,
          [id]: {
            id,
            title,
            ownerId: input.actorId,
            attendeeIds: Array.from(new Set([input.actorId, ...input.attendeeIds])),
            sharedWith: [],
            date: "2026-07-02 14:00",
            duration: "32m",
            source: "Zoom",
            summary: input.summary.trim() || "Imported meeting summary.",
            topics: input.topics,
            sentiment: "Neutral",
            transcript: [
              {
                id: `${id}-line-1`,
                speakerId: input.actorId,
                timestamp: "00:01",
                text: "Imported transcript preview is available for review.",
              },
            ],
            actionItems: [
              {
                id: `${id}-action-1`,
                ownerId: input.actorId,
                text: "Review imported summary",
                completed: false,
              },
            ],
            comments: [],
            updatedAt: timestamp,
          },
        },
      };
    });
    return id;
  },
  updateMeetingText: (meetingId, actorId, summary, topics) => {
    set((state) => {
      const meeting = state.meetings[meetingId];
      if (!canAccessMeeting(meeting, actorId)) return state;
      return {
        meetings: {
          ...state.meetings,
          [meetingId]: {
            ...meeting,
            summary: summary.trim(),
            topics: topics.map((t) => t.trim()).filter(Boolean),
            updatedAt: Date.now(),
          },
        },
      };
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
