"use client";

import { useState } from "react";
import { Plus, Paperclip, Send, FileText, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SlackAttachment } from "@/app/slack/slack-state";

export function ComposeBox({
  placeholder,
  onSend,
  makeAttachment,
  isThread,
}: {
  placeholder: string;
  onSend: (draft: string, attachments: SlackAttachment[]) => void;
  makeAttachment: () => SlackAttachment;
  isThread?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<SlackAttachment[]>([]);

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!draft.trim() && attachments.length === 0) return;
    onSend(draft, attachments);
    setDraft("");
    setAttachments([]);
  };

  return (
    <form
      className={cn(
        isThread
          ? "border-t p-3 dark:border-white/10"
          : "shrink-0 border-t bg-white p-3 dark:border-white/10 dark:bg-[#1a1d21]",
      )}
      onSubmit={handleSubmit}
    >
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <Badge key={attachment.id} variant="outline" className="gap-2">
              <FileText className="size-3.5" />
              {attachment.name}
              <button
                className="cursor-pointer"
                onClick={() =>
                  setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                }
                type="button"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="rounded-lg border bg-white p-2 shadow-sm dark:border-white/15 dark:bg-[#222529]">
        <Textarea
          className="min-h-20 resize-none border-0 shadow-none focus-visible:ring-0"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            handleSubmit();
          }}
        />
        <div className={cn("flex items-center gap-1", isThread && "mt-2")}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            type="button"
            onClick={() => setAttachments((current) => [...current, makeAttachment()])}
          >
            {isThread ? <Plus className="size-4" /> : <Paperclip />}
          </Button>
          {isThread && <div className="flex-1" />}
          <Button
            className={cn(
              "cursor-pointer gap-2",
              !isThread && "ml-auto bg-[#007a5a] text-white hover:bg-[#148567]",
            )}
            size="sm"
            type="submit"
            disabled={!draft.trim() && attachments.length === 0}
          >
            <Send className="size-4" />
            {isThread ? "Reply" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}
