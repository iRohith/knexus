# Knowledge Nexus (knexus) - System Architecture

Knowledge Nexus (knexus) is an intelligent organizational brain that correlates activity logs across various apps (Slack, Jira, GitHub, etc.) into a cohesive knowledge graph.

## High-Level Architecture

The system is composed of four primary layers:

1. **Frontend (Next.js)**
   - **Framework**: Next.js 16 (App Router)
   - **Language**: TypeScript
   - **State Management**: Zustand
   - **Styling**: Tailwind CSS
   - **Key Responsibilities**:
     - Displays the Activity Dashboard and Intelligence Portal.
     - Acts as an API Gateway proxying requests to the backend (`lib/backend-proxy.ts`).
     - Submits simulated batches of events and polls for processing status.

2. **Backend (Spring Boot)**
   - **Framework**: Java 21, Spring Boot 3
   - **Database**: PostgreSQL (relational persistence)
   - **Message Broker**: Kafka & Zookeeper
   - **Key Responsibilities**:
     - Manages authenticated sessions (`/api/v1/auth`).
     - Handles bulk ingestion of events (`/api/v1/indexing/jobs/trigger-bulk-ingestion`).
     - Publishes events to Kafka topics for asynchronous processing.

3. **Knowledge Graph (Cognee Cloud)**
   - **Provider**: Cognee SDK
   - **Key Responsibilities**:
     - Accepts parsed raw data and cognitively processes it into nodes and edges (the `cognify` step).
     - Allows complex graph querying and semantic search based on cross-application context.

4. **Static Ingestion Pipeline**
   - **Scripts**: Python 3.14 (`ingest_to_cognee.py`, `fetch_cognee_graph_snapshot.py`)
   - **Key Responsibilities**:
     - Seeds initial test datasets directly into Cognee.
     - Pre-computes LLM answers and fetches static graph snapshots for resilient frontend fallbacks.
