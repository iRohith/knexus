# Knexus

Knexus is an enterprise knowledge operating system that connects workplace activity, internal documents, and collaboration history to a Cognee-powered knowledge graph. It is designed to show how an organization can move from scattered operational data to a living semantic memory layer that can be searched, inspected, updated, and governed.

The core idea is simple: the product interface and the knowledge graph should be grounded in the same data. Knexus uses a static seed corpus for fast, low-cost reads, then records user and system changes as global patch batches. Those changes can be reviewed, processed, and indexed into Cognee so the graph evolves with the workspace instead of becoming a separate stale artifact.

## What Knexus Does

Knexus provides a full workflow for enterprise knowledge ingestion and retrieval:

- Collects structured activity from multiple workplace domains into a normalized corpus.
- Serves read-heavy data from small static JSON files for fast client-side loading.
- Tracks user-generated changes as replayable patch batches rather than rewriting seed data.
- Lets an administrator review activity before it is submitted for indexing.
- Persists indexing jobs in Postgres and tracks their processing state globally.
- Integrates with Cognee as the semantic graph and retrieval layer.
- Provides a visual knowledge graph for exploring entities, sources, and relationships.
- Supports authenticated access with role-based controls around graph/indexing operations.

## Why It Matters

Enterprise knowledge is usually fragmented across communication, documentation, planning, and customer systems. Search alone is not enough, because useful answers often depend on relationships: who authored something, which project it supports, what customer it affects, what changed later, and which source proves the claim.

Knexus models that relationship layer explicitly. The system keeps operational records, user changes, indexing history, and graph retrieval connected, making it possible to trace a knowledge answer back to the same underlying events and documents visible in the UI.

## System Architecture

Knexus has three major layers.

### 1. Static Knowledge Surface

The frontend reads from a normalized seed corpus under `public/seed`. The corpus is split into small app, company, and processing files so the UI only loads the data it needs. This makes the application suitable for static-first deployment on Cloudflare Workers while still feeling like a rich enterprise workspace.

This layer is intentionally treated as fixed seed data. It represents the baseline organizational memory.

### 2. Patch and Processing Layer

New changes are not written back into the seed corpus. Instead, they are stored as global patch batches in Postgres. This gives Knexus an append-only model for incremental updates:

- create/update/delete operations are captured as patches;
- patches are shared globally across users;
- batches can be replayed over the seed corpus;
- indexing activity is stored separately as processing jobs and history.

The admin workflow uses this layer to decide which activity should become part of the knowledge graph.

### 3. Cognee Knowledge Layer

Cognee is used as the semantic memory system. Selected activity is transformed into ingested documents, registered as indexing jobs, and prepared for Cognee ingestion. Query responses are normalized back into the frontend as answers, citations, and graph context.

The result is a closed loop:

1. source activity appears in the product;
2. the admin selects relevant events;
3. the backend stores and queues them;
4. Cognee indexes the semantic content;
5. the graph and answer UI expose the resulting knowledge.

## Cognee Integration

The backend contains a dedicated Cognee integration layer:

- `CogneeClient` wraps API communication with Cognee.
- `CogneeService` coordinates add/search/status behavior.
- `QueryController` exposes knowledge query endpoints.
- `IndexingController` accepts selected activity and creates indexing jobs.
- `IndexingService` maps ingested documents into backend document and job records.

Cognee can be disabled for local development, allowing the indexing and job lifecycle to be tested without an external API key. When enabled, the same flow can send documents to a live Cognee API and retrieve graph-backed answers.

## Key Capabilities

### Unified Knowledge Corpus

The seed builder normalizes company data, people, projects, documents, and app activity into a consistent structure. Each record carries source metadata so the graph can preserve provenance.

### Incremental Updates

Knexus separates immutable seed data from mutable user changes. This keeps the static corpus cheap and cacheable while still allowing the system to evolve through database-backed patches.

### Admin-Controlled Indexing

