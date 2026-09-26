# AI CV Analyzer --- System Overview

> Project overview for the current AI CV Analyzer architecture.\
> Current AI direction: **Local LLM via Ollama (`qwen3:4b-instruct`)**.

## 1. Purpose

AI CV Analyzer is a full-stack application for uploading resumes,
extracting and chunking resume content, analyzing resume quality,
comparing resumes against job descriptions, viewing analysis history and
insights, searching/importing jobs, and maintaining user profile
information.

The system is designed around an asynchronous analysis pipeline so that
AI processing is separated from HTTP request handling.

## 2. High-Level Architecture

``` text
React + TypeScript Frontend
          |
          | REST API + JWT
          v
Node.js / Express / TypeScript Backend
          |
          +--------------------------+
          |                          |
          v                          v
       MySQL                     Redis / BullMQ
          ^                          |
          |                          v
          |                  Resume Analysis Worker
          |                          |
          |                          v
          |                  Prompt + Resume Chunks
          |                          |
          |                          v
          |                    Ollama Local API
          |                          |
          |                          v
          |                  qwen3:4b-instruct
          |                          |
          |                          v
          |              Structured JSON Response
          |                          |
          |                          v
          |                 Result Normalization
          |                          |
          |                          v
          +-------------------- Zod Validation
                                     |
                                     v
                              Analysis COMPLETED
```

Supporting integrations include Careerjet for job search/import and the
existing resume embedding/RAG infrastructure.

## 3. Technology Stack

### Frontend

-   React 19
-   TypeScript
-   Vite
-   React Router
-   Lucide React
-   JWT-based authentication
-   Responsive desktop/tablet/mobile UI
-   Mitr-based visual design

Frontend API base URL:

``` env
VITE_API_BASE_URL=http://localhost:5000/api
```

### Backend

-   Node.js
-   Express
-   TypeScript
-   MySQL (`mysql2/promise`)
-   Redis
-   BullMQ
-   Zod
-   Multer
-   PDF parsing and resume chunking
-   JWT authentication
-   Ollama Node SDK
-   Vitest / Supertest

Default API URL:

``` text
http://localhost:5000/api
```

Health endpoint:

``` text
GET /api/health
```

### Local AI

Current local model:

``` text
qwen3:4b-instruct
```

Ollama defaults:

``` env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b-instruct
OLLAMA_TIMEOUT_MS=240000
```

The Node backend communicates with the local Ollama server using the
`ollama` package.

## 4. Backend Architecture

The main backend convention is:

``` text
Controller
    |
    v
Service
    |
    v
Repository
    |
    v
MySQL
```

Long-running resume analysis is moved outside the request lifecycle:

``` text
API
 |
 v
Analysis Run + Outbox
 |
 v
Dispatcher
 |
 v
BullMQ
 |
 v
Worker
 |
 v
Analysis Processor
```

This keeps HTTP endpoints responsive and allows retry/failure handling
to be managed by the queue.

## 5. Authentication and Session

Authentication uses JWT.

Main flow:

``` text
Login
  |
  v
Receive JWT
  |
  v
Store access token
  |
  v
GET /auth/me
  |
  v
Authenticated React session
```

The frontend reads the JWT `exp` claim and displays a live session
countdown. Refreshing the page does not reset the expiration time
because the countdown is derived from the existing token.

Configured session duration:

``` env
JWT_EXPIRES_IN=15m
```

Registration supports first name, last name, email, and password
validation.

## 6. Resume Processing

Resume upload uses the multipart field:

``` text
resume
```

After upload, the backend extracts resume content and creates chunks.

Conceptual flow:

``` text
Resume Upload
    |
    v
File Storage / Resume Record
    |
    v
Text Extraction
    |
    v
Resume Chunks
    |
    +----> Embeddings / RAG infrastructure
    |
    v
Ready for Analysis
```

Analysis requires completed chunks. If no completed chunks are
available, the analysis processor rejects the job with
`RESUME_CHUNKS_NOT_READY`.

## 7. Resume Analysis

Supported analysis types:

