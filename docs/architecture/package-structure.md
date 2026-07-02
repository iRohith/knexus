# Package Structure

## Overview
The `corp-KRC` Spring Boot backend is organized using a feature-folder/layered hybrid approach that enforces strict architectural boundaries. The structure is designed to support the "Spring Boot orchestrates, Cognee executes" philosophy while remaining highly maintainable and testable.

## Dependency Direction
The most critical rule of this architecture is the strict, unidirectional flow of dependencies between layers.

```text
       [Web Layer]
     (Controller / DTO)
             |
             v
    [Business Layer] <--------+
 (Service / Mapper / Graph)   |
             |                |
    +--------+--------+       | (Events)
    |                 |       |
    v                 v       |
 [Persistence]   [Integration]|
 (Repository) (Client / Kafka)|
    |                 |       |
    v                 v       |
 [Entity]        [External] --+
                 (Cognee)
```

- **Controller** depends ONLY on **Service**, **DTO**, and **Mapper**.
- **Service** depends on **Repository**, **Integration**, **Kafka (Producer)**, **Entity**, and **DTO**.
- **Repository** depends ONLY on **Entity**.
- **Entity** depends on NOTHING.
- **Security** and **Exception** cross-cut the application but primarily depend on **Entity** or **DTO**.
- **Kafka Consumers** depend ONLY on **Service** (acting as async entry points).

---

## Package Definitions

### `com.corp_krc.backend.config`
- **Purpose:** Centralized Spring configuration.
- **Responsibilities:** Defining Beans, configuring external libraries, setting up CORS, and configuring RestClients and Kafka topics.
- **Contains:** `SecurityConfig`, `KafkaConfig`, `RestClientConfig`, `CorsConfig`.
- **Never Contains:** Business logic, external API calls, HTTP endpoints.
- **Dependency Rules:** Can depend on `Integration` (properties) and `Security` (filters). Should rarely depend on `Service` or `Repository` unless absolutely necessary for bean initialization.

### `com.corp_krc.backend.controller`
- **Purpose:** The Web/HTTP layer.
- **Responsibilities:** Routing HTTP requests, parsing JSON to DTOs, validating input (`@Valid`), delegating work to the Service layer, and returning standard HTTP responses.
- **Contains:** `DocumentController`, `KnowledgeGraphController`, `EmployeeController`, `IndexingController`.
- **Never Contains:** Business logic, database calls (`Repository`), or external API calls (`CogneeClient`).
- **Internal Communication:** Injects `Service` beans. Returns `ResponseEntity<DTO>`.

### `com.corp_krc.backend.service`
- **Purpose:** The Business Logic layer.
- **Responsibilities:** Enforcing domain rules, orchestrating transactions (`@Transactional`), deciding when to publish Kafka events, and coordinating calls to the Integration layer.
- **Contains:** `DocumentService`, `QueryService`, `IndexingService`, `AuthService`.
- **Never Contains:** HTTP-specific objects (`HttpServletRequest`, `ResponseEntity`), or raw SQL queries.
- **Internal Communication:** Injects `Repository`, `Producer` (from `kafka`), and `Client` (from `integration`) beans. Returns domain objects or DTOs to the `Controller`.

### `com.corp_krc.backend.repository`
- **Purpose:** The Persistence layer.
- **Responsibilities:** Interacting with PostgreSQL via Spring Data JPA.
- **Contains:** `DocumentRepository`, `EmployeeRepository`, `IndexingJobRepository`, `QueryHistoryRepository`.
- **Never Contains:** Business logic, DTOs, or HTTP routing logic.
- **Dependency Rules:** Depends strictly on `Entity` classes.

### `com.corp_krc.backend.entity`
- **Purpose:** The Domain Model.
- **Responsibilities:** Representing database tables, relationships, and JSONB mappings.
- **Contains:** `Document`, `Employee`, `IndexingJob`, `QueryHistory`, Enums (`DocumentType`, `IndexingStatus`).
- **Never Contains:** Spring stereotype annotations (like `@Service`), references to `DTOs`, or complex business behavior requiring dependency injection.
- **Dependency Rules:** The core of the application. It depends on NO other internal packages.

### `com.corp_krc.backend.dto`
- **Purpose:** Data Transfer Objects.
- **Responsibilities:** Defining the strict shape of JSON payloads for incoming requests (`dto.request`) and outgoing responses (`dto.response`).
- **Contains:** `DocumentUploadRequest`, `KnowledgeQueryResponse`, `ApiErrorResponse`, `PagedResponse`.
- **Never Contains:** Business logic, JPA annotations (`@Entity`, `@Table`), or references to domain entities.
- **Dependency Rules:** Depends on standard Java validation annotations (`jakarta.validation`).

