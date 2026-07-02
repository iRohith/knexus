# Corp-OS

Corp-OS is a collection of simulated corporate desktop web applications built with Next.js, Tailwind CSS, and Zustand. It provides pixel-perfect UI clones of popular productivity tools—ready to be customized and plugged into your own backend.

This repository is perfect for platform deployments, or building advanced unified workspace experiences.

## 🚀 What's Available

Corp-OS includes full UI simulations for the following applications:

- **Linear** (Issue tracking, cycles, projects)
- **GitHub** (Pull requests, issues, comments)
- **Slack** (Channels, messaging, threads)
- **Confluence** (Pages, documentation, comments)
- **Google Drive** (Files, folders, preview, document viewing)
- **Gmail** (Inbox, reading, drafting, sending emails)
- **HubSpot** (Contacts, deals, tasks)
- **Jira** (Backlog, sprints, tickets)
- **Fireflies** (Meeting transcripts, summaries, action items)

Each application features dark mode support, realistic placeholder state, and responsive layouts.

## 🛠 Getting Started

First, install dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the unified dashboard and navigate through the apps.

### Linting & Formatting

```bash
pnpm format
pnpm lint
```

## 🔌 Developer Guide: Backend Integration

By default, all apps use local, in-memory state via `Zustand` (e.g., `linear-state.ts`, `slack-state.ts`). This allows them to feel fully interactive immediately.

To plug your own backend state and capture user events (like when an item gets created, updated, or deleted), you have two primary methods:

### Method 1: The `onAction` Callback (Recommended)

Each major app exposes an `onAction` property on its root component (e.g., `<LinearApp />`, `<SlackApp />`). This callback intercepts critical creation and interaction events inside the UI, delivering a `type` string and a `payload` object.

```tsx
import { LinearApp } from "@/app/linear/LinearApp";

export default function MyCustomPage() {
  const handleAction = (action: { type: string; payload: unknown }) => {
    console.log("Action intercepted:", action.type, action.payload);

    switch (action.type) {
      case "CREATE_ISSUE":
        // POST to your backend: /api/linear/issues
        fetch("/api/issues", { method: "POST", body: JSON.stringify(action.payload) });
        break;
      case "CREATE_COMMENT":
        // Handle new comments...
        break;
    }
  };

  return <LinearApp onAction={handleAction} />;
}
```

**Common Actions Available:**

- **Linear**: `CREATE_ISSUE`, `CREATE_COMMENT`
- **GitHub**: `CREATE_ISSUE`, `CREATE_PULL_REQUEST`, `CREATE_ISSUE_COMMENT`, `CREATE_PR_COMMENT`
- **Confluence**: `CREATE_PAGE`, `CREATE_COMMENT`
- **Slack**: `CREATE_CHANNEL`, `SEND_MESSAGE`, `SEND_REPLY`
- **HubSpot**: `CREATE_CONTACT`, `CREATE_DEAL`, `CREATE_TASK`
- **Google Drive**: `CREATE_FOLDER`, `UPLOAD_FILE`
- **Gmail**: `SEND_EMAIL`

### Method 2: Replacing/Syncing Zustand Stores (For Full State Control)

If you need deeper integration (e.g., loading initial data from your database, handling deletions, or listening to all edits):

1. **Locate the State File:** Navigate to the app's directory (e.g., `src/app/linear/linear-state.ts`).
2. **Override Initial State:** Modify the `buildInitialSnapshot()` function to populate the store with data fetched from your API instead of simulated data.
3. **Intercept Mutations:** Inside the Zustand store actions (e.g., `createIssue`, `updateStatus`, `deleteIssue`), add your `fetch` calls or WebSocket emissions.

**Example `linear-state.ts` modification:**

```typescript
createIssue: (actorId, input) => {
  set((state) => {
    // 1. Fire off async backend request
    fetch("/api/issues", { method: "POST", body: JSON.stringify(input) });

    // 2. Perform optimistic UI update
    const id = generateId("LIN");
    return {
      issues: {
        ...state.issues,
        [id]: { id, ...input, creatorId: actorId },
      },
    };
  });
};
```

## 🎨 Modifying UI Components

All UI components are built with [Shadcn UI](https://ui.shadcn.com/) and Tailwind CSS.

- **Global styles:** `src/app/globals.css`
- **Shared components:** `src/components/ui/`
- **Theming:** Modify `tailwind.config.ts` (or `postcss.config.mjs`) and the CSS variables in `globals.css` to update the global theme.
