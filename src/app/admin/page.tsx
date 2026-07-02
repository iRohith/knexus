import { Suspense } from "react";

import { AdminDashboard } from "@/app/admin/AdminDashboard";

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading activity...</main>}>
      <AdminDashboard />
    </Suspense>
  );
}
