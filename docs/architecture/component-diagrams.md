# Component Diagrams

This document visualizes the interactions between major components within the Knowledge Nexus (corp-KRC) platform. These diagrams focus on data flow and system boundaries rather than implementation details.

---

## 1. Overall System Architecture

This diagram illustrates the high-level boundary between the user-facing web application, the orchestrating backend, and the AI infrastructure.

```text
+-------------------+      HTTPS      +------------------------+
|                   |   (REST APIs)   |                        |
|   React Frontend  | <=============> |  Spring Boot Backend   |
|   (User Portal &  |                 |  (Business Logic &     |
|   Admin Dashboard)|                 |   Access Control)      |
|                   |                 |                        |
+-------------------+                 +------------------------+
                                         |                  |
                                         | (JDBC)           | (Async Events)
                                         v                  v
                              +----------------+      +----------------+
                              |   PostgreSQL   |      | Apache Kafka   |
                              | (Docs, Users,  |      | (Event Bus)    |
                              |  Metadata)     |      +----------------+
                              +----------------+            |
                                                            v
                                                      +----------------+
                                                      |  Cognee Cloud  |
                                                      |  (AI Engine)   |
                                                      +----------------+
                                                            |
                                                            v
                                                      +----------------+
                                                      |Knowledge Graph |
                                                      +----------------+
```
**Description:** The frontend communicates strictly with Spring Boot. Spring Boot manages state in PostgreSQL and publishes events to Kafka. Kafka decouples heavy AI tasks, allowing Cognee to process data asynchronously and update the Knowledge Graph.

---

## 2. Backend Modules

This diagram shows the internal module structure of the Spring Boot application and how dependencies flow unidirectionally.

```text
+-------------------------------------------------------------+
|                     Web Layer (Controllers)                 |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                   Business Layer (Services)                 |
+-------------------------------------------------------------+
          |                   |                   |
          v                   v                   v
+----------------+    +----------------+  +-------------------+
|  Persistence   |    | Event Pipeline |  | Integration Layer |
| (Repositories) |    |   (Kafka)      |  |  (CogneeClient)   |
+----------------+    +----------------+  +-------------------+
          |                   |                   |
          v                   v                   v
    [PostgreSQL]           [Kafka]         [Cognee Cloud API]
```
**Description:** Controllers route to Services. Services orchestrate transactions and decide when to talk to Repositories, Kafka, or external Integrations. Dependencies flow downward.

---

## 3. Authentication Flow

This diagram illustrates the stateless JWT security model.

```text
[Client]                      [AuthFilter]                  [AuthService]             [Database]
   |                               |                              |                       |
   | 1. POST /auth/login           |                              |                       |
   |------------------------------------------------------------> |                       |
   |                               |                              | 2. Verify Credentials |
   |                               |                              |---------------------> |
   |                               |                              | <-------------------- |
   |                               |                              |                       |
   | 3. Returns JWT (200 OK)       |                              |                       |
   | <----------------------------------------------------------- |                       |
   |                               |                              |                       |
   | 4. GET /knowledge/search      |                              |                       |
   |    (Header: Bearer <token>)   |                              |                       |
   |-----------------------------> |                              |                       |
   |                               | 5. Validate Token Signature  |                       |
   |                               |----------------              |                       |
   |                               |               |              |                       |
   |                               | <--------------              |                       |
   |                               |                              |                       |
   |                               | 6. Set SecurityContext       |                       |
   |                               |    & Forward to Controller   |                       |
   |                               |----------------------------> |                       |
```
**Description:** Login generates a signed JWT. Subsequent requests carry the token in the `Authorization` header. The `JwtAuthenticationFilter` validates the signature without querying the database (unless loading specific user roles is required).

---

## 4. Document Upload Lifecycle

This diagram demonstrates the immediate acknowledgement of a document upload and the subsequent asynchronous processing.

```text
[Admin Client]           [Spring Boot]            [PostgreSQL]             [Kafka]
      |                        |                       |                      |
      | 1. POST /documents     |                       |                      |
      |----------------------> |                       |                      |
      |                        | 2. Save Document      |                      |
      |                        |    (Status: PENDING)  |                      |
      |                        |---------------------> |                      |
      |                        |                       |                      |
      |                        | 3. Publish Event      |                      |
      |                        |--------------------------------------------> |
      | 4. Returns 202 Accepted|                       |                      |
      | <----------------------|                       |                      |
```
**Description:** The HTTP request is unblocked as soon as the document is persisted and the event is dispatched to Kafka, ensuring a fast user experience regardless of AI indexing speed.

