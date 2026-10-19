# AI CV Analyzer

AI CV Analyzer is a full-stack web application for uploading, analyzing, and managing resumes. It uses AI to score resume quality, explain strengths and weaknesses, recommend improvements, and compare a resume against real job postings.

## Features

**For users**
- Sign up / sign in with email and password, or **Continue with Google**
  - Accounts created through Google must set a password before using the app
  - A Google sign-in whose verified email matches an existing account is linked to that account
- Forgot password with a 6-digit email OTP; password-change notification emails
- 15-minute JWT session with a countdown and automatic logout; click the countdown to renew the session (also on the admin page)
- Resume upload (PDF, max 5 MB) and management
- AI resume analysis: overall score, section scores (radar chart), strengths, weaknesses, recommendations
- Job matching against a job description: match score, matching / missing skills, keyword matches
- Job search (Careerjet) and one-click import as a job description
- Analysis history, insights dashboard and score trends
- Profile and career preferences (Thai province picker)
- **Light / Dark / System theme** and adjustable font size
- Responsive layout from 280 px (Galaxy Fold) to desktop; accessible dialogs and form controls
- Thai timezone (`Asia/Bangkok`)

**For administrators** — `http://localhost:5000/admin/`
- Overview: users, resumes, analyses today, success rate, average duration, stuck jobs
- 7 / 30-day trends: analyses per day, success rate, average duration
- Service health: MySQL, Redis, Qdrant, Ollama, and the analysis queue
- Users: search, unlock a login blocked by rate limiting, promote / demote admins (by row or by email)
- Analyses: filter by status, retry failed runs, cancel runs stuck longer than 30 minutes
- Audit log of every admin action (stored in the database)

**Security**
- Rate limiting on authentication (per IP, and failed logins per IP + email), backed by Redis
- Google OAuth with single-use `state`, PKCE, and a one-time login code (provider tokens never reach the browser)
- `X-Powered-By` disabled, strict CSP on the admin page, `trust proxy` limited to loopback
- Admin API requires `role = ADMIN`, re-checked from the database on every request

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, React Router, Lucide React

**Backend:** Node.js, Express 5, TypeScript, Zod 4, JWT, bcrypt

**Data & infrastructure:** MySQL 8, Redis / BullMQ, Qdrant (vector search)

**AI & integrations**
- Ollama (`qwen3:4b-instruct`) — resume and job-match analysis
- Ollama (`qwen3-embedding:0.6b`) or Google Gemini — embeddings for semantic search (`EMBEDDING_PROVIDER`)
- Careerjet — job search
- Gmail SMTP (Nodemailer) — OTP and notification emails
- Google OAuth 2.0 / OpenID Connect — sign-in

## Architecture

```text
Browser ──> Vite (5173) ──/api proxy──> Express API (5000) ──> MySQL
                                              │                Redis ── BullMQ worker ──> Ollama
                                              │                Qdrant <── embeddings (Ollama or Gemini)
                                              ├──> Careerjet / Gmail SMTP / Google OAuth
                                              └── /admin (static admin console)
```

Resume analysis is asynchronous: the API writes the run and an outbox event in one transaction, a dispatcher enqueues it in BullMQ, and the worker calls Ollama and stores the validated result.

## Setup

### 1. Infrastructure

```bash
cd backend
docker compose up -d   # MySQL :3306, phpMyAdmin :8081, Qdrant :6333, Redis :6379
```

Create the tables from `backend/database/migrations/` on the empty database (the script refuses to run on a database that already has tables):

```bash
cd backend
DB_HOST=127.0.0.1 DB_USER=root DB_PASSWORD=root_password DB_NAME=ai_resume_analyzer npm run db:create-schema
```

On an existing database, apply only the migration files you have not run yet. `018_fix_schema_drift.sql` is safe to run on any database; it fixes tables created before it existed.

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

Configure `backend/.env`. Main variables:

| Area | Variables |
|---|---|
| Database | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| Redis / Qdrant | `REDIS_HOST`, `REDIS_PORT`, `QDRANT_URL`, `QDRANT_COLLECTION` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN` |
| AI | `OLLAMA_HOST`, `OLLAMA_MODEL`, `GEMINI_API_KEY` (only when `EMBEDDING_PROVIDER=gemini`) |
| Embeddings | `EMBEDDING_PROVIDER` (`gemini` or `ollama`), `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `QDRANT_COLLECTION`, `EMBEDDING_NUM_GPU` (default 0 = CPU), `EMBEDDING_KEEP_ALIVE` (default `2m`) |
| AI speed (optional) | `OLLAMA_NUM_GPU`, `OLLAMA_KEEP_ALIVE` (default `30m`), `OLLAMA_MIN_CONTEXT` / `OLLAMA_MAX_CONTEXT` (default 3072 / 8192) |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |
| Jobs | `CAREERJET_API_KEY` |
| Google sign-in (optional) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — see [`backend/docs/OAUTH_SETUP.md`](backend/docs/OAUTH_SETUP.md) |
| Tuning (optional) | `RATE_LIMIT_*`, `TRUST_PROXY`, `ADMIN_STUCK_MINUTES` |

