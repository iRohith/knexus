import { Suspense } from "react";

import { GitHubApp } from "@/app/github/GitHubApp";

export default function GitHubPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading GitHub...</main>}>
      <GitHubApp />
    </Suspense>
  );
}
