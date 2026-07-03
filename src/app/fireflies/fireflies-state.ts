"use client";

import { create } from "zustand";

import {
  activeCorpusUserIds,
  corpusEventsFor,
  corpusLabels,
  corpusNormalizedRecords,
  corpusNormalizedString,
  corpusNormalizedStrings,
  corpusText,
  corpusUserIdFromName,
  dateTimeText,
  loadCorpusEventsFor,
  stableNumber,
} from "@/lib/corpus-app-data";

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
  loadCorpusPage: (page?: number) => Promise<void>;
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

function buildInitialSnapshot(corpusMeetings = corpusEventsFor("fireflies")): FirefliesSnapshot {
  if (corpusMeetings.length > 0) {
    const meetings: Record<string, Meeting> = {};
    const memberIds = activeCorpusUserIds();

    corpusMeetings.forEach((event, index) => {
      const normalizedAttendees = [
        ...corpusNormalizedStrings(event, "redwoodAttendees"),
        ...corpusNormalizedStrings(event, "customerAttendees"),
      ].map((name) => corpusUserIdFromName(name, event.actorId));
      const attendees = Array.from(
        new Set([
          event.actorId,
          ...normalizedAttendees,
          ...memberIds.slice(index % 5, (index % 5) + 4),
        ]),
      );
      const summary = corpusNormalizedString(event, "summary", corpusText(event, 2200));
      const transcript = corpusNormalizedRecords(event, "transcript");
      const actionItems = corpusNormalizedStrings(event, "actionItems");
      meetings[event.sourceEntityId] = {
        id: event.sourceEntityId,
        title: event.title,
        ownerId: event.actorId,
        attendeeIds: attendees,
        sharedWith: memberIds.filter((id) => !attendees.includes(id)).slice(0, 5),
        date: dateTimeText(event.occurredAt),
        duration: `${35 + stableNumber(event.id, 35)}m`,
        source: ["Zoom", "Meet", "Teams"][index % 3] as Meeting["source"],
        summary,
        topics: corpusLabels(event, ["customer", "meeting"]).slice(0, 5),
        sentiment: ["Positive", "Neutral", "Mixed"][
          stableNumber(event.id, 3)
        ] as Meeting["sentiment"],
        transcript:
          transcript.length > 0
            ? transcript.slice(0, 12).map((line, lineIndex) => ({
                id: `${event.sourceEntityId}-line-${lineIndex + 1}`,
                speakerId: corpusUserIdFromName(
                  typeof line.author === "string" ? line.author : "",
                  attendees[lineIndex % attendees.length],
                ),
                timestamp: `00:${String(lineIndex * 3 + 1).padStart(2, "0")}`,
                text: typeof line.body === "string" ? line.body : summary,
              }))
            : summary
                .split(/(?<=[.!?])\s+/)
                .slice(0, 8)
                .map((text, lineIndex) => ({
                  id: `${event.sourceEntityId}-line-${lineIndex + 1}`,
                  speakerId: attendees[lineIndex % attendees.length],
                  timestamp: `00:${String(lineIndex * 3 + 1).padStart(2, "0")}`,
                  text,
                })),
        actionItems:
          actionItems.length > 0
            ? actionItems.slice(0, 6).map((text, actionIndex) => ({
                id: `${event.sourceEntityId}-action-${actionIndex + 1}`,
                ownerId: attendees[(actionIndex + 1) % attendees.length] ?? event.actorId,
                text,
                completed: stableNumber(`${event.id}-${actionIndex}`, 4) === 0,
              }))
            : [
                {
                  id: `${event.sourceEntityId}-action-1`,
                  ownerId: attendees[1] ?? event.actorId,
                  text: "Review customer evidence and attach follow-up decisions.",
                  completed: stableNumber(event.id, 4) === 0,
                },
              ],
        comments:
          index % 2 === 0
            ? [
                {
                  id: `${event.sourceEntityId}-comment-1`,
                  authorId: attendees[0],
                  body: "Added this meeting to the customer evidence trail.",
                  timestamp: event.occurredAt + 30 * 60 * 1000,
                },
              ]
            : [],
        updatedAt: event.occurredAt,
      };
    });

    return { meetings };
  }

  return { meetings: {} };
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
  loadCorpusPage: async (page = 1) => {
    const events = await loadCorpusEventsFor("fireflies", page);
    const snapshot = buildInitialSnapshot(events);
    set((state) => ({
      meetings: { ...state.meetings, ...snapshot.meetings },
    }));
  },
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
