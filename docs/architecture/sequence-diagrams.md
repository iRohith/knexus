# Sequence Diagrams

This document contains Mermaid sequence diagrams illustrating the exact step-by-step interactions between system components for the core workflows of the Knowledge Nexus (corp-KRC) platform.

---

## 1. Authentication (User Login)

**Participants:**
- **Client:** The React frontend application.
- **AuthController:** The REST endpoint receiving the request.
- **AuthService:** Orchestrates the authentication logic.
- **CustomUserDetailsService:** Loads the user from the database.
- **PostgreSQL:** The database storing employee credentials.
- **JwtTokenProvider:** Utility that generates signed JWTs.

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant AuthController
    participant AuthService
    participant CustomUserDetailsService
    participant PostgreSQL
    participant JwtTokenProvider

    Client->>AuthController: POST /auth/login (email, password)
    AuthController->>AuthService: login(LoginRequest)
    AuthService->>CustomUserDetailsService: loadUserByUsername(email)
    CustomUserDetailsService->>PostgreSQL: SELECT * FROM employees WHERE email = ?
    PostgreSQL-->>CustomUserDetailsService: Employee Entity
    CustomUserDetailsService-->>AuthService: UserDetails
    AuthService->>AuthService: Verify Password Hash
    
    alt Password Matches
        AuthService->>JwtTokenProvider: generateAccessToken(authentication)
        JwtTokenProvider-->>AuthService: JWT String
        AuthService-->>AuthController: AuthResponse (JWT + User Info)
        AuthController-->>Client: 200 OK
    else Invalid Credentials
        AuthService-->>AuthController: BadCredentialsException
        AuthController-->>Client: 401 Unauthorized
    end
```

---

## 2. Upload Document & Kafka Processing

**Participants:**
- **Admin Client:** The React frontend (Admin Portal).
- **DocumentController:** REST endpoint receiving the document payload.
- **DocumentService:** Handles database persistence and event publishing.
- **PostgreSQL:** Stores the raw document and indexing status.
- **DocumentEventProducer:** Kafka producer wrapper.
- **Kafka:** The message broker.

```mermaid
sequenceDiagram
    autonumber
    actor Admin Client
    participant DocumentController
    participant DocumentService
    participant PostgreSQL
    participant DocumentEventProducer
    participant Kafka

    Admin Client->>DocumentController: POST /documents (DocumentUploadRequest)
    DocumentController->>DocumentService: uploadDocument(request)
    
    DocumentService->>PostgreSQL: INSERT INTO documents (status: PENDING)
    PostgreSQL-->>DocumentService: Document Entity (with UUID)
    
    DocumentService->>PostgreSQL: INSERT INTO indexing_jobs (status: PENDING)
    PostgreSQL-->>DocumentService: IndexingJob Entity
    
    DocumentService->>DocumentEventProducer: publishDocumentUploaded(event)
    DocumentEventProducer->>Kafka: Produce `document.uploaded` (Key: documentId)
    
    DocumentService-->>DocumentController: DocumentResponse
    DocumentController-->>Admin Client: 202 Accepted
```

---

## 3. Cognee Indexing & Graph Update

**Participants:**
- **Kafka:** Message broker delivering the event.
- **DocumentIndexingConsumer:** Listens to the `document.uploaded` topic.
- **IndexingService:** Orchestrates the AI pipeline.
- **PostgreSQL:** Tracks job status.
- **CogneeService:** Business logic layer for Cognee interactions.
- **CogneeClient:** Anti-corruption layer (HTTP client).
- **Cognee Cloud:** The external AI engine and Knowledge Graph.
- **GraphEventProducer:** Publishes the final success event.

```mermaid
sequenceDiagram
    autonumber
    participant Kafka
    participant DocumentIndexingConsumer
    participant IndexingService
    participant PostgreSQL
    participant CogneeService
    participant CogneeClient
    participant Cognee Cloud
    participant GraphEventProducer

    Kafka-->>DocumentIndexingConsumer: Consume `document.uploaded`
    DocumentIndexingConsumer->>IndexingService: processIndexing(documentId)
    
    IndexingService->>PostgreSQL: UPDATE indexing_jobs SET status = 'IN_PROGRESS'
    
    IndexingService->>CogneeService: indexDocument(document)
    CogneeService->>CogneeClient: addDocument(CogneeAddRequest)
    CogneeClient->>Cognee Cloud: POST /api/v1/add
    Cognee Cloud-->>CogneeClient: 200 OK
    
    CogneeService->>CogneeClient: triggerCognify()
    CogneeClient->>Cognee Cloud: POST /api/v1/cognify
    Cognee Cloud-->>CogneeClient: 200 OK
    
    loop Polling (Every 2 seconds)
        CogneeService->>CogneeClient: checkCognifyStatus()
        CogneeClient->>Cognee Cloud: POST /api/v1/cognify_status
        Cognee Cloud-->>CogneeClient: Status ('processing' or 'completed')
    end
    
    CogneeService-->>IndexingService: Void (Success)
    
    IndexingService->>PostgreSQL: UPDATE indexing_jobs SET status = 'COMPLETED'
    
    IndexingService->>GraphEventProducer: publishGraphUpdated()
    GraphEventProducer->>Kafka: Produce `graph.updated`
