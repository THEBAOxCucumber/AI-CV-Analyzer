# AI CV Analyzer

AI CV Analyzer is a full-stack application for uploading PDF resumes, extracting and chunking resume content, generating vector embeddings, performing semantic search, and analyzing resumes with Google Gemini.

The backend supports both general resume evaluation and job-specific matching through an asynchronous, retry-safe analysis pipeline.

## Project Status

### Backend MVP: Ready

The backend has completed its MVP audit with:

**69/69 automated tests passing**

The audit covers authentication, authorization and ownership isolation, upload security, queue retry behavior, idempotency, transactional outbox delivery, graceful shutdown, environment security, and API integration.

### Frontend: Next Phase

The repository includes a React + TypeScript + Vite frontend foundation. Frontend implementation and backend API integration are the next development phase.

---

## Core Features

- JWT authentication
- bcrypt password hashing
- PDF resume upload
- PDF content signature verification
- Resume text extraction
- Resume text chunking
- Gemini embeddings
- Qdrant vector storage
- Semantic resume search
- AI-powered resume analysis
- Base Resume Score
- Job Match Score
- Job description matching
- Analysis history
- Structured AI output validation with Zod
- Asynchronous analysis jobs with BullMQ
- Redis-backed job queue
- Retry handling for Gemini `429` and `503` errors
- Deterministic queue job IDs
- Worker idempotency and ownership guards
- MySQL transactional outbox
- Per-user analysis rate limiting
- Prompt versioning
- Cross-user resource isolation
- Graceful application shutdown
- API/database health check
- Deprecated legacy analysis endpoints with migration headers

---

## Architecture

```text
Client
  |
  v
Express API
  |
  +-------------------------------+
  |                               |
  v                               v
Auth / Resume APIs          Analysis Request
                                  |
                                  v
                          MySQL Transaction
                                  |
                       +----------+----------+
                       |                     |
                       v                     v
              resume_analysis_runs     analysis_outbox
                                             |
                                             v
                                    Outbox Dispatcher
                                             |
                                             v
                                       BullMQ Queue
                                             |
                                             v
                                  Resume Analysis Worker
                                             |
                              +--------------+--------------+
                              |                             |
                              v                             v
                           Gemini                    Zod Validation
                              |                             |
                              +--------------+--------------+
                                             |
                                             v
                                           MySQL
```

Resume processing and semantic search use a separate flow:

```text
PDF Resume
    |
    v
Text Extraction
    |
    v
Resume Chunks
    |
    v
Gemini Embeddings
    |
    v
Qdrant
    |
    v
Semantic Search / RAG Context
```

The MVP currently runs the BullMQ analysis worker inside the API process.

A separately deployed worker can be introduced later when horizontal scaling requires it.

---

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite

### Backend

- Node.js
- Express 5
- TypeScript
- MySQL
- `mysql2`
- Redis
- `ioredis`
- BullMQ
- Google Gemini (`@google/genai`)
- Qdrant
- Zod
- JSON Web Token (`jsonwebtoken`)
- bcrypt
- Multer
- pdf-parse
- Vitest
- Supertest

---

## Resume Analysis

The analysis system supports separate resume quality and job-fit concepts.

### Base Resume Score

Evaluates the resume itself independently from a job description.

The structured analysis includes areas such as:

- Contact information
- Professional summary
- Skills
- Experience
- Projects
- Education
- Readability

### Job Match Score

Evaluates how well a resume matches a supplied job description.

Job matching can include:

- Overall job match score
- Matched skills
- Missing skills
- Keyword matches
- Recommendations

### Combined Analysis

A combined analysis can provide both the resume-quality evaluation and job-specific matching information.

---

## Analysis API

New clients should use the current analysis-run API.

### Start Analysis

```http
POST /api/resumes/:resumeId/analyses
```

The API creates a durable analysis run and returns without waiting for Gemini processing to finish.

### Analysis History

```http
GET /api/resumes/:resumeId/analyses
```

Returns analysis runs belonging to the authenticated user.

### Analysis Run

```http
GET /api/analyses/:analysisRunId
```

Returns an individual analysis run.

---

## Deprecated Analysis API

The following endpoints are retained temporarily for compatibility:

```http
POST /api/resumes/:resumeId/analyze
GET  /api/resumes/:resumeId/analysis
```

These endpoints are deprecated.

New frontend code should **not** use them.

The current API should be used instead:

```http
POST /api/resumes/:resumeId/analyses
GET  /api/resumes/:resumeId/analyses
GET  /api/analyses/:analysisRunId
```

---

## Asynchronous Analysis Pipeline