``` text
BASE
JOB_MATCH
COMBINED
```

`JOB_MATCH` and non-BASE analysis can use a Job Description.

Important endpoints:

``` text
POST   /api/resumes/:resumeId/analyses
GET    /api/resumes/:resumeId/analyses
GET    /api/analyses/:analysisRunId
DELETE /api/analyses/:analysisRunId
```

The analysis lifecycle includes:

``` text
PENDING
QUEUED
PROCESSING
COMPLETED
FAILED
```

Active analysis runs cannot be deleted. Completed and failed runs can be
deleted.

## 8. Analysis Queue Flow

The asynchronous analysis pipeline is:

``` text
POST analysis
    |
    v
Create Analysis Run
    |
    v
Create Outbox Event
    |
    v
Dispatcher
    |
    v
BullMQ Job
    |
    v
Resume Analysis Worker
    |
    v
processResumeAnalysis()
    |
    +--> mark PROCESSING / increment attempt
    +--> load completed resume chunks
    +--> load Job Description when required
    +--> build production prompt
    +--> call LLM
    +--> parse JSON
    +--> normalize deterministic fields
    +--> validate with Zod
    |
    v
mark COMPLETED
```

BullMQ retry/backoff remains useful even with a local LLM because Ollama
can be temporarily unavailable, a model can fail to load, or a local
request can fail.

## 9. Local LLM / Ollama Integration

The project is transitioning resume analysis from Gemini to Ollama.

Verified local path:

``` text
Backend
   |
   v
Ollama Node SDK
   |
   v
http://127.0.0.1:11434
   |
   v
qwen3:4b-instruct
```

A smoke test successfully returned:

``` text
OK
```

Structured output has also been tested with the production resume
analysis JSON schema.

### Structured Output

The backend converts the Zod schema to JSON Schema:

``` ts
z.toJSONSchema(
  resumeAnalysisResultSchema,
  {
    target: "draft-07",
  },
)
```

The JSON Schema is passed to Ollama as the structured output format.

Conceptually:

``` text
buildResumeAnalysisPrompt()
          |
          v
qwen3:4b-instruct
          |
          v
Structured JSON
          |
          v
JSON.parse()
          |
          v
normalizeResumeAnalysisResult()
          |
          v
resumeAnalysisResultSchema.safeParse()
```

## 10. Deterministic Result Normalization

Local LLM testing revealed an important constraint: a model can generate
valid section scores but calculate the total score incorrectly.

For example:

``` text
Model baseResumeScore: 75

Section total:
5 + 6 + 7 + 8 + 7 + 8 + 8 = 49
```

The backend therefore treats calculated aggregate fields as
deterministic application logic rather than trusting LLM arithmetic.

Normalization rules:

``` text
baseResumeScore =
  sum of all base resume section scores

jobMatchScore =
  jobMatch.score when jobMatch exists
  otherwise null
```

The normalizer does **not** silently clamp invalid section scores. Zod
still validates the model output against the scoring limits.

## 11. Resume Scoring Contract

The base resume score is composed of seven sections.

``` text
Contact Information     10
Professional Summary    15
Skills                  20
Experience              25
Projects                 10
Education                10
Readability              10
                       ----
Total                   100
```

The production schema validates each section against its rubric maximum.

It also enforces:

``` text
baseResumeScore == sum(scores)

jobMatch == null
    => jobMatchScore == null

jobMatch != null
    => jobMatchScore == jobMatch.score
```

The LLM does not have authority to bypass these application-level rules.

## 12. Analysis Result Contract

A completed analysis contains:

``` text
baseResumeScore
jobMatchScore
scores
jobMatch
summary
strengths
weaknesses
recommendations
```

Base score sections:

``` text
contactInformation
professionalSummary
skills
experience
projects
education
readability
```

Job matching can contain:

``` text
score
matchedSkills
missingSkills
keywordMatches
```

## 13. Prompt System

The production prompt is built by:

``` text
src/modules/analysis/resume-analysis.prompt.ts
```

Main entry point:

