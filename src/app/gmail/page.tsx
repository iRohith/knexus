import { Suspense } from "react";

import { GmailApp } from "@/app/gmail/GmailApp";

export default function GmailPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading Gmail...</main>}>
      <GmailApp />
    </Suspense>
  );
}