Knowledge graph updates are not automatic noise. The admin panel provides a review and processing step so only selected activity is submitted into the indexing pipeline.

### Global Processing History

Processing state is shared globally. Once a batch is submitted, it leaves the active queue and appears in history with job status, source records, and processing metadata.

### Graph Exploration

The knowledge graph view gives users a visual way to inspect semantic relationships, sources, and evidence paths. It is designed to make graph-backed answers auditable rather than opaque.

### Secure Access

Authentication is handled by the Spring Boot backend using JWT access and refresh tokens. Next.js API routes proxy backend calls and refresh tokens automatically. Administrative graph and indexing endpoints are restricted to the admin role.

## Technology Stack

- **Frontend**: Next.js, React, Tailwind CSS, Zustand
- **Backend**: Spring Boot, Spring Security, JPA/Hibernate
- **Database**: Postgres
- **Queueing**: Kafka
- **Knowledge Graph**: Cognee
- **Deployment target**: Cloudflare Workers via OpenNext

## Data Model Philosophy

Knexus uses two complementary data models:

- **Seed data** is static, normalized, and optimized for fast reads.
- **Patch data** is dynamic, append-only, and stored in Postgres.

This avoids forcing every UI read through the backend while still preserving a trustworthy update stream. It also gives Cognee a clean ingestion boundary: the graph can be built from the same seed-plus-patch state that the user sees.

## Security and Governance

Knexus includes role-aware access controls around sensitive operations:

- normal users can access the workspace experience;
- the admin user can process activity into the indexing pipeline;
- backend endpoints validate JWTs and roles;
- refresh tokens keep long sessions usable without exposing credentials to client code;
- patch and processing history remain globally consistent rather than browser-local.

## Repository Structure

```text
app/
  admin/              Activity review, processing, and history
  api/                Next.js route handlers that proxy backend APIs
  knowledge-graph/    Full-screen graph workbench
  GraphPanel.tsx      Knowledge graph visualization

lib/
  seed-data.ts        Static seed loading
  stores/             Patch and user state
  cognee-adapter.ts   Cognee response normalization
  cognee-static-graph.ts

public/seed/
  company/            Company context and organization data
  apps/               Static app corpus
  processing_runs.json

backend/backend/
  controller/         Auth, patch, indexing, and knowledge APIs
  service/            Business logic and Cognee orchestration
  integration/cognee/ Cognee client and request/response models
  kafka/              Indexing event flow
  entity/             Postgres persistence model
```

## Running Locally

The application has a Next.js frontend and a Spring Boot backend. The backend expects Postgres and Kafka. Cognee can be left disabled for local runs, or enabled with a Cognee base URL and API key.

Frontend environment:

```bash
API_URL=http://localhost:8080
```

Backend environment:

```bash
DATABASE_URL=jdbc:postgresql://localhost:5432/corpKRC
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
JWT_SECRET=<secure-jwt-secret>
COGNEE_ENABLED=false
COGNEE_BASE_URL=<optional-cognee-url>
COGNEE_API_KEY=<optional-cognee-api-key>
```

Primary commands:

```bash
pnpm dev
pnpm build
pnpm build:seed
pnpm preview
pnpm deploy
```

Backend commands are run from `backend/backend`:

```bash
docker compose up
bash mvnw spring-boot:run
```

## Evaluation Highlights

Knexus is not only a UI mockup. It includes the core pieces needed for a real knowledge system:

- static data normalization for low-cost serving;
- database-backed patch persistence;
- global indexing job state;
- admin-gated graph updates;
- JWT authentication and refresh;
- Cognee integration points for ingestion and retrieval;
- graph visualization with traceable source context.

Together, these pieces demonstrate an end-to-end architecture for turning enterprise activity into an auditable, continuously updated knowledge graph.

## AI Assistance

Knexus was built with AI/LLM assistance for implementation support, UI iteration, code review, architecture refinement, and documentation. The product design, system direction, integration choices, and final project decisions were guided and validated by the developer.
