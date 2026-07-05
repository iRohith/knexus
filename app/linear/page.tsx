import { Suspense } from "react";

import { LinearApp } from "@/app/linear/LinearApp";

export default function LinearPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading Linear...</main>}>
      <LinearApp />
    </Suspense>
  );
}
