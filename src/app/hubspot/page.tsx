import { Suspense } from "react";

import { HubSpotApp } from "@/app/hubspot/HubSpotApp";

export default function HubSpotPage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading HubSpot...</main>}>
      <HubSpotApp />
    </Suspense>
  );
}