```text
POST analysis request
        |
        v
Authentication
        |
        v
Ownership Validation
        |
        v
Per-user Rate Limit
        |
        v
MySQL Transaction
        |
        +--> Analysis Run = QUEUED
        |
        +--> Outbox Event = PENDING
        |
        v
COMMIT
        |
        v
HTTP 202 Accepted
        |
        v
Outbox Dispatcher
        |
        v
BullMQ / Redis
        |
        v
Worker
        |
        v
PROCESSING
        |
        +--> Build Versioned Prompt
        |
        +--> Gemini
        |
        +--> Strict Zod Validation
        |
        v
COMPLETED / FAILED
```

---

## Transactional Outbox

Analysis creation uses a transactional outbox rather than directly enqueueing a BullMQ job during the HTTP request.

The analysis run and outbox event are created in the **same MySQL transaction**:

```text
BEGIN

INSERT resume_analysis_runs
INSERT analysis_outbox

COMMIT
```

After commit, the background dispatcher reads pending outbox events and publishes them to BullMQ.

This prevents an analysis request from being lost if the database transaction succeeds while Redis is temporarily unavailable.

---

## Retry Strategy

Gemini errors are classified before retrying.

Retryable failures include:

```text
429 Too Many Requests
503 Service Unavailable
```

These jobs use BullMQ retry behavior with exponential backoff.

Non-retryable failures are stopped immediately rather than consuming unnecessary retry attempts.

If retry attempts are exhausted, the analysis run is marked as failed.

---

## Queue Idempotency

Queue jobs use deterministic job IDs based on the analysis run:

```text
analysis-{analysisRunId}
```

This helps make outbox dispatch retry-safe.

The worker also uses processing ownership to prevent stale or concurrent duplicate jobs from processing the same analysis run incorrectly.

BullMQ retries preserve the same job identity, allowing legitimate retries while blocking unrelated duplicate workers.

---

## Prompt Versioning

Analysis runs store the prompt version used to generate the result.

Example:

```env
RESUME_ANALYSIS_PROMPT_VERSION=resume-analysis-v2.0.0
```

Prompt builders are selected through a versioned registry.

This makes analysis results traceable to the prompt implementation that produced them and allows future prompt versions to coexist safely.

---

## Security

### JWT Authentication

Protected endpoints use JWT authentication.

JWT signing and verification explicitly use:

```text
HS256
```

The authentication middleware validates:

- Bearer token format
- Token signature
- Token expiration
- Token payload
- Positive integer user ID
- Existing database user

The authenticated user is loaded from the database rather than trusting authorization-sensitive role or email information directly from stale token claims.

Production also validates that `JWT_SECRET` has an appropriate minimum length.

---

## Ownership Isolation

Resources are scoped to the authenticated user.

Ownership protections cover areas including:

- Resumes
- Resume chunks
- Resume embeddings
- Job descriptions
- Analysis history
- Individual analysis runs

Attempts to access another user's resources return a not-found response rather than revealing that the resource exists.

Ownership behavior is protected by integration tests.

---

## Upload Security

Resume uploads use multiple validation layers.

### File metadata validation

Uploads are restricted to PDF-compatible file names and MIME types.

### PDF content validation

The uploaded file is inspected for the PDF signature:

```text
%PDF-
```

A file renamed to `.pdf` but containing non-PDF content is rejected.

Invalid uploaded files are also removed from disk.

### Upload limits

Multer limits:

- File size
- Number of files
- Form fields

Express request bodies also have explicit size limits.

Oversized request bodies return:

```text
413 REQUEST_BODY_TOO_LARGE
```

---

## Rate Limiting

Resume analysis requests use a per-user Redis-backed rate limit.

Example configuration:

```env
ANALYSIS_RATE_LIMIT_MAX=5
ANALYSIS_RATE_LIMIT_WINDOW_SECONDS=600
```

Rate-limit keys are scoped by authenticated user ID.

---

## Graceful Shutdown

The production server handles:

```text
SIGINT
SIGTERM
```

Shutdown follows this lifecycle:

```text
Stop accepting HTTP requests
        |
        v
Wait for HTTP requests
        |
        v
Stop Outbox Dispatcher
        |
        v
Wait for active dispatch
        |
        v
Close Analysis Worker
        |
        v
Close BullMQ Queue
        |
        v
Close Redis
        |
        v
Exit
```

This prevents new requests or outbox dispatch work from starting while infrastructure resources are being closed.

---

## Health Check

With the backend running:

```http
GET /api/health
```

Example healthy state:

```json
{
  "success": true,
  "message": "API and database are working",
  "data": {
    "api": "healthy",
    "database": "connected"
  }
}
```

---

# Backend Setup

## Requirements

Before starting the backend, install or configure:

- Node.js
- MySQL
- Redis
- Qdrant
- Google Gemini API access

