import { Suspense } from "react";

import { AdminHistory } from "@/app/admin/history/AdminHistory";

export default function AdminHistoryPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading history...</main>}>
      <AdminHistory />
    </Suspense>
  );
}
