# Data Ingestion Pipeline

The knexus platform is built to aggregate thousands of disparate corporate events (Slack messages, Jiras, GitHub PRs, Google Drive documents) into a unified Knowledge Graph hosted on Cognee Cloud.

## The Ingestion Architecture

1. **Static Seed Data**
   The `public/seed/` directory houses massive amounts of generated raw `.json` event data split across folders like `apps/` and `users/`. The `manifest.json` acts as an index for every single file.

2. **Frontend Orchestration**
   The Next.js UI reads the generated runs from `processing_runs.json` to build the Activity Dashboard. The user can bulk-submit these seeded events by triggering the `/api/indexing/jobs/trigger-bulk-ingestion` endpoint.

3. **Backend Processing**
   - The Spring Boot backend accepts the bulk batch requests and persists initial job tracking into PostgreSQL.
   - It publishes the raw events into Kafka topics (`knowledge-nexus-indexing-group-v5`).
   - Consumers in the Java backend eventually ingest these records into the unified data stores.

## Advanced Graph Operations

To prevent timeouts and handle high volume during localized testing, we provide Python fallback scripts for direct integration with the Cognee SDK:

- **`scripts/ingest_to_cognee.py`**: Reads raw seed data, cleanly groups exactly 3000 events into 15 expected batches of 200, pushes them to the Cognee SDK, records the batch manifests back to `processing_runs.json` (so the UI can resume/monitor cleanly), and invokes the remote `client.cognify()` process.
- **`scripts/fetch_cognee_graph_snapshot.py`**: Polls the generated graph from the cloud and dumps a localized visualization snapshot (`public/cognee/graph.json`) as a fallback so the frontend works even when offline.
- **`scripts/fetch_cognee_answers_snapshot.py`**: Executes the predefined intelligence queries to generate chunked source records and LLM text generation answers, caching them at `public/cognee/answers.json`.

## End-to-End Use Case: Processing a New Email

To understand how data flows through knexus, consider the lifecycle of a newly ingested email:

1. **Discovery & UI Selection**: A new email from a monitored user (e.g., `ava-chen`) appears in the raw local seed files. The Next.js Activity Dashboard parses these files and surfaces the email as an "Unprocessed Event".
2. **Admin Action**: An admin views the dashboard, selects the email (or a batch containing the email), and clicks the **Process** button.
3. **API Proxy**: The frontend UI sends an HTTP POST request containing the email metadata to Next.js API route `/api/indexing/jobs/trigger-bulk-ingestion`. This route attaches the JWT session token and proxies the payload to the Java Spring Boot backend.
4. **Persistence & Queueing (Spring Boot)**:
   - The Java backend receives the event, validates it, and immediately saves a pending "Indexing Job" record into **PostgreSQL**.
   - It simultaneously queues a message on the **Kafka** topic (`knowledge-nexus-indexing-group-v5`) and returns a fast `200 OK` response to the frontend.
5. **Graph Construction (Cognee)**:
   - A Kafka consumer in the backend picks up the event, parses the email body, and passes it to the Cognee API (using `cognee.add(...)`).
   - Once all events in the batch are added, a `cognify` step is triggered. Cognee's LLM pipeline parses the email, identifies entities (e.g., the sender, related projects, mentioned Jira tickets), and creates new nodes and relationships in the Knowledge Graph.
6. **Completion**: The Spring Boot worker marks the indexing job as `COMPLETED` in Postgres. The Next.js frontend (which polls for job status via `/api/indexing/jobs/{id}`) updates the UI, moving the email from "Processing" to "Completed", at which point it becomes fully searchable in the Intelligence Portal.
