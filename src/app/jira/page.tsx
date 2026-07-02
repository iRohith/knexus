import { Suspense } from "react";

import { JiraApp } from "@/app/jira/JiraApp";

export default function JiraPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading Jira...</main>}>
      <JiraApp />
    </Suspense>
  );
}