``` ts
buildResumeAnalysisPrompt(...)
```

The processor supplies:

``` text
chunks
jobDescription
analysisType
promptVersion
```

Current prompt version:

``` text
resume-analysis-v2.0.0
```

The same production prompt should be reused regardless of whether the AI
provider is remote or local. Provider-specific behavior should be kept
outside the prompt builder where possible.

## 14. Job Search

The backend includes job search/import functionality using Careerjet.

Main job search endpoint:

``` text
GET /api/jobs?keywords=...
```

Job import:

``` text
POST /api/jobs/import
```

Imported jobs use the source URL to derive a SHA-256 identity and avoid
unnecessary second provider requests.

Careerjet configuration includes API credentials, locale, and provider
access restrictions such as IP authorization.

Provider failures should be mapped to application-friendly errors rather
than exposing raw provider errors to the frontend.

## 15. Frontend Pages

Current application areas include:

``` text
Sign In
Register
Dashboard
Upload Resume
History
Analysis Result
Insights
Job Matches
Job Details
Settings
```

The frontend treats the backend API as the source of truth.

### Analysis Result

The result page polls active analysis runs approximately every two
seconds while the status is:

``` text
PENDING
QUEUED
PROCESSING
```

It displays completed BASE/JOB_MATCH results and provides retry behavior
for failed analyses.

### History

Analysis history includes:

``` text
Resume
Analysis Type
Job
Status
Score
Date
```

### Insights

Insights aggregate completed analysis data, including:

-   Score breakdowns
-   Strengths
-   Weaknesses
-   Recommendations
-   Score trends

### Settings

Profile data is handled through:

``` text
GET /api/profile
PUT /api/profile
```

## 16. Timezone Handling

Database/API timestamps are treated consistently, with MySQL configured
using UTC.

The frontend displays dates using:

``` text
Asia/Bangkok
```

This keeps stored timestamps portable while presenting local dates
correctly.

## 17. Error Handling

The backend has centralized application error handling.

Provider-specific raw errors should not be shown directly to end users.

The processor raises these provider-output errors (`AppError`,
never retried):

``` text
OLLAMA_EMPTY_ANALYSIS_RESPONSE
OLLAMA_INVALID_JSON_RESPONSE
OLLAMA_INVALID_ANALYSIS_RESPONSE
```

The worker classifies errors with `getRetryableLlmReason()`
(`backend/src/modules/analysis/llm-retry.util.ts`):

``` text
ECONNREFUSED / ECONNRESET / Ollama 408,429,5xx
    -> UNAVAILABLE (retry)

AbortSignal timeout / undici headers/body timeout
    -> TIMEOUT (retry)

AppError (invalid JSON/schema, chunks missing),
Ollama 404 model not found, anything else
    -> UnrecoverableError (no retry)
```

Final error codes stored on the analysis run:

``` text
LLM_UNAVAILABLE                retries exhausted, reason UNAVAILABLE
LLM_TIMEOUT                    retries exhausted, reason TIMEOUT
ANALYSIS_RETRY_EXHAUSTED       retries exhausted, other reason
NON_RETRYABLE_ANALYSIS_ERROR   unrecoverable
```

Older runs may still carry `GEMINI_UNAVAILABLE` /
`GEMINI_RATE_LIMITED`; the frontend keeps handling them.

The Ollama request is bounded by `OLLAMA_TIMEOUT_MS` (default
`240000`), applied through a custom `fetch` with
`AbortSignal.timeout()` because the SDK accepts no per-request signal
for non-streaming calls. Keep it below Node fetch's 300s headers
timeout.

## 18. Testing

Backend scripts include:

``` text
npm run dev
npm run build
npm run type-check
npm test
npm run test:watch
```

The existing backend test suite covers analysis queue behavior, retries,
authentication, and API behavior.

Before considering the Ollama migration complete, verify:

``` text
TypeScript type-check
Backend test suite
Ollama smoke test
BASE analysis through BullMQ
JOB_MATCH analysis through BullMQ
COMBINED analysis if exposed
Analysis Result UI
History
Insights
Failure when Ollama is stopped
Retry/final failure behavior
```

