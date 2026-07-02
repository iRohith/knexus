# REST API Contracts

This document outlines the REST API specification for the Knowledge Nexus (corp-KRC) backend. 

---

## 1. Authentication

### Login
- **Purpose:** Authenticate an employee and return a JWT.
- **HTTP Method:** `POST`
- **Route:** `/auth/login`
- **Authentication Requirement:** Public
- **Request DTO:**
  ```json
  {
    "email": "string (Valid Email)",
    "password": "string (Min 8 chars)"
  }
  ```
- **Response DTO:**
  ```json
  {
    "token": "string (JWT)",
    "type": "Bearer",
    "email": "string",
    "role": "string (ADMIN | EMPLOYEE)"
  }
  ```
- **Validation Rules:** `email` must not be blank and must be well-formed. `password` must not be blank.
- **Status Codes:**
  - `200 OK`: Login successful.
- **Error Responses:**
  - `401 Unauthorized`: Invalid credentials.
  - `400 Bad Request`: Validation failure.

---

## 2. Documents

### Upload Document
- **Purpose:** Ingest a new document into the system and trigger asynchronous AI indexing.
- **HTTP Method:** `POST`
- **Route:** `/documents`
- **Authentication Requirement:** `Bearer Token` (Requires `ADMIN` role)
- **Request DTO:**
  ```json
  {
    "title": "string",
    "documentType": "string (PDF | WIKI | TICKET | CHAT)",
    "sourceSystem": "string",
    "rawContent": "string",
    "projectId": "uuid (Optional)",
    "metadata": { "key": "value" }
  }
  ```
- **Response DTO:**
  ```json
  {
    "id": "uuid",
    "title": "string",
    "status": "PENDING",
    "indexingJobId": "uuid"
  }
  ```
- **Validation Rules:** `title`, `documentType`, and `rawContent` cannot be blank.
- **Status Codes:**
  - `202 Accepted`: Document saved and indexing job queued in Kafka.
- **Error Responses:**
  - `403 Forbidden`: Insufficient privileges.
  - `404 Not Found`: If `projectId` is provided but invalid.

---

## 3. Projects

### Create Project
- **Purpose:** Create a new project workspace.
- **HTTP Method:** `POST`
- **Route:** `/projects`
- **Authentication Requirement:** `Bearer Token` (Requires `ADMIN` role)
- **Request DTO:**
  ```json
  {
    "name": "string",
    "description": "string"
  }
  ```
- **Response DTO:**
  ```json
  {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "createdAt": "timestamp"
  }
  ```
- **Validation Rules:** `name` must be unique and cannot be blank.
- **Status Codes:**
  - `201 Created`: Project successfully created.
- **Error Responses:**
  - `409 Conflict`: Project name already exists.

---

## 4. Employees

### Create Employee
- **Purpose:** Provision a new employee account.
- **HTTP Method:** `POST`
- **Route:** `/employees`
- **Authentication Requirement:** `Bearer Token` (Requires `ADMIN` role)
- **Request DTO:**
  ```json
  {
    "email": "string",
    "password": "string",
    "role": "string (ADMIN | EMPLOYEE)"
  }
  ```
- **Response DTO:**
  ```json
  {
    "id": "uuid",
    "email": "string",
    "role": "string"
  }
  ```
- **Validation Rules:** `email` must be unique and well-formed.
- **Status Codes:**
  - `201 Created`: Employee successfully provisioned.
- **Error Responses:**
  - `409 Conflict`: Email already in use.

---

## 5. Knowledge Graph & Search

### Execute Query
- **Purpose:** Ask a natural language question to the Knowledge Graph and receive an answer along with the AI's reasoning path.
- **HTTP Method:** `POST`
- **Route:** `/knowledge/query`
- **Authentication Requirement:** `Bearer Token` (Requires `EMPLOYEE` or `ADMIN` role)
- **Request DTO:**
  ```json
  {
    "question": "string"
  }
  ```
- **Response DTO:**
  ```json
  {
    "queryId": "uuid",
    "question": "string",
    "answer": "string",
    "reasoningPath": { "nodes": [], "edges": [] },
    "graphData": { ... },
    "responseTimeMs": 1250,
    "timestamp": "timestamp"
  }
  ```
- **Validation Rules:** `question` cannot be blank.
- **Status Codes:**
  - `200 OK`: Query successfully executed.
- **Error Responses:**
  - `502 Bad Gateway`: Error communicating with Cognee Cloud.
  - `504 Gateway Timeout`: Cognee Cloud took too long to respond.

### Get Query History
- **Purpose:** Retrieve past queries and reasoning paths for the authenticated user.
- **HTTP Method:** `GET`
- **Route:** `/queries/history`
- **Authentication Requirement:** `Bearer Token` (Requires `EMPLOYEE` or `ADMIN` role)
- **Request Parameters:** `page`, `size`
- **Response DTO:**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "question": "string",
        "answer": "string",
        "createdAt": "timestamp"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 45,
    "totalPages": 3
  }
  ```
- **Status Codes:**
  - `200 OK`: History retrieved successfully.

---

## 6. Administration (Indexing)

### Get Indexing Jobs
- **Purpose:** Dashboard view for monitoring asynchronous Cognee ingestion tasks.
- **HTTP Method:** `GET`
- **Route:** `/indexing/jobs`
- **Authentication Requirement:** `Bearer Token` (Requires `ADMIN` role)
- **Request Parameters:** `status` (Optional filter: PENDING, IN_PROGRESS, COMPLETED, FAILED), `page`, `size`
- **Response DTO:**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "documentId": "uuid",
        "documentTitle": "string",
        "status": "string",
        "retryCount": 0,
        "startedAt": "timestamp",
        "completedAt": "timestamp"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 100,
    "totalPages": 5
  }
  ```
- **Status Codes:**
  - `200 OK`: Jobs retrieved successfully.

### Retry Failed Job
- **Purpose:** Manually re-trigger a document indexing job that was routed to the DLT.
- **HTTP Method:** `POST`
- **Route:** `/indexing/jobs/{id}/retry`
- **Authentication Requirement:** `Bearer Token` (Requires `ADMIN` role)
- **Request DTO:** None
- **Response DTO:** None
- **Status Codes:**
  - `202 Accepted`: Retry event successfully pushed back to the main Kafka topic.
- **Error Responses:**
  - `404 Not Found`: Indexing job ID does not exist.
  - `400 Bad Request`: Job is not in a FAILED state.
