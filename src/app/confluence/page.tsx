import { Suspense } from "react";

import { ConfluenceApp } from "@/app/confluence/ConfluenceApp";

export default function ConfluencePage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading Confluence...</main>}>
      <ConfluenceApp />
    </Suspense>
  );
}
