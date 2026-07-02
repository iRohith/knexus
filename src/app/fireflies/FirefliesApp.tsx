"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  FileAudio,
  ListTodo,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { captureActivityEvent } from "@/app/admin/activity-capture";
import { appUsers } from "@/lib/users";
import { useActiveUser } from "@/lib/user-store";
import { cn } from "@/lib/utils";
import {
  canAccessMeeting,
  firefliesViews,
  relativeTime,
  useFirefliesStore,
  type FirefliesView,
  type Meeting,
} from "@/app/fireflies/fireflies-state";

function normalizeView(value: string | null): FirefliesView {
  return firefliesViews.includes(value as FirefliesView) ? (value as FirefliesView) : "all";
}

function userName(id: string) {
  return appUsers.find((user) => user.id === id)?.name ?? "Unknown";
}

function initials(id: string) {
  return appUsers.find((user) => user.id === id)?.initials ?? "??";
}

export function FirefliesApp() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeUser = useActiveUser();
  const meetings = useFirefliesStore((state) => state.meetings);
  const importMeeting = useFirefliesStore((state) => state.importMeeting);
  const updateMeetingText = useFirefliesStore((state) => state.updateMeetingText);
  const addActionItem = useFirefliesStore((state) => state.addActionItem);
  const toggleActionItem = useFirefliesStore((state) => state.toggleActionItem);
  const addComment = useFirefliesStore((state) => state.addComment);
  const shareMeeting = useFirefliesStore((state) => state.shareMeeting);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [commentState, setCommentState] = useState({ key: "", value: "" });
  const previousUserId = useRef(activeUser.id);

  const view = normalizeView(searchParams.get("view"));
  const meetingId = searchParams.get("meeting");
  const query = searchParams.get("q") ?? "";
  const normalizedQuery = query.trim().toLowerCase();
  const commentDraft = commentState.key === meetingId ? commentState.value : "";

  function setCommentDraft(value: string) {
    setCommentState({ key: meetingId ?? "", value });
  }

  function updateUrl(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (previousUserId.current === activeUser.id) return;
    previousUserId.current = activeUser.id;
    router.replace(`${pathname}?view=all`);
  }, [activeUser.id, pathname, router]);

  useEffect(() => {
    if (!meetingId || canAccessMeeting(meetings[meetingId], activeUser.id)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("meeting");
    router.replace(`${pathname}?${params.toString()}`);
  }, [activeUser.id, meetingId, meetings, pathname, router, searchParams]);

  const visibleMeetings = useMemo(
    () =>
      Object.values(meetings)
        .filter((meeting) => canAccessMeeting(meeting, activeUser.id))
        .filter((meeting) => {
          if (view === "mine" && meeting.ownerId !== activeUser.id) return false;
          if (view === "shared" && !meeting.sharedWith.includes(activeUser.id)) return false;
          if (
            view === "actions" &&
            !meeting.actionItems.some((item) => item.ownerId === activeUser.id && !item.completed)
          )
            return false;
          if (!normalizedQuery) return true;
          return [
            meeting.title,
            meeting.summary,
            meeting.topics.join(" "),
            meeting.transcript.map((line) => line.text).join(" "),
            meeting.actionItems.map((item) => item.text).join(" "),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        })
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [activeUser.id, meetings, normalizedQuery, view],
  );
  const selectedMeeting =
    meetingId && canAccessMeeting(meetings[meetingId], activeUser.id) ? meetings[meetingId] : null;
  const openActions = Object.values(meetings)
    .filter((meeting) => canAccessMeeting(meeting, activeUser.id))
    .flatMap((meeting) =>
      meeting.actionItems.filter((item) => item.ownerId === activeUser.id && !item.completed),
    );

  const sidebar = (
    <Sidebar
      view={view}
      actionCount={openActions.length}
      onView={(next) => {
        updateUrl({ view: next, meeting: null, q: null });
        setSidebarOpen(false);
      }}
    />
  );

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 bg-[#f8fafc] text-sm text-[#111827] dark:bg-[#10131a] dark:text-[#e5edf6]">
      <aside className="hidden w-72 shrink-0 border-r border-[#d9e2ec] bg-white lg:block dark:border-[#273241] dark:bg-[#171c26]">
        {sidebar}
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-80 border-[#d9e2ec] bg-white p-0 dark:border-[#273241] dark:bg-[#171c26]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Fireflies navigation</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#d9e2ec] bg-white dark:border-[#273241] dark:bg-[#171c26]">
          <div className="flex h-14 items-center gap-3 px-4">
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Fireflies</div>
              <div className="text-xs text-muted-foreground">
                Meeting intelligence and action items
              </div>
            </div>
            <Button
              className="cursor-pointer bg-[#6d5dfc] text-white hover:bg-[#5a49e8]"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <Plus className="size-4" />
              Import
            </Button>
          </div>
          <div className="px-4 pb-3">
            <div className="relative max-w-md">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 bg-white pl-9 dark:bg-[#10131a]"
                placeholder="Search meetings"
                value={query}
                onChange={(event) => updateUrl({ q: event.target.value || null, meeting: null })}
              />
            </div>
          </div>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-4 p-4 xl:grid-cols-[24rem_1fr]">
            <MeetingList
              meetings={visibleMeetings}
              activeMeetingId={selectedMeeting?.id ?? ""}
              onOpen={(id) => updateUrl({ meeting: id })}
            />
            {selectedMeeting ? (
              <MeetingDetail
                meeting={selectedMeeting}
                activeUserId={activeUser.id}
                commentDraft={commentDraft}
                onCommentDraft={setCommentDraft}
                onAction={(actionId) => {
                  toggleActionItem(selectedMeeting.id, actionId, activeUser.id);
                  const item = selectedMeeting.actionItems.find((action) => action.id === actionId);
                  captureActivityEvent({
                    sourceApp: "fireflies",
                    actorId: activeUser.id,
                    type: "meeting_action",
                    action: "Toggled Fireflies action item",
                    title: selectedMeeting.title,
                    body: item?.text ?? "Meeting action item updated.",
                    sourceEntityId: actionId,
                    sourceEntityType: "action_item",
                    sourceUrl: `/fireflies?view=actions&meeting=${selectedMeeting.id}`,
                    metadata: {
                      meetingId: selectedMeeting.id,
                      completed: !(item?.completed ?? false),
                    },
                  });
                }}
                onAddAction={(text, ownerId) => {
                  addActionItem(selectedMeeting.id, activeUser.id, text, ownerId);
                  captureActivityEvent({
                    sourceApp: "fireflies",
                    actorId: activeUser.id,
                    type: "meeting_action",
                    action: "Added Fireflies action item",
                    title: selectedMeeting.title,
                    body: text,
                    sourceEntityId: selectedMeeting.id,
                    sourceEntityType: "meeting",
                    sourceUrl: `/fireflies?view=actions&meeting=${selectedMeeting.id}`,
                    metadata: { meetingId: selectedMeeting.id, ownerId },
                  });
                }}
                onShare={(userId) => {
                  shareMeeting(selectedMeeting.id, activeUser.id, userId);
                  captureActivityEvent({
                    sourceApp: "fireflies",
                    actorId: activeUser.id,
                    type: "share",
                    action: "Shared Fireflies meeting",
                    title: selectedMeeting.title,
                    body: `Meeting shared with ${userId}.`,
                    sourceEntityId: selectedMeeting.id,
                    sourceEntityType: "meeting",
                    sourceUrl: `/fireflies?view=shared&meeting=${selectedMeeting.id}`,
                    metadata: { sharedWith: userId },
                  });
                }}
                onSaveText={(summary, topics) => {
                  updateMeetingText(selectedMeeting.id, activeUser.id, summary, topics);
                  captureActivityEvent({
                    sourceApp: "fireflies",
                    actorId: activeUser.id,
                    type: "update",
                    action: "Updated Fireflies summary",
                    title: selectedMeeting.title,
                    body: summary,
                    sourceEntityId: selectedMeeting.id,
                    sourceEntityType: "meeting",
                    sourceUrl: `/fireflies?view=all&meeting=${selectedMeeting.id}`,
                    metadata: { topics },
                  });
                }}
                onComment={() => {
                  addComment(selectedMeeting.id, activeUser.id, commentDraft);
                  captureActivityEvent({
                    sourceApp: "fireflies",
                    actorId: activeUser.id,
                    type: "comment",
                    action: "Commented on Fireflies meeting",
                    title: selectedMeeting.title,
                    body: commentDraft,
                    sourceEntityId: selectedMeeting.id,
                    sourceEntityType: "meeting",
                    sourceUrl: `/fireflies?view=all&meeting=${selectedMeeting.id}`,
                    metadata: { meetingId: selectedMeeting.id },
                  });
                  setCommentDraft("");
                }}
              />
            ) : (
              <Empty />
            )}
          </div>
        </ScrollArea>
      </section>
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(input) => {
          const id = importMeeting({ ...input, actorId: activeUser.id });
          if (id) {
            setImportOpen(false);
            captureActivityEvent({
              sourceApp: "fireflies",
              actorId: activeUser.id,
              type: "meeting_action",
              action: "Imported Fireflies meeting",
              title: input.title,
              body: input.summary,
              sourceEntityId: id,
              sourceEntityType: "meeting",
              sourceUrl: `/fireflies?view=mine&meeting=${id}`,
              metadata: { attendeeIds: input.attendeeIds },
            });
            updateUrl({ view: "mine", meeting: id, q: null });
          }
        }}
      />
    </main>
  );
}

function Sidebar({
  view,
  actionCount,
  onView,
}: {
  view: FirefliesView;
  actionCount: number;
  onView: (view: FirefliesView) => void;
}) {
  const labels: Record<FirefliesView, string> = {
    all: "All meetings",
    mine: "My meetings",
    shared: "Shared",
    actions: "Action items",
  };
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#d9e2ec] p-4 dark:border-[#273241]">
        <div className="font-semibold">Fireflies</div>
        <div className="text-xs text-muted-foreground">Meeting library</div>
      </div>
      <div className="space-y-1 p-3">
        {firefliesViews.map((item) => (
          <button
            key={item}
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-[#eef2ff] dark:hover:bg-[#252b3a]",
              view === item && "bg-[#eef2ff] text-[#5a49e8] dark:bg-[#252849]",
            )}
            onClick={() => onView(item)}
            type="button"
          >
            {item === "actions" ? (
              <ListTodo className="size-4" />
            ) : (
              <FileAudio className="size-4" />
            )}
            {labels[item]}
            {item === "actions" && actionCount > 0 && (
              <Badge className="ml-auto">{actionCount}</Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function MeetingList({
  meetings,
  activeMeetingId,
  onOpen,
}: {
  meetings: Meeting[];
  activeMeetingId: string;
  onOpen: (id: string) => void;
}) {
  if (meetings.length === 0)
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-[#d9e2ec] bg-white text-muted-foreground dark:border-[#273241] dark:bg-[#171c26]">
        No meetings match this view.
      </div>
    );
  return (
    <div className="overflow-hidden rounded-md border border-[#d9e2ec] bg-white dark:border-[#273241] dark:bg-[#171c26]">
      {meetings.map((meeting) => (
        <button
          key={meeting.id}
          className={cn(
            "w-full cursor-pointer border-b border-[#d9e2ec] p-3 text-left last:border-b-0 hover:bg-[#f8fafc] dark:border-[#273241] dark:hover:bg-[#252b3a]",
            activeMeetingId === meeting.id && "bg-[#eef2ff] dark:bg-[#252849]",
          )}
          onClick={() => onOpen(meeting.id)}
          type="button"
        >
          <div className="flex items-start gap-3">
            <FileAudio className="mt-1 size-5 text-[#6d5dfc]" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{meeting.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {meeting.source} · {meeting.duration} · {relativeTime(meeting.updatedAt)}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {meeting.topics.map((topic) => (
                  <Badge key={topic} variant="secondary" className="text-[10px]">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function MeetingDetail({
  meeting,
  activeUserId,
  commentDraft,
  onCommentDraft,
  onAction,
  onAddAction,
  onShare,
  onSaveText,
  onComment,
}: {
  meeting: Meeting;
  activeUserId: string;
  commentDraft: string;
  onCommentDraft: (value: string) => void;
  onAction: (actionId: string) => void;
  onAddAction: (text: string, ownerId: string) => void;
  onShare: (userId: string) => void;
  onSaveText: (summary: string, topics: string[]) => void;
  onComment: () => void;
}) {
  const [textState, setTextState] = useState({ key: "", summary: "", topics: "" });
  const [newActionText, setNewActionText] = useState("");
  const [newActionOwner, setNewActionOwner] = useState(activeUserId);
  const [speakerFilter, setSpeakerFilter] = useState("all");

  const summary = textState.key === meeting.id ? textState.summary : meeting.summary;
  const topics = textState.key === meeting.id ? textState.topics : meeting.topics.join(", ");

  const isOwner = meeting.ownerId === activeUserId;
  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-md border border-[#d9e2ec] bg-white p-4 dark:border-[#273241] dark:bg-[#171c26]">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold">{meeting.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {meeting.date} · {meeting.duration} · {meeting.source}
            </p>
          </div>
          <Select
            disabled={!isOwner}
            onValueChange={(value) => typeof value === "string" && onShare(value)}
          >
            <SelectTrigger
              className="cursor-pointer"
              title={!isOwner ? "Only the owner can share this meeting" : undefined}
            >
              <Share2 className="size-4" />
              <SelectValue placeholder="Share" />
            </SelectTrigger>
            <SelectContent>
              {appUsers
                .filter((user) => user.id !== activeUserId)
                .map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 rounded-md bg-[#f8fafc] p-4 dark:bg-[#252b3a]">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-[#6d5dfc]" />
            AI summary
          </div>
          <Textarea
            className="mb-2 bg-transparent border-transparent shadow-none resize-none focus-visible:border-[#d9e2ec] dark:focus-visible:border-[#273241]"
            value={summary}
            onChange={(e) => setTextState({ key: meeting.id, summary: e.target.value, topics })}
            onBlur={() => onSaveText(summary, topics.split(","))}
          />
          <Input
            className="h-8 bg-transparent border-transparent shadow-none focus-visible:border-[#d9e2ec] dark:focus-visible:border-[#273241] text-xs"
            placeholder="Topics (comma separated)"
            value={topics}
            onChange={(e) => setTextState({ key: meeting.id, summary, topics: e.target.value })}
            onBlur={() => onSaveText(summary, topics.split(","))}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {meeting.attendeeIds.map((id) => (
            <Badge key={id} variant="outline">
              <Users className="size-3" />
              {userName(id)}
            </Badge>
          ))}
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-md border border-[#d9e2ec] bg-white p-4 dark:border-[#273241] dark:bg-[#171c26]">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold">Transcript</div>
            <Select
              value={speakerFilter}
              onValueChange={(v) => typeof v === "string" && setSpeakerFilter(v)}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All speakers</SelectItem>
                {Array.from(new Set(meeting.transcript.map((l) => l.speakerId))).map((id) => (
                  <SelectItem key={id} value={id}>
                    {userName(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {meeting.transcript
              .filter((line) => speakerFilter === "all" || line.speakerId === speakerFilter)
              .map((line) => (
                <div key={line.id} className="grid grid-cols-[3rem_1fr] gap-3">
                  <span className="text-xs text-muted-foreground">{line.timestamp}</span>
                  <div>
                    <span className="font-medium">{userName(line.speakerId)}: </span>
                    {line.text}
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="rounded-md border border-[#d9e2ec] bg-white p-4 dark:border-[#273241] dark:bg-[#171c26]">
          <div className="mb-3 font-semibold">Action items</div>
          <div className="space-y-2">
            {meeting.actionItems.map((item) => (
              <button
                key={item.id}
                id={item.id}
                className="flex w-full cursor-pointer items-start gap-2 rounded-md p-2 text-left hover:bg-[#f8fafc] dark:hover:bg-[#252b3a]"
                onClick={() => onAction(item.id)}
                type="button"
              >
                <CheckCircle2
                  className={cn(
                    "mt-0.5 size-4",
                    item.completed ? "text-emerald-600" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1",
                    item.completed && "line-through text-muted-foreground",
                  )}
                >
                  {item.text}
                  <span className="block text-xs text-muted-foreground">
                    {userName(item.ownerId)}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <form
            className="mt-4 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newActionText.trim()) return;
              onAddAction(newActionText, newActionOwner);
              setNewActionText("");
            }}
          >
            <Input
              placeholder="New action item..."
              value={newActionText}
              onChange={(e) => setNewActionText(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="flex justify-between items-center">
              <Select
                value={newActionOwner}
                onValueChange={(v) => typeof v === "string" && setNewActionOwner(v)}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meeting.attendeeIds.map((id) => (
                    <SelectItem key={id} value={id}>
                      {userName(id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs bg-[#6d5dfc] text-white hover:bg-[#5a49e8]"
                disabled={!newActionText.trim()}
              >
                Add
              </Button>
            </div>
          </form>
        </div>
      </section>
      <section className="rounded-md border border-[#d9e2ec] bg-white p-4 dark:border-[#273241] dark:bg-[#171c26]">
        <div className="mb-3 font-semibold">Comments</div>
        <div className="space-y-3">
          {meeting.comments.map((comment) => (
            <div key={comment.id} id={comment.id} className="flex gap-3">
              <Avatar>
                <AvatarFallback>{initials(comment.authorId)}</AvatarFallback>
              </Avatar>
              <div className="rounded-md bg-[#f8fafc] p-3 dark:bg-[#252b3a]">
                <div className="text-xs text-muted-foreground">
                  {userName(comment.authorId)} · {relativeTime(comment.timestamp)}
                </div>
                <p className="mt-1">{comment.body}</p>
              </div>
            </div>
          ))}
        </div>
        <form
          className="mt-4 flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onComment();
          }}
        >
          <MessageSquare className="mt-2 size-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <Textarea
              placeholder="Add comment"
              value={commentDraft}
              onChange={(event) => onCommentDraft(event.target.value)}
            />
            <Button
              className="mt-2 cursor-pointer bg-[#6d5dfc] text-white hover:bg-[#5a49e8]"
              size="sm"
              disabled={!commentDraft.trim()}
              type="submit"
            >
              Comment
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (input: {
    title: string;
    attendeeIds: string[];
    summary: string;
    topics: string[];
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [topics, setTopics] = useState("planning, follow-up");
  const [attendeeIds, setAttendeeIds] = useState<string[]>(appUsers.map((u) => u.id));

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle("");
      setSummary("");
      setTopics("planning, follow-up");
      setAttendeeIds(appUsers.map((u) => u.id));
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import meeting</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            autoFocus
            placeholder="Meeting title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Textarea
            placeholder="Summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
          <Input
            placeholder="Topics"
            value={topics}
            onChange={(event) => setTopics(event.target.value)}
          />
          <div className="text-xs font-medium text-muted-foreground">Attendees</div>
          <div className="flex flex-wrap gap-2">
            {appUsers.map((user) => (
              <Badge
                key={user.id}
                variant={attendeeIds.includes(user.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() =>
                  setAttendeeIds((prev) =>
                    prev.includes(user.id)
                      ? prev.filter((id) => id !== user.id)
                      : [...prev, user.id],
                  )
                }
              >
                {user.name}
              </Badge>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="cursor-pointer bg-[#6d5dfc] text-white hover:bg-[#5a49e8]"
            disabled={!title.trim()}
            onClick={() =>
              onImport({
                title,
                summary,
                attendeeIds,
                topics: topics
                  .split(",")
                  .map((topic) => topic.trim())
                  .filter(Boolean),
              })
            }
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Empty() {
  return (
    <div className="flex h-72 items-center justify-center rounded-md border border-[#d9e2ec] bg-white text-muted-foreground dark:border-[#273241] dark:bg-[#171c26]">
      <Clock3 className="mr-2 size-5" />
      Select a meeting to view notes.
    </div>
  );
}
