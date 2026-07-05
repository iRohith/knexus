import { Suspense } from "react";
import { AdminDashboard } from "./AdminDashboard";

export default function AdminPage() {
  return (
    <Suspense>
      <AdminDashboard />
    </Suspense>
  );
}