---

## 5. Kafka Event Pipeline

This diagram focuses on the messaging architecture and how errors are handled via a Dead Letter Topic (DLT).

```text
[DocumentEventProducer] 
          |
          | (document.uploaded)
          v
+-------------------+
| Kafka Topic:      |
| document.uploaded |
+-------------------+
          |
          v
[DocumentIndexingConsumer] ----> [IndexingService]
                                        |
                                        |----> [CogneeService] (Success)
                                        |
                                        +----> (Exception / Failure)
                                                      |
                                                      | (retry limit exceeded)
                                                      v
                                            +-----------------------+
                                            | Kafka Topic:          |
                                            | document.uploaded.dlt |
                                            +-----------------------+
                                                      |
                                                      v
                                                [DltConsumer] (Logs Alert)
```
**Description:** Producers emit events to the main topic. Consumers attempt to process them via the `IndexingService`. If processing fails and retries are exhausted, the event is routed to a DLT for manual intervention.

---

## 6. Cognee Integration

This diagram shows how Spring Boot isolates the Cognee API behind an Anti-Corruption Layer (ACL).

```text
[Business Logic]
 (QueryService / IndexingService)
        |
        |  1. Calls Internal Domain Methods
        v
+-----------------------------------+
|           CogneeService           | (Handles Polling, Logic, Retries)
+-----------------------------------+
        |
        |  2. Calls HTTP Methods via DTOs
        v
+-----------------------------------+
|           CogneeClient            | (Anti-Corruption Layer)
+-----------------------------------+
        |
        |  3. REST / JSON / HTTP
        v
  [Cognee Cloud API]
```
**Description:** The rest of the application does not know HTTP exists. `CogneeClient` translates HTTP/JSON into Java DTOs. `CogneeService` orchestrates these client calls into meaningful business workflows (like upload -> trigger -> poll).

---

## 7. Knowledge Graph Retrieval & Employee Query

This diagram visualizes a synchronous employee query hitting the knowledge graph.

```text
[Employee Client]        [Spring Boot]            [Cognee Cloud]         [Knowledge Graph]
       |                       |                        |                        |
       | 1. POST /query        |                        |                        |
       |    "Why Kafka?"       |                        |                        |
       |---------------------> |                        |                        |
       |                       | 2. Forward Query       |                        |
       |                       |----------------------> |                        |
       |                       |                        | 3. Traverses Graph     |
       |                       |                        |----------------------> |
       |                       |                        | <----------------------|
       |                       |                        |                        |
       |                       | 4. Returns Answer +    |                        |
       |                       |    Reasoning Path JSON |                        |
       |                       | <----------------------|                        |
       |                       |                        |                        |
       |                       | 5. Save QueryHistory   |                        |
       |                       |    to PostgreSQL       |                        |
       | 6. Return Response    |                        |                        |
       | <---------------------|                        |                        |
```
**Description:** Queries are synchronous. Cognee executes the LLM reasoning and graph traversal. Spring Boot acts as a pass-through proxy while logging the query history to PostgreSQL for auditing.

---

## 8. Graph Visualization

This diagram explains how the reasoning path is delivered to the frontend for interactive visualization.

```text
[Cognee Cloud] 
      |
      | 1. Returns JSON Reasoning Path
      |    (Nodes: [Incident, Decision, Kafka])
      |    (Edges: [Caused_By, Solved_With])
      v
[Spring Boot]
      |
      | 2. Wraps in KnowledgeQueryResponse DTO
      |    (No internal processing of graph math)
      v
[React Frontend]
      |
      | 3. Parses Nodes and Edges
      v
+------------------------------------+
|  ReactFlow / D3.js Component       |
|                                    |
|   (Incident) ----> (Decision)      |
|                        |           |
|                        v           |
|                     (Kafka)        |
+------------------------------------+
```
**Description:** Spring Boot does not perform graph analytics. It simply routes the JSON representation of the reasoning path from Cognee to the React frontend, where libraries like ReactFlow or D3.js render it interactively for the employee.
