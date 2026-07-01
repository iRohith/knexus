import { Suspense } from "react";

import { SlackApp } from "@/app/slack/SlackApp";

export default function SlackPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading Slack...</main>}>
      <SlackApp />
    </Suspense>
  );
}
