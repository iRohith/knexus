import { Suspense } from "react";

import { KnowledgeGraphWorkbench } from "@/app/knowledge-graph/KnowledgeGraphWorkbench";

export default function KnowledgeGraphPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading graph...</main>}>
      <KnowledgeGraphWorkbench />
    </Suspense>
  );
}