### `com.corp_krc.backend.mapper`
- **Purpose:** Object mapping layer.
- **Responsibilities:** Translating between `Entity` objects and `DTO` objects to ensure the `Controller` layer never leaks database structures to the frontend.
- **Contains:** `DocumentMapper`, `EmployeeMapper`, `QueryMapper`.
- **Never Contains:** Business logic, database saves, or external service calls.
- **Dependency Rules:** Depends purely on `Entity` and `DTO` packages.

### `com.corp_krc.backend.exception`
- **Purpose:** Global error handling.
- **Responsibilities:** Defining custom domain exceptions and globally catching them via `@RestControllerAdvice` to translate into standard JSON API error responses.
- **Contains:** `GlobalExceptionHandler`, `ResourceNotFoundException`, `CogneeIntegrationException`.
- **Never Contains:** Business logic or HTTP routing.
- **Internal Communication:** `GlobalExceptionHandler` intercepts exceptions thrown by `Service` or `Integration` and returns an `ApiErrorResponse`.

### `com.corp_krc.backend.security`
- **Purpose:** Application security and access control.
- **Responsibilities:** JWT generation/validation, extracting authentication headers, defining security filter chains, and loading user details from the database.
- **Contains:** `JwtTokenProvider`, `JwtAuthenticationFilter`, `CustomUserDetailsService`, `CustomAuthenticationEntryPoint`.
- **Never Contains:** General business logic unrelated to authentication.
- **Dependency Rules:** Intercepts traffic before it reaches the `Controller`. Depends on `Repository` (to look up users) and `Entity`.

### `com.corp_krc.backend.integration`
- **Purpose:** External system clients (Anti-Corruption Layer).
- **Responsibilities:** Wrapping external APIs (Cognee Cloud), managing HTTP timeouts, translating external JSON payloads into internal DTOs, and catching generic HTTP errors to throw specific domain exceptions.
- **Contains:** `cognee.CogneeClient`, `cognee.CogneeApiProperties`, `cognee.CogneeSearchResponse`.
- **Never Contains:** Core enterprise business logic or references to database repositories.
- **Internal Communication:** Called exclusively by the `Service` layer (e.g., `CogneeService` delegates to `CogneeClient`).

### `com.corp_krc.backend.kafka`
- **Purpose:** Event-driven messaging layer.
- **Responsibilities:** Defining event payloads (`kafka.event`), producing messages (`kafka.producer`), and consuming messages (`kafka.consumer`).
- **Contains:** `DocumentEventProducer`, `DocumentIndexingConsumer`, `DltConsumer`, `DocumentUploadedEvent`.
- **Never Contains:** Business logic. Consumers MUST immediately delegate to a `Service`. Producers MUST be called by a `Service`.
- **Dependency Rules:** Consumers depend on `Service`. Events depend only on primitive types or specific Enums.

### `com.corp_krc.backend.graph`
- **Purpose:** Knowledge Graph data structuring (Backend-side formatting).
- **Responsibilities:** Handling any complex transformation of reasoning paths or graph node data returned by Cognee before sending it to the frontend for D3.js/ReactFlow rendering.
- **Contains:** Graph visualization builders, reasoning path formatters.
- **Never Contains:** Actual graph traversal algorithms, vector math, or LLM prompts (these belong strictly in Cognee).
- **Dependency Rules:** Called exclusively by `QueryService`.

### `com.corp_krc.backend.notification` (Future / TBD)
- **Purpose:** Real-time client updates.
- **Responsibilities:** Managing WebSockets or Server-Sent Events (SSE) to push status updates (like `INDEXING_COMPLETED`) to the frontend.
- **Contains:** SSE Controllers, WebSocket handlers.
- **Never Contains:** Database logic or core business services.
- **Internal Communication:** Triggered by `Kafka Consumers` or `Service` events.

### `com.corp_krc.backend.util`
- **Purpose:** Shared utility functions.
- **Responsibilities:** Providing stateless, pure functions used across multiple layers.
- **Contains:** String manipulators, Date formatters, JSON parsing helpers.
- **Never Contains:** State, beans requiring dependency injection (`@Autowired`), business logic, or external API calls.
- **Dependency Rules:** Depends on NOTHING. Can be used universally.