---

## Install Dependencies

```bash
cd backend
npm install
```

---

## Environment Variables

Create:

```text
backend/.env
```

Example configuration:

```env
NODE_ENV=development
PORT=5000

# MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=resume_user
DB_PASSWORD=your_password
DB_NAME=ai_resume_analyzer

# JWT
JWT_SECRET=replace_with_a_secure_secret
JWT_EXPIRES_IN=1d

# Upload
UPLOAD_DIR=uploads/resumes
MAX_RESUME_SIZE_MB=5

# Gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_GENERATION_MODEL=your_generation_model

# Embeddings
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=1536
EMBEDDING_BATCH_SIZE=20

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=resume_chunks_gemini_1536

# Optional when Qdrant authentication is enabled
QDRANT_API_KEY=

# Semantic Search
SEMANTIC_SEARCH_LIMIT=5
SEMANTIC_SCORE_THRESHOLD=0.45

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# BullMQ
ANALYSIS_QUEUE_NAME=resume-analysis
ANALYSIS_MAX_ATTEMPTS=3
ANALYSIS_RETRY_DELAY_MS=3000

# Analysis Rate Limit
ANALYSIS_RATE_LIMIT_MAX=5
ANALYSIS_RATE_LIMIT_WINDOW_SECONDS=600

# Resume Analysis
RESUME_ANALYSIS_PROMPT_VERSION=resume-analysis-v2.0.0
RESUME_ANALYSIS_MAX_CONTEXT_CHARS=40000

# CORS
CORS_ORIGIN=http://localhost:5173
```

Do **not** commit real passwords, JWT secrets, or API keys.

---

## Development

```bash
npm run dev
```

Default local API:

```text
http://localhost:5000
```

---

## Type Check

```bash
npm run type-check
```

---

## Build

```bash
npm run build
```

The production TypeScript build is written to `dist` according to the backend TypeScript configuration.

---

## Production Start

Build first:

```bash
npm run build
```

Then:

```bash
npm start
```

The current MVP starts:

```text
Express API
Outbox Dispatcher
BullMQ Analysis Worker
```

inside the backend application lifecycle.

---

## Tests

Run the full test suite:

```bash
npm test
```

Current audited baseline:

```text
69/69 passing
```

Tests include unit and integration coverage for critical backend behavior.

---

# Frontend Setup

The repository contains the React + TypeScript + Vite frontend foundation.

From the repository root:

```bash
npm install
npm run dev
```

The frontend should use the current analysis-run API:

```text
POST /api/resumes/:resumeId/analyses
GET  /api/resumes/:resumeId/analyses
GET  /api/analyses/:analysisRunId
```

It should not introduce new dependencies on the deprecated `/analyze` or `/analysis` endpoints.

---

# Backend MVP Audit

The backend completed the current MVP audit with the following status:

```text
TypeScript type-check       PASS
Production build            PASS
Automated tests             PASS — 69/69

Auth / JWT Security         PASS
Authorization / Ownership   PASS

Upload Security             PASS
Request Body Limits         PASS

Queue / Retry               PASS
Queue Idempotency           PASS

Transactional Outbox        PASS
Prompt Versioning           PASS
Rate Limiting               PASS

Graceful Shutdown           PASS
Environment / Secrets       PASS
Legacy Consumer Audit       PASS

Production Startup          PASS
Health Check                PASS
```

## Backend MVP Status

```text
READY
```

---

# Post-MVP / Scaling Work

The following improvements are intentionally deferred until deployment scale requires them.

### Separate Worker Deployment

The MVP runs the analysis worker inside the API process.

A future deployment can separate:

```text
API Process
Worker Process
```

for independent scaling.

### Multi-instance Outbox Claiming

The current dispatcher can later be upgraded with mechanisms such as:

```text
claim / lease
```

or:

```sql
FOR UPDATE SKIP LOCKED
```

to coordinate multiple dispatcher instances.

### Outbox Dead-letter Handling

Future versions can introduce:

- Maximum dispatch attempts
- Dead-letter state
- Operational recovery tools

for permanently failing or unsupported outbox events.

### Observability

Production deployments can add:

- Structured logging
- Metrics
- Distributed tracing
- Queue dashboards
- Error monitoring
- Alerting

### Legacy Endpoint Removal

Deprecated endpoints can be removed after their migration/sunset period once no consumers depend on them.

---

# Current Development Direction

```text
Backend MVP
    |
    |  READY
    v
Frontend Development
    |
    v
Backend API Integration
    |
    v
End-to-End Testing
    |
    v
Deployment
```

The backend regression baseline should remain at or above:

```text
69/69 tests passing
```

when frontend integration requires backend changes.

---

## License

ISC