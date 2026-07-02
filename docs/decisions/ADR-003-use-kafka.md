# ADR-003: Use Apache Kafka for Asynchronous Event Processing

**Date:** 2026-07-02
**Status:** Accepted

## Context
The Knowledge Nexus (corp-KRC) platform ingests enterprise documents and relies on Cognee Cloud to parse texts, extract entities, and construct a semantic Knowledge Graph. This AI processing is inherently slow, computationally heavy, and unpredictable in duration. 

If the Spring Boot backend were to process document uploads synchronously (by blocking the HTTP thread while waiting for Cognee to finish), the system would suffer from:
1. **Poor User Experience:** Users would experience extreme latency and frequent browser timeouts when uploading documents.
2. **Resource Exhaustion:** Long-running HTTP threads would quickly deplete the application server's thread pool under heavy load.
3. **Data Loss on Failure:** If the backend or Cognee crashed during processing, the document processing state would be lost, requiring the user to manually retry the upload.

We require a robust mechanism to decouple the fast operation of accepting a file from the slow operation of AI processing.

## Decision
We will use **Apache Kafka** as the central event broker for the application. 

When a document is uploaded, Spring Boot will persist the raw file to PostgreSQL, immediately acknowledge the request to the client (`202 Accepted`), and publish a `document.uploaded` event to Kafka. A separate consumer group within the Spring Boot application will poll these events and orchestrate the long-running integration with Cognee Cloud in the background.

## Alternatives Considered

1. **Spring `@Async` (In-Memory Thread Pool):**
   - *Pros:* Zero infrastructural overhead. Trivial to implement.
   - *Cons:* No durability. If the JVM crashes, the in-memory queue is lost. Extremely difficult to scale horizontally or implement robust retry/dead-letter logic across multiple nodes.
2. **RabbitMQ / ActiveMQ (Traditional Message Queues):**
   - *Pros:* Excellent for simple task queues and routing.
   - *Cons:* Lacks the historical replayability and strict ordering guarantees (per partition key) that Kafka provides natively. 
3. **PostgreSQL-Based Queue (e.g., custom polling table):**
   - *Pros:* No additional infrastructure. Transactionally safe with the core data.
   - *Cons:* Polling databases for queue jobs introduces significant lock contention and write load on the primary database as the system scales.

## Consequences

- **Decoupling:** The user-facing API remains highly responsive regardless of how heavily utilized the AI infrastructure is.
- **Durability & Retries:** Events are persisted to disk in Kafka. Transient failures in Cognee will not result in dropped documents; the Kafka consumer will simply retry using an exponential backoff policy until routed to a Dead Letter Topic (DLT).
- **Complexity:** We have introduced a distributed system component. Developers must now reason about eventual consistency, consumer lag, offset management, and idempotent consumer logic.

## Trade-offs
- We trade **operational simplicity** (running a single standalone JVM) for **resiliency and scalability**. Managing a Kafka cluster introduces DevOps overhead.
- We trade **strong consistency** for **eventual consistency**. A user uploading a document cannot immediately query the knowledge graph for its contents; they must rely on UI polling or notifications to know when the document is ready.

## Future Considerations
- **Transactional Outbox Pattern:** Currently, if the database transaction commits but the Kafka network publish fails, we risk an inconsistent state (a pending document with no event). If this theoretical edge case manifests, we will implement the Outbox Pattern to guarantee exactly-once event publication.
- **Stream Processing:** If we later require complex event processing (e.g., windowing multiple document uploads to trigger batch Cognee updates), Kafka positions us perfectly to introduce Kafka Streams.
