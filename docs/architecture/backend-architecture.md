# Backend Architecture (Spring Boot)

## Backend Philosophy
The backend of Knowledge Nexus (corp-KRC) is built with a strict separation of concerns, heavily prioritizing decoupling and single-responsibility principles. The Spring Boot application acts as the central nervous system of the enterprise platform. Its primary philosophy is: **Spring Boot orchestrates business logic; Cognee Cloud executes AI.** 

By keeping all LLM interactions, reasoning logic, and graph traversal algorithms out of the Spring Boot application, the backend remains stateless, highly testable, and easily scalable.

## Architectural Goals
- **Decoupling of AI and Business Logic:** AI capabilities evolve faster than enterprise business rules. Decoupling them allows independent scaling and upgrading.
- **Resiliency via Asynchrony:** Heavy AI indexing jobs must not block HTTP threads or affect the user experience. Kafka ensures that these workloads are processed asynchronously.
- **Auditability and Enterprise Standards:** Every action within the platform is securely authenticated, authorized, and logged using standard Spring Security and JPA auditing.
- **Predictable Data Management:** The backend leverages PostgreSQL's relational guarantees for standard domain objects while utilizing `JSONB` for the inherent flexibility required by dynamic document metadata and AI responses.

## Layered Architecture & Separation of Concerns

The application follows a standard N-Tier architecture, enforcing strict unidirectional dependency rules:

```text
+---------------------+
|     Web Layer       | (Controllers, Filters, Exception Handlers)
+---------------------+
           |
           v
+---------------------+
|   Business Layer    | (Services, Event Orchestration)
+---------------------+
           |
    +------+------+
    |             |
    v             v
+-------+     +-------+
|  DB   |     |  API  |
| Layer |     | Layer |
+-------+     +-------+
(Repos)       (Clients)
```

### Dependency Rules
- **Controllers** may only depend on **Services**.
- **Services** may depend on **Repositories**, **Integration Clients**, and **Kafka Producers**.
- **Kafka Consumers** may only depend on **Services** (they act like async controllers).
- **Repositories** and **Integration Clients** depend on nothing above them.

## Layer Responsibilities

### Web Layer (Controllers)
- **Role:** Entry point for all HTTP traffic.
- **Responsibility:** Request routing, payload validation (DTOs), HTTP status code management, and delegating actual work to the Business Layer.
- **Constraint:** Absolutely no business logic, database queries, or external API calls are allowed in this layer.

### Business Layer (Services)
- **Role:** The core of the application.
- **Responsibility:** Enforcing business rules, orchestrating transactions, processing data, and deciding when to publish events.
- **Constraint:** Must not contain HTTP-specific objects (like `HttpServletRequest`). All operations should be transactional where data integrity is required.

### Persistence Layer (Repositories)
- **Role:** Interface to PostgreSQL.
- **Responsibility:** Executing CRUD operations, handling JPA entity mapping, and managing `JSONB` serialization/deserialization.
- **Constraint:** Strictly data access. No business logic.

### Integration Layer (CogneeClient)
- **Role:** The bridge to Cognee Cloud.
- **Responsibility:** Wrapping REST calls to the Cognee API, managing timeouts, handling serialization of Cognee-specific payloads, and translating HTTP errors into domain exceptions (`CogneeException`).
- **Constraint:** Must be treated as a black box by the rest of the application.

### Event Layer (Kafka Producers & Consumers)
- **Role:** Asynchronous messaging backbone.
- **Producers:** Translate domain events into Kafka messages.
- **Consumers:** Listen to Kafka topics and delegate payloads to the appropriate Service method.
- **Constraint:** Consumers do not execute business logic; they only route the event to a Service, ensuring consistent error handling and transaction boundaries.

### Security Layer
- **Role:** Guardian of the application.
- **Responsibility:** Intercepting requests, validating JWTs, loading `UserDetails`, and enforcing role-based access control (RBAC).

## Internal Request Lifecycle

### 1. Document Upload Lifecycle (Asynchronous AI Handoff)

**Why?** Uploading and parsing enterprise documents can be slow. Indexing them via AI is even slower. The backend must immediately acknowledge the upload and process the heavy lifting asynchronously to ensure a responsive UI.

```text
[Client] 
   | (1) POST /documents (Multipart/JSON)
   v
[DocumentController] 
   | (2) Validates DTO
   v
[DocumentService]
   | (3) Saves Document to PostgreSQL (status: PENDING)
   | (4) Saves IndexingJob tracking entity
   | (5) Publishes `document.uploaded` via DocumentEventProducer
   v
[Kafka] ---> (6) Returns 202 Accepted to Client
   |
   v
[DocumentIndexingConsumer]
   | (7) Listens to topic and calls IndexingService
   v
[IndexingService]
   | (8) Updates job status to IN_PROGRESS
   | (9) Calls CogneeService to push data to AI Engine
   v
[Cognee Cloud] ---> (10) Processes data & builds graph
```

### 2. Knowledge Query Lifecycle (Synchronous AI Retrieval)

**Why?** When an employee asks a question, they expect an immediate answer. This operation must be synchronous.

```text
[Client]
   | (1) POST /knowledge/query { "question": "Why use Kafka?" }
   v
[KnowledgeGraphController]
   | (2) Validates query
   v
[QueryService]
   | (3) Authorizes user
   | (4) Calls CogneeService.search(query)
   v
[CogneeClient] ---> [Cognee Cloud] (AI Reasoning)
   |                <--- (Returns Answer + Reasoning Path)
   v
[QueryService]
   | (5) Saves QueryHistory to PostgreSQL (for audit/metrics)
   | (6) Maps Cognee response to KnowledgeQueryResponse DTO
   v
[Client] <--- (7) Returns 200 OK
```

## Scalability Considerations

- **Statelessness:** The Spring Boot application is completely stateless. JWT tokens manage authentication without server-side sessions, meaning the backend can be horizontally scaled infinitely behind a load balancer.
- **Database Connection Pooling:** HikariCP is configured to manage PostgreSQL connections efficiently under load.
- **Kafka Consumer Groups:** If document ingestion becomes a bottleneck, the `knowledge-nexus-indexing-group` consumer group can be scaled horizontally by adding more Spring Boot instances (up to the number of Kafka partitions).
- **Cognee Offloading:** By isolating all graph database and LLM operations in Cognee Cloud, the Spring Boot instances require minimal CPU and RAM, optimizing infrastructure costs.

## Future Extensibility

- **New AI Providers:** If the enterprise decides to move away from Cognee, only the `Integration Layer` (`CogneeClient` and `CogneeService`) needs to be rewritten. The core domain and event flows remain untouched.
- **Real-Time Notifications:** The architecture naturally supports adding Server-Sent Events (SSE) or WebSockets. A new service can listen to the `graph.updated` Kafka topic and push notifications directly to the React frontend when a document finishes indexing.
