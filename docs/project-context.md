# Knowledge Nexus (corp-KRC)

## Project Overview
**Knowledge Nexus (corp-KRC)** is an Enterprise Knowledge Memory Platform. Unlike traditional Retrieval-Augmented Generation (RAG) systems that rely on vector similarity to retrieve disjointed documents, this platform stores enterprise knowledge and constructs a semantic knowledge graph using Cognee Cloud as its AI infrastructure.

## Vision
To provide a reasoning-engine approach to enterprise knowledge discovery. When employees ask natural language questions, the system traverses entities, relationships, historical decisions, incidents, and architectural discussions to generate reasoning-based answers backed by traceable logic, rather than simple keyword matching.

## Goals
- **Graph-Based Reasoning:** Deliver precise answers by tracing relationships across enterprise data.
- **Explainability:** Surface the "reasoning path" used to derive an answer, allowing users to understand the context and origin of the information.
- **Enterprise-Grade Architecture:** Ensure high decoupling, reliability, and clear boundaries between business logic and AI infrastructure.
- **Clear Separation of Concerns:** Maintain a strict boundary where Spring Boot handles domain logic and Cognee handles all AI capabilities.

## High-Level Architecture

The system follows an event-driven, decoupled architecture to separate user-facing operations and business logic from heavy AI indexing tasks.

```text
+----------+      +---------------+      +--------------+
| Frontend | ---> |  Spring Boot  | ---> |  PostgreSQL  |
| (React)  | <--- |   (Backend)   | <--- |  (Database)  |
+----------+      +---------------+      +--------------+
                          |
                          v
                    +-----------+
                    |   Kafka   |
                    | (Events)  |
                    +-----------+
                          |
                          v
                  +---------------+
                  | Cognee Cloud  |
                  |  (AI Engine)  |
                  +---------------+
                          |
                          v
                 +-----------------+
                 | Knowledge Graph |
                 +-----------------+
```

## System Responsibilities

### Spring Boot (Backend)
- Authentication & Authorization
- Business Logic & Domain Rules
- Data Persistence (Relational & Document metadata)
- Asynchronous Event Publishing (Kafka)
- REST APIs serving the Frontend
- Orchestrating calls to Cognee APIs

### Cognee Cloud (AI Infrastructure)
- Knowledge Graph Construction & Maintenance
- Entity & Relationship Extraction
- Semantic Memory Management
- Graph Traversal
- AI Reasoning & LLM Interactions

**Critical Boundary:** Spring Boot treats Cognee strictly as a black-box AI service. Spring Boot NEVER communicates directly with an LLM and houses no AI reasoning logic.

## Technology Stack

### Frontend
- **Framework:** React

### Backend
- **Language:** Java
- **Framework:** Spring Boot 3.5.x
- **Security:** Spring Security (JWT-based)
- **Persistence:** Spring Data JPA, Hibernate
- **Database:** PostgreSQL (utilizing `JSONB` for flexible payloads)
- **Messaging:** Apache Kafka
- **Utilities:** Lombok

### AI Infrastructure
- **Service:** Cognee Cloud API

## Core Architectural Decisions

1. **Database Selection (PostgreSQL):** 
   - PostgreSQL was chosen over MongoDB to maintain a single database architecture.
   - `JSONB` columns are used to store document bodies and flexible metadata, ensuring schema flexibility without sacrificing relational integrity.
   - Frequently queried fields (e.g., status, relationships) remain structured relational columns.

2. **Event-Driven AI Integration:**
   - Kafka is used strictly for asynchronous processing.
   - Document uploads trigger Kafka events (e.g., `document.uploaded`). Consumers orchestrate the handoff to Cognee to prevent blocking HTTP threads.

3. **Backend Philosophy:**
   - **Controllers:** Thin, handling only HTTP routing and request/response mapping.
   - **Services:** House all business logic.
   - **Repositories:** Strictly for database access.
   - **Integration:** External systems (like Cognee) have dedicated clients/services (`CogneeService`) that isolate external communication.
   - **Kafka:** Producers only publish; Consumers only consume and delegate to services. Business logic never calls Cognee directly within a consumer without proper service abstraction.

## High-Level Application Flow

### Document Ingestion Flow
```text
1. Admin uploads document via API
       ↓
2. Spring Boot stores raw document & metadata in PostgreSQL
       ↓
3. Spring Boot publishes `document.uploaded` to Kafka
       ↓
4. Kafka Consumer triggers IndexingService
       ↓
5. Spring Boot pushes data to Cognee Cloud
       ↓
6. Cognee updates Knowledge Graph
       ↓
7. Cognee (or polling service) updates indexing status in DB
       ↓
8. (Optional) Notification dispatched to frontend
```

### Knowledge Query Flow
```text
1. Employee submits natural language question
       ↓
2. Spring Boot routes question to Cognee via REST
       ↓
3. Cognee traverses Knowledge Graph and forms reasoning
       ↓
4. Cognee returns Answer + Reasoning Path
       ↓
5. Spring Boot returns payload to Frontend
       ↓
6. Frontend visualizes Answer and Interactive Graph
```

## Roles and Authorization

Authentication is managed via stateless JWT tokens.

| Role | Permissions |
| :--- | :--- |
| **ADMIN** | Upload documents, Manage employees, Manage projects, Trigger/Monitor indexing. |
| **EMPLOYEE** | Query the knowledge graph, Explore graph nodes, View reasoning paths. |

*(Note: ADMIN implicitly inherits EMPLOYEE capabilities to verify data).*

## Event-Driven Architecture Overview

Kafka ensures resilience and decoupling for long-running AI operations.

**Current Topics:**
- `document.uploaded`: Signals a new document is ready for AI processing.
- `document.failed` / `document.uploaded.dlt`: Captures processing failures.
- `graph.updated`: Signals successful Cognee ingestion.

## Current Project Scope
- Document upload and centralized storage.
- Asynchronous knowledge extraction via Cognee.
- Employee query interface with reasoning path visualization.
- Admin dashboards for job monitoring and user management.

## Out-of-Scope Features
- **Status:** To Be Decided (TBD) (e.g., real-time document editing, third-party HR system sync).

## Future Roadmap
- **Status:** To Be Decided (TBD).

## Current Assumptions
- Cognee API remains accessible via standard REST calls and handles its own scaling.
- Enterprise data fits within the limits of PostgreSQL `JSONB` storage.
- Redwood Company synthetic data (EnterpriseRAG-Bench) accurately represents target production data structures.

## Known TBD Items
- Rate limiting strategy for Cognee API calls.
- Strategy for deleting/purging nodes from the Knowledge Graph when a document is deleted in PostgreSQL.
- Exact schema for the reasoning path payload returned by Cognee to the frontend graph visualization component.

---

## Recommended Additional Documentation

- `api-contracts.md` - Details REST API endpoints, request/response schemas, and JWT expectations.
- `database-schema.md` - Outlines the PostgreSQL ERD, indexing strategies, and JSONB structure definitions.
- `event-catalog.md` - Documents Kafka topics, event payloads, producer/consumer guarantees, and error handling.
- `cognee-integration.md` - Details the specific interactions with Cognee Cloud, including polling mechanisms and retry policies.