## 19. Current Migration State

Completed and verified:

``` text
Ollama installed locally
qwen3:4b-instruct downloaded
Node -> Ollama smoke test successful
Structured JSON output successful
Production Zod JSON Schema accepted by Ollama
Result normalization implemented/tested
Normalized result passes production Zod validation
Processor generates analyses via Ollama (with timeout)
Worker uses provider-neutral retry classification
Worker integration tests mock Ollama (76/76 suite passing)
```

Remaining:

``` text
Manual end-to-end run against a real Ollama server
(BASE, JOB_MATCH, COMBINED, Ollama stopped)
LLM Provider Interface (section 20)
```

Gemini is still used for embeddings and resume Q&A search
(`embedding-provider.service.ts`, `resume-question.service.ts`), so
`config/gemini.ts` and `gemini-retry.util.ts` must stay.

## 20. Recommended Provider Boundary

To avoid coupling analysis logic directly to one AI vendor, the
long-term structure should be:

``` text
Analysis Processor
       |
       v
LLM Provider Interface
       |
       +----------------+
       |                |
       v                v
 Ollama Provider    Gemini Provider
```

Example conceptual contract:

``` ts
interface LlmProvider {
  generateStructuredAnalysis(
    prompt: string,
  ): Promise<unknown>;
}
```

This keeps the following provider-independent:

``` text
Resume loading
Job Description loading
Prompt construction
Normalization
Zod validation
Database persistence
Queue lifecycle
Frontend API contract
```

## 21. Key Design Principles

1.  **Backend API is the source of truth.**
2.  **Long AI operations run asynchronously through BullMQ.**
3.  **LLM output is untrusted input and must be validated.**
4.  **Deterministic calculations belong in TypeScript, not in the LLM.**
5.  **Zod remains the final contract gate before persistence.**
6.  **Provider failures should not leak raw technical errors to users.**
7.  **Local AI integration should not require frontend contract
    changes.**
8.  **Keep provider-specific code isolated so models/providers can
    change later.**

## 22. Main Project Paths

``` text
D:\CV
├── src
│   ├── components
│   ├── contexts
│   ├── hooks
│   ├── pages
│   ├── services
│   ├── styles
│   ├── types
│   └── utils
│
└── backend
    └── src
        ├── config
        ├── errors
        ├── modules
        │   ├── analysis
        │   ├── job
        │   ├── job-description
        │   └── resume
        ├── scripts
        └── workers
```

Important analysis files (relative to `backend/`):

``` text
src/modules/analysis/resume-analysis.prompt.ts
src/modules/analysis/resume-analysis.schema.ts
src/modules/analysis/resume-analysis-rubric.ts
src/modules/analysis/resume-analysis-normalizer.ts
src/modules/analysis/resume-analysis-processor.service.ts
src/modules/analysis/llm-retry.util.ts
src/workers/resume-analysis.worker.ts
src/scripts/test-ollama.ts
```

## 23. End-to-End Target

The target production flow after the Ollama migration is:

``` text
User uploads Resume
        |
        v
Backend extracts/chunks Resume
        |
        v
User starts Analysis
        |
        v
Analysis Run = QUEUED
        |
        v
BullMQ Worker
        |
        v
Analysis Run = PROCESSING
        |
        v
Load Resume Chunks
        |
        +---- Load Job Description when required
        |
        v
Build Production Prompt
        |
        v
Ollama / qwen3:4b-instruct
        |
        v
Structured JSON
        |
        v
Normalize deterministic fields
        |
        v
Zod validation
        |
        +---- invalid -> FAILED/error handling
        |
        v
Persist Analysis
        |
        v
Analysis Run = COMPLETED
        |
        v
Frontend Result / History / Insights
```

------------------------------------------------------------------------

**Status:** The processor and worker run on Ollama with
provider-neutral retry handling and a request timeout; the backend test
suite passes with Ollama mocked. The next milestone is a manual
end-to-end run against a real Ollama server, then the LLM Provider
Interface.
