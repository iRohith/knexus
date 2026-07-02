# Future Enhancements

This document outlines features intentionally excluded from the initial Knowledge Nexus (corp-KRC) MVP (Hackathon Phase). These enhancements represent the long-term vision for transforming the platform into a multi-tenant, enterprise-grade SaaS product.

---

## Separation of Scope

**MVP Scope (Current):**
- Single-tenant architecture (one organization per database).
- Synchronous UI polling for background indexing jobs.
- Flat RBAC (ADMIN vs. EMPLOYEE).
- Simple querying of a single, unified knowledge graph.
- Manual document uploads via the Admin portal.

**Future Scope (Below):**
- Features requiring complex infrastructure changes (WebSockets, multi-tenancy).
- Features requiring external API integrations (Jira, Confluence).
- Features requiring Cognee Cloud to support advanced graph versioning.

---

## Proposed Enhancements

### 1. Real-Time Notifications (SSE / WebSockets)
- **Description:** Push indexing status updates (`IN_PROGRESS`, `COMPLETED`, `FAILED`) directly to the frontend instantly, replacing the current UI polling mechanism.
- **Business Value:** Vastly improves the user experience for Admins managing large document uploads.
- **Technical Impact:** Requires a new `NotificationService` in Spring Boot listening to the `graph.updated` Kafka topic and managing active Server-Sent Event (SSE) or WebSocket connections.
- **Dependencies:** Kafka infrastructure, Frontend support for SSE/WebSockets.
- **Priority:** High

### 2. Fine-Grained Permissions
- **Description:** Shift from the flat `ADMIN` / `EMPLOYEE` roles to a granular, document-level or project-level permission model.
- **Business Value:** Enables the ingestion of highly sensitive documents (e.g., HR, Payroll, C-Suite strategies) that only specific teams or individuals can query against.
- **Technical Impact:** Requires changing the Spring Security model to an Authority-based model. `ProjectMembers` and `TeamMembers` tables must be integrated into the query routing layer to restrict Cognee's search scope.
- **Dependencies:** Cognee Cloud must support localized/scoped graph searches based on user permissions.
- **Priority:** High

### 3. External Integrations (Auto-Ingestion)
- **Description:** Connect the backend directly to third-party enterprise tools like Jira, Confluence, Slack, and Google Drive to automatically ingest data on a schedule.
- **Business Value:** Removes the friction of manual uploads. Ensures the knowledge graph is always up to date with the latest company data.
- **Technical Impact:** Requires building a robust scheduled worker system (e.g., Quartz Scheduler) and handling OAuth token lifecycle management for external third-party APIs.
- **Dependencies:** Third-party API credentials, Scheduling infrastructure.
- **Priority:** Medium

### 4. Audit Dashboards & AI Analytics
- **Description:** Advanced dashboards tracking AI accuracy, latency, most frequently asked questions, and unanswerable queries.
- **Business Value:** Allows administrators to identify gaps in the company's documented knowledge (e.g., if many employees ask about "VPN Setup" and the AI fails, Admins know a document is missing).
- **Technical Impact:** Heavy aggregation queries against the `query_history` table. May require migrating audit logs to Elasticsearch if the volume becomes too massive for PostgreSQL to analyze quickly.
- **Dependencies:** Frontend charting libraries (e.g., Recharts), expanded `query_history` data.
- **Priority:** Medium

### 5. Versioned Knowledge Graphs
- **Description:** The ability to snapshot the knowledge graph at a point in time, or "rollback" the graph if a newly uploaded document pollutes the reasoning engine with bad data.
- **Business Value:** Provides safety and recoverability. Protects the integrity of the AI engine from malicious or erroneous document uploads.
- **Technical Impact:** Entirely dependent on how Cognee structures its underlying graph database. Spring Boot would simply issue API commands, but Cognee must support versioning.
- **Dependencies:** Cognee Cloud advanced API capabilities.
- **Priority:** Low (until system scale demands it)

### 6. Multi-Tenant Organizations
- **Description:** Allow multiple distinct companies to use the same deployed instance of Knowledge Nexus without data leakage.
- **Business Value:** Required for pivoting the internal tool into a B2B SaaS product.
- **Technical Impact:** Massive architecture shift. Every table in PostgreSQL must include an `organization_id`. The `CogneeClient` must segregate graphs by organization (e.g., different API keys or distinct Cognee graph namespaces).
- **Dependencies:** Spring Security multi-tenant routing, Cognee Cloud namespace isolation.
- **Priority:** Low (Strategic shift required)

### 7. Graph Analytics (Administrative)
- **Description:** Expose endpoints for Admins to view the entire macro-structure of the knowledge graph (identifying isolated nodes, dense clusters of concepts, or orphan data).
- **Business Value:** Helps knowledge managers optimize how documentation is written by revealing hidden connections between teams and projects.
- **Technical Impact:** Spring Boot would act as a proxy for Cognee's graph export APIs. Heavy processing load on the frontend to render thousands of nodes simultaneously.
- **Dependencies:** Cognee graph export APIs, high-performance WebGL frontend graph rendering.
- **Priority:** Low

### 8. Collaboration Features
- **Description:** Allow employees to "upvote", "downvote", or explicitly correct AI reasoning paths, feeding that data back into the system to improve future answers.
- **Business Value:** Creates a self-healing knowledge base driven by crowdsourced employee feedback.
- **Technical Impact:** Requires new API endpoints to accept feedback and a mechanism to pass that correction data back to Cognee for graph re-weighting or edge correction.
- **Dependencies:** Cognee Cloud reinforcement learning / edge-correction APIs.
- **Priority:** Medium