Do not commit `.env` files or API keys to Git.

### 3. Frontend

```bash
npm install
npm run dev   # http://localhost:5173
```

The frontend calls `/api`, which Vite proxies to the backend. Set `VITE_API_BASE_URL` only if the API lives elsewhere.

### 4. Make an administrator

Sign up normally, then either run

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
```

or ask an existing admin to use **Promote by email** on the admin page.

### Sharing with testers

`npm run share` builds and serves the app on port 4173 (also proxying `/api`), which can be exposed with a Cloudflare quick tunnel. The admin page is not reachable through the tunnel, and Google sign-in needs a fixed domain (see the OAuth guide).

### Offline embeddings (recommended)

By default, resume chunks are embedded with Google Gemini, which needs internet access and an API key. To run everything on your machine (only job search needs the internet):

```bash
ollama pull qwen3-embedding:0.6b   # multilingual (Thai + English), 1024 dimensions
```

In `backend/.env`:

```bash
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=qwen3-embedding:0.6b
EMBEDDING_DIMENSIONS=1024
QDRANT_COLLECTION=resume_chunks_ollama_qwen3_1024   # new collection: vector size changed
```

Then re-embed existing resumes into the new collection (the old collection is left untouched, so you can switch back):

```bash
cd backend
npm run embeddings:rebuild
```

The embedding model runs on the CPU by default (`EMBEDDING_NUM_GPU=0`) so it does not take GPU memory from the analysis model. The privacy page reads the active provider from `GET /api/privacy`.

## Testing

Frontend unit and component tests use Vitest with jsdom. Test files live next to the code they cover (`*.test.ts` / `*.test.tsx`):

```bash
npm run lint
npm run build
npm test            # or: npm run test:watch
```

Backend tests run against a **separate database** (`ai_resume_analyzer_test`), a separate Qdrant collection, and separate Redis keys, so they never touch development data and can run while the dev server is up:

```bash
cd backend
npm run test:db:setup   # recreate the test DB from migrations (same as CI); rerun after new migrations
npm run type-check
npm test
```

Current automated test suite: **184 backend tests** (25 files), including OAuth, admin, account deletion, rate-limiting, and analysis-worker integration tests, plus **45 frontend tests** (7 files).

End-to-end tests (Playwright, using the installed Microsoft Edge) drive the real app: register → sign in → delete account, the hamburger menu on desktop and mobile, the public privacy page, and a full upload → AI analysis → result flow. They also run axe (WCAG 2.1 A/AA) on every page in light and dark themes; because axe cannot measure contrast over gradients, the scan swaps the background for each theme's worst-case solid color. Start Docker, Ollama, the backend and the frontend, seed the demo account (used by the signed-in accessibility scans), then:

```bash
cd backend && npm run demo:seed && cd ..
npm run test:e2e              # E2E_SKIP_AI=1 skips the slow AI analysis test
```

E2E is not part of CI (it needs Ollama and a GPU). See `docs/DEMO.md` for the presentation checklist (`npm run demo:seed`, `npm run demo:check`).

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request to `main`: frontend lint, typecheck + build, and tests; backend typecheck, then the full backend suite against MySQL, Redis, and Qdrant service containers with the schema built from migrations (Ollama is mocked; external API keys are dummies).

## Known Issues

- Careerjet is slow (typically 5–14 s per search); the request timeout is 25 s.
- Ollama speed depends on whether the model fits in GPU memory. On a 4 GB GPU, Ollama's default puts ~1 GB of `qwen3:4b-instruct` on the CPU (≈6 tokens/s, ~2 minutes per analysis). Setting `OLLAMA_NUM_GPU=99` keeps every layer on the GPU (≈48 tokens/s, ~20 s warm / ~35 s cold); if VRAM is short at load time the worker retries once with automatic offload. The context size is computed per prompt, and the model stays loaded for `OLLAMA_KEEP_ALIVE`.
- On an 8 GB RAM machine, analysis can stall until the 4-minute Ollama timeout if free RAM drops below ~1 GB (Windows starts paging). Close other apps before a demo; `npm run demo:check` warns below 1.5 GB.
- Thai PDFs exported from Chrome or Word can lose tone marks above upper vowels (e.g. ที่ → ที) during text extraction, because the font's shaped glyph has no Unicode mapping. The AI usually still understands the text, but the extracted text is not exact.
- Google sign-in only works on origins registered in Google Cloud (e.g. `http://localhost:5173`), not on random Cloudflare quick-tunnel URLs.

## Project Status

Core flows are implemented and tested: authentication (password and Google), resume management, asynchronous AI analysis and job matching, history, insights, job search, profile settings, self-service account deletion (password + email confirmation; removes data, PDFs, and vectors), theming, responsive layouts, and an admin console with audit logging.