```

---

## 4. Employee Query & Knowledge Graph Retrieval

**Participants:**
- **Employee Client:** React frontend (User Portal).
- **KnowledgeGraphController:** REST endpoint receiving the question.
- **QueryService:** Business logic for query tracking.
- **CogneeService:** Wraps query logic for AI.
- **CogneeClient:** HTTP client.
- **Cognee Cloud:** AI Engine traversing the graph.
- **PostgreSQL:** Stores audit logs of queries.

```mermaid
sequenceDiagram
    autonumber
    actor Employee Client
    participant KnowledgeGraphController
    participant QueryService
    participant CogneeService
    participant CogneeClient
    participant Cognee Cloud
    participant PostgreSQL

    Employee Client->>KnowledgeGraphController: POST /knowledge/query (question)
    KnowledgeGraphController->>QueryService: executeQuery(question, email)
    
    QueryService->>CogneeService: search(question)
    CogneeService->>CogneeClient: search(CogneeSearchRequest)
    CogneeClient->>Cognee Cloud: POST /api/v1/search
    
    Note over Cognee Cloud: Traverses Graph,<br/>Formulates Reasoning,<br/>Generates Answer
    
    Cognee Cloud-->>CogneeClient: JSON (Answer + Reasoning Path)
    CogneeClient-->>CogneeService: CogneeSearchResponse
    CogneeService-->>QueryService: CogneeSearchResponse
    
    QueryService->>PostgreSQL: INSERT INTO query_history (question, response, reasoning_path)
    
    QueryService-->>KnowledgeGraphController: KnowledgeQueryResponse
    KnowledgeGraphController-->>Employee Client: 200 OK (with Reasoning Path for visualization)
```

---

## 5. Document Failure Flow

**Participants:**
- **IndexingService:** Encounters an error during processing.
- **CogneeService:** Throws an exception.
- **PostgreSQL:** Stores failure state and retry count.
- **DocumentEventProducer:** Publishes failure events.
- **Kafka (DLT):** Dead Letter Topic for unrecoverable errors.
- **DltConsumer:** Logs the fatal error.

```mermaid
sequenceDiagram
    autonumber
    participant IndexingService
    participant CogneeService
    participant PostgreSQL
    participant DocumentEventProducer
    participant Kafka

    IndexingService->>CogneeService: indexDocument(document)
    CogneeService--xIndexingService: throws CogneeException (e.g. Timeout)
    
    IndexingService->>PostgreSQL: UPDATE indexing_jobs SET status = 'FAILED', retry_count = retry_count + 1
    
    IndexingService->>DocumentEventProducer: publishIndexingFailed()
    DocumentEventProducer->>Kafka: Produce `document.indexing.failed`
    
    alt Retry Count < Max Retries
        Note over Kafka: Event sits in queue until<br/>Admin triggers manual retry
    else Max Retries Exceeded
        Note over IndexingService: Routes to Dead Letter Topic
        DocumentEventProducer->>Kafka: Produce `document.uploaded.dlt`
        Kafka-->>DltConsumer: Consume `document.uploaded.dlt`
        Note over DltConsumer: Log fatal error for Admin intervention
    end
```
