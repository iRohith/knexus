# Frontend State Management

The Next.js client relies entirely on Zustand for reactive state management, splitting responsibilities cleanly between backend infrastructure lifecycle management and frontend UI experiences.

## Activity State (`app/admin/activity-state.ts`)

The Activity Store tracks the granular, real-time lifecycle of raw events flowing from the UI, through the Java Backend, to the final index store.

- **`events`**: Maps raw events from the local pre-generated `/seed` directory.
- **`processingRuns`**: Aggregates batch runs. Each batch contains a set of items (e.g. 200 items per batch).
- **Backend Polling**:
  - Exposes `pollProcessingRun` and `startProcessingRunPolling` which repeatedly ping `/api/indexing/jobs/{id}` for state updates.
  - Monitors the completion or failure status of Spring Boot Jobs. If a `401 Unauthorized` is ever caught (indicating session drop), it redirects gracefully to `/login`.

## Intelligence State (`app/intelligence-state.ts`)

The Intelligence Store governs the Knowledge Graph chat UI and visualization state.

- **Static Fallbacks**: While standard queries proxy directly to `POST /api/v1/knowledge-graph/chat`, we support static offline caching for hackathons or missing infrastructure.
  - If a backend request errors, the frontend transparently issues a background fetch to `/cognee/answers.json`.
  - It fuzzy-matches the user's chat prompt against the pre-compiled LLM answers and displays it flawlessly if a match occurs.
- **Graph Fallback**: If the live UI cannot resolve `/api/v1/knowledge-graph/structure`, the `cognee-static-graph.ts` fallback instantly populates the dynamic visualization nodes from `/cognee/graph.json`.
