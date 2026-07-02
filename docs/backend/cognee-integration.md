# Cognee Cloud Integration

## Overview
Knowledge Nexus (corp-KRC) enforces a strict architectural boundary between business orchestration and AI execution. Spring Boot acts as the orchestrator, and Cognee Cloud acts as a black-box AI infrastructure provider. Spring Boot **never** communicates directly with an LLM; all natural language processing, semantic extraction, and graph traversal are delegated entirely to Cognee via REST APIs.

---

## Responsibilities

### Spring Boot Responsibilities
- **Authentication/Authorization:** Ensuring only valid employees can trigger queries or uploads.
- **Data Persistence:** Storing the raw document text and relational metadata in PostgreSQL.
- **Event Orchestration:** Managing the Kafka pipeline that triggers ingestion.
- **API Wrapping:** Providing an Anti-Corruption Layer (`CogneeClient`) to isolate Cognee's specific API contracts from the core domain.
- **Polling & Retries:** Managing the state machine of indexing jobs and implementing robust backoff strategies for HTTP failures.

### Cognee Cloud Responsibilities
- **Entity & Relationship Extraction:** Parsing raw text to identify key enterprise concepts.
- **Knowledge Graph Construction:** Building and persisting nodes and edges.
- **LLM Interaction:** Communicating with underlying foundational models for reasoning.
- **Graph Traversal:** Navigating the graph to formulate answers to employee questions.
- **Reasoning Generation:** Formatting the traversed path into a JSON "Reasoning Path".

---

## REST Communication Strategy

The integration uses Spring's modern HTTP client (e.g., `RestClient` or `WebClient`). The integration is strictly encapsulated within the `com.corp_krc.backend.integration.cognee` package.

### 1. Upload & Indexing Flow (Asynchronous)
Because knowledge graph construction is computationally expensive, this flow is managed via Kafka consumers to avoid blocking HTTP threads.

1. **`POST /api/v1/add`:** Spring Boot pushes the raw document content and relevant metadata to Cognee.
2. **`POST /api/v1/cognify`:** Spring Boot triggers the actual AI processing phase. Cognee acknowledges immediately and begins processing in the background.
3. **`POST /api/v1/cognify_status` (Polling):** Because Cognee processes asynchronously, Spring Boot implements a polling loop (e.g., every 5 seconds) to check the status (`processing`, `completed`, `failed`).

### 2. Query Flow (Synchronous)
Employee queries are expected to return relatively quickly and are executed synchronously during the HTTP request cycle.

1. **`POST /api/v1/search`:** Spring Boot forwards the user's natural language question.
2. Cognee processes the request, hits its LLMs, traverses the graph, and responds.
3. **Response Handling:** The response contains both the textual `Answer` and a structured JSON `Reasoning Path`. Spring Boot maps this directly to a DTO and passes it to the frontend.

---

## Resiliency Patterns

### Timeout Strategy
- **Connection Timeout:** Strict, short timeout (e.g., 3 seconds) to ensure the backend doesn't hang if Cognee is unreachable.
- **Read Timeout:** 
  - For async endpoints (`/add`, `/cognify`): Moderate timeout (e.g., 10 seconds).
  - For sync endpoints (`/search`): Longer timeout (e.g., 30-60 seconds) to account for LLM generation time.

### Retry Strategy
If a network error or a `5xx` Server Error occurs when communicating with Cognee:
- **Queries (`/search`):** Fails fast. The frontend is informed immediately so the user can try again.
- **Indexing (`/add`, `/cognify`):** Handled by Kafka's backoff policy. The event is retried multiple times with exponential backoff before being routed to a Dead Letter Topic (DLT).

### Error Handling
All HTTP errors returned by Cognee are caught by the `CogneeClient` and translated into a custom `CogneeIntegrationException`. This prevents Spring's generic `RestClientException` from leaking into the core business logic, maintaining the Anti-Corruption Layer.

### Polling Strategy & Status Synchronization
During the `/cognify` phase, Spring Boot must synchronize Cognee's internal status with the `IndexingJob` entity in PostgreSQL.
- **Mechanism:** A synchronous `while` loop with a `Thread.sleep()` (or a reactive delay) is executed within the Kafka consumer thread.
- **Thresholds:** The loop has a maximum iteration count to prevent infinite hanging if Cognee freezes. If the threshold is reached, a timeout exception is thrown, and Kafka handles the retry.
- **Database Sync:** Once polling returns `completed`, the `IndexingService` updates PostgreSQL to `COMPLETED` and publishes the `graph.updated` event.

---

## Data Retrieval

### Knowledge Graph Retrieval
Spring Boot does not query the entire knowledge graph. It relies entirely on Cognee to return the specific sub-graph relevant to a query.

### Reasoning Path Retrieval
When an employee asks a question, Cognee returns a `reasoning_path` JSON object alongside the answer. 
- **Structure:** This JSON contains the specific `Nodes` (e.g., Incidents, Architecture Decisions) and `Edges` (Relationships) traversed by the AI.
- **Backend Role:** Spring Boot treats this JSON as opaque data. It saves it to `QueryHistory` for auditing (using PostgreSQL `JSONB`) and passes it directly to the React frontend for visual rendering.

---

## Future Scalability
- **Webhooks over Polling:** If Cognee implements a webhook architecture in the future, the polling loop in the Kafka consumer can be replaced. Cognee would POST to a Spring Boot endpoint when indexing finishes, significantly reducing backend thread usage.
- **Caching:** Frequently asked questions can be cached at the Spring Boot layer (e.g., using Redis) to avoid hitting the Cognee API, reducing latency and API costs.
