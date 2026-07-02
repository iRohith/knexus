# Project Milestones

This document tracks the high-level, measurable milestones required to deliver the Knowledge Nexus (corp-KRC) platform from inception to a Demo-Ready state.

---

## Milestone 1: Authentication & Foundation
**Goal:** Establish a secure perimeter and operational database.
**Success Criteria:**
- `docker-compose up` successfully starts PostgreSQL, Zookeeper, and Kafka.
- The `/auth/login` endpoint accepts valid admin credentials and returns a signed JWT.
- Any request without a valid JWT is blocked with a `401 Unauthorized` status.
- Database migrations (schema creation) execute automatically on startup.

## Milestone 2: Backend MVP (Core CRUD)
**Goal:** Enable basic administrative data management without AI components.
**Success Criteria:**
- Admin can create, read, update, and delete `Employee` and `Project` records via REST APIs.
- Admin can upload a `Document` payload, and it persists in PostgreSQL with a `PENDING` indexing status.
- Endpoints enforce Role-Based Access Control (RBAC), rejecting `EMPLOYEE` tokens for admin routes with `403 Forbidden`.

## Milestone 3: Cognee Integration (Anti-Corruption Layer)
**Goal:** Establish isolated, successful communication with the external AI engine.
**Success Criteria:**
- The `CogneeClient` successfully authenticates with the Cognee Cloud Sandbox API.
- A hardcoded test document is successfully pushed to the `/add` and `/cognify` endpoints.
- HTTP `5xx` errors from the sandbox are successfully caught and mapped to `CogneeIntegrationException`.

## Milestone 4: Kafka Event Pipeline
**Goal:** Wire the document upload flow to the Cognee integration asynchronously.
**Success Criteria:**
- Uploading a document via the `/documents` API instantly returns `202 Accepted` and publishes a `document.uploaded` event to Kafka.
- The `DocumentIndexingConsumer` picks up the event, triggers the `CogneeService`, polls for status, and updates the database to `COMPLETED`.
- If Cognee is mocked to fail, the Kafka consumer retries 3 times before successfully routing the event to the `document.uploaded.dlt` (Dead Letter Topic).

## Milestone 5: Graph Retrieval & Employee Queries
**Goal:** Enable users to ask questions and receive AI-generated answers with reasoning.
**Success Criteria:**
- An employee can submit a question to the `/knowledge/query` endpoint.
- The API returns a synchronous `200 OK` containing the textual answer and the JSON reasoning path (nodes and edges).
- The query and its execution time are successfully logged in the `query_history` database table.

## Milestone 6: Testing & Observability
**Goal:** Ensure the backend is stable, measurable, and resilient to edge cases.
**Success Criteria:**
- Integration test suite passes in CI using Testcontainers for PostgreSQL and Kafka.
- Actuator endpoints (`/actuator/health`, `/actuator/metrics`) are exposed.
- Admin can hit a `/indexing/jobs/{id}/retry` endpoint to manually re-queue a job from the DLT.

## Milestone 7: Frontend Integration
**Goal:** Connect the React user interfaces to the Spring Boot backend.
**Success Criteria:**
- Admin Portal successfully renders a paginated dashboard of `IndexingJobs` polled from the backend.
- User Portal allows an employee to log in, store the JWT securely, and submit a query.
- CORS is successfully negotiated between the frontend dev server (`localhost:3000`/`5173`) and the backend.

## Milestone 8: Demo Ready (End-to-End)
**Goal:** A fully functional, demonstrable platform ready for hackathon judging or stakeholder review.
**Success Criteria:**
- **Zero-Touch Ingestion:** Admin uploads a document via the UI; the UI shows it as "Pending," and it updates to "Complete" automatically (via UI polling).
- **Interactive Graph:** Employee queries the system via the UI; the textual answer appears alongside an interactive visual graph (ReactFlow/D3.js) mapping the exact reasoning path returned by Cognee.
- **Auditability:** Admin can view a log of all queries made during the demo.

---

## Stretch Goals (Post-MVP)
- **WebSockets / SSE:** Replace UI polling with Server-Sent Events to push real-time indexing status updates to the Admin dashboard.
- **Granular RBAC:** Expand the `ADMIN` and `EMPLOYEE` enum into a fully relational `Permissions` table for document-level access control.
- **Query Caching:** Implement Redis to cache frequent questions (e.g., "What is the Wi-Fi password?") to bypass Cognee API latency.
