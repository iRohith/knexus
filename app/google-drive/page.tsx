import { Suspense } from "react";

import { GoogleDriveApp } from "@/app/google-drive/GoogleDriveApp";

export default function GoogleDrivePage() {
  return (
    <Suspense fallback={<main className="flex-1 p-4 lg:p-16">Loading Google Drive...</main>}>
      <GoogleDriveApp />
    </Suspense>
  );
}
