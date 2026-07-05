import { Suspense } from "react";

import { FirefliesApp } from "@/app/fireflies/FirefliesApp";

export default function FirefliesPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading Fireflies...</main>}>
      <FirefliesApp />
    </Suspense>
  );
}
