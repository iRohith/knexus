# Getting Started (Local Setup & Run)

This guide walks you through setting up and running the knexus application stack locally.

## Prerequisites

- **Node.js**: v18+ & **pnpm**: v8+
- **Java**: JDK 21+ & **Maven**
- **Docker** & **Docker Compose**
- **Python**: v3.14 (for scripts)

## 1. Environment Configuration

### Frontend

Copy `.env.example` to `.env.local` in the `knexus` root directory:

```bash
API_URL="http://localhost:8080"
COGNEE_BASE_URL="https://tenant-...aws.cognee.ai"
COGNEE_API_KEY="..."
```

### Backend

Copy `.env.example` to `.env` inside `knexus/backend/backend`:

```bash
POSTGRES_DB=corpKRC
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
JWT_SECRET=your_generated_secret
COGNEE_BASE_URL=https://tenant-...aws.cognee.ai
COGNEE_API_KEY=...
```

## 2. Infrastructure Services

Launch PostgreSQL, Zookeeper, and Kafka using the provided Docker Compose profiles:

```bash
cd backend/backend
docker compose --profile dev up -d
```

Wait for the containers to report "healthy".

## 3. Spring Boot Backend

Start the Java backend on port `8080`:

```bash
cd backend/backend
./mvnw spring-boot:run
```

## 4. Next.js Frontend

In a separate terminal, start the Next.js development server on port `3000`:

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000` to access the application. You can log in using the mocked credentials provided in the login UI.
