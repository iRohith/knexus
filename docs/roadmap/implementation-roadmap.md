# Implementation Roadmap

This document outlines the phased engineering roadmap for the Knowledge Nexus (corp-KRC) backend. 

## Why this order minimizes blockers
This roadmap is structured bottom-up. By establishing the database and security first (Phase 1), frontend engineers can begin mocking APIs and testing JWT authentication immediately. By building the core CRUD domain next (Phase 2), we establish the data model required for the Kafka payloads. By isolating the Cognee integration into its own phase (Phase 3), we prevent AI infrastructure complexities from delaying standard API development. Finally, connecting the pieces via Kafka (Phase 4) and querying (Phase 5) ensures that all internal dependencies (DB, Security, AI client) are fully tested and stable before the complex asynchronous orchestration begins.

---

## Phase 1: Infrastructure & Foundation
**Objectives:** Establish the development environment, database schemas, and the security perimeter.
**Deliverables:**
- Docker Compose setup (PostgreSQL, Zookeeper, Kafka).
- Base Spring Boot project with database migrations.
- JPA Entity foundations (BaseEntity, auditing fields).
- Spring Security integration (JWT generation and filter chain).
- Global Exception Handler setup.
**Dependencies:** None.
**Acceptance Criteria:**
- Developers can spin up the entire infrastructure locally via `docker-compose up`.
- `/auth/login` successfully returns a valid JWT for seeded admin credentials.
- Secured endpoints return `401 Unauthorized` without a token.
**Risks:** Misconfiguration of JWT secrets or CORS hindering frontend development.
**Estimated Effort:** 1 Week

---

## Phase 2: Core Domain & CRUD APIs
**Objectives:** Build the primary data management APIs to allow the admin frontend to function.
**Deliverables:**
- Entities, Repositories, Services, and Controllers for `Employee`, `Project`, and `Team`.
- Basic `Document` upload API (saving to PostgreSQL only, no AI yet).
- DTOs and Mappers (e.g., MapStruct).
**Dependencies:** Phase 1 (Security & DB).
**Acceptance Criteria:**
- Admin can create, read, update, and delete Employees and Projects.
- Admin can upload a document, and it persists in PostgreSQL with a `PENDING` status.
**Risks:** Over-complicating the domain model early on.
**Estimated Effort:** 1.5 Weeks

---

## Phase 3: AI Integration Layer (Anti-Corruption)
**Objectives:** Build the isolated client that communicates with Cognee Cloud.
**Deliverables:**
- `CogneeClient` using `RestClient`.
- Configuration properties for Cognee API keys and timeouts.
- Request/Response DTOs specifically for the Cognee API.
- Custom `CogneeIntegrationException` handling.
**Dependencies:** Phase 1 (Spring Boot Foundation), Cognee API access.
**Acceptance Criteria:**
- Integration tests successfully hit a sandbox Cognee environment to add a document and check status.
- HTTP `5xx` errors from Cognee are successfully mapped to internal domain exceptions.
**Risks:** Cognee API instability or unexpected rate limits.
**Estimated Effort:** 1 Week

---

## Phase 4: Event-Driven Pipeline (Kafka)
**Objectives:** Connect the Document upload flow to the Cognee integration via asynchronous Kafka messaging.
**Deliverables:**
- `document.uploaded` and `document.uploaded.dlt` topics.
- `DocumentEventProducer` and `DocumentIndexingConsumer`.
- `IndexingService` implementing the polling loop and state machine (`IN_PROGRESS`, `COMPLETED`, `FAILED`).
- Kafka retry policy and Dead Letter Topic (DLT) routing.
**Dependencies:** Phase 2 (Document Entity), Phase 3 (CogneeClient).
**Acceptance Criteria:**
- Uploading a document via the API fires a Kafka event.
- The consumer picks up the event, triggers Cognee, polls for success, and updates the DB status to `COMPLETED`.
- A forced failure (e.g., bad API key) results in the event being routed to the DLT after max retries are exhausted.
**Risks:** Consumer lag or infinite polling loops blocking Kafka threads.
**Estimated Effort:** 2 Weeks

---

## Phase 5: Knowledge Query & Retrieval
**Objectives:** Expose the AI graph capabilities to the end-users.
**Deliverables:**
- `KnowledgeGraphController` and `QueryService`.
- Integration of the Cognee `/search` endpoint.
- `QueryHistory` database auditing.
**Dependencies:** Phase 3 (CogneeClient), Phase 2 (Security context for tracking who asked what).
**Acceptance Criteria:**
- An employee can hit `/knowledge/query` with a natural language string.
- The API returns a synchronous response containing the text answer and the JSON reasoning path.
- The query is logged in the `query_history` table.
**Risks:** High latency from Cognee causing HTTP timeouts on the frontend.
**Estimated Effort:** 1 Week

---

## Phase 6: Hardening & Observability
**Objectives:** Prepare the application for production deployment.
**Deliverables:**
- Prometheus / Actuator metrics (tracking Kafka lag, API latency).
- Centralized logging (MDC with trace IDs).
- Admin dashboard APIs (retrieving paginated indexing jobs, retrying DLT events).
- Comprehensive integration test suite (Testcontainers).
**Dependencies:** All previous phases.
**Acceptance Criteria:**
- Test coverage > 80% for Services.
- All HTTP requests carry a traceable ID through the Kafka pipeline.
- Admin can hit a `/retry` endpoint to re-queue a failed document.
**Risks:** Scope creep on observability features delaying launch.
**Estimated Effort:** 1.5 Weeks
