# AI CV Analyzer

AI CV Analyzer is a full-stack web application for uploading, analyzing, and managing resumes. It uses AI to score resume quality, explain strengths and weaknesses, recommend improvements, and compare a resume against real job postings.

## Features

**For users**
- Sign up / sign in with email and password, or **Continue with Google**
  - Accounts created through Google must set a password before using the app
  - A Google sign-in whose verified email matches an existing account is linked to that account
- Forgot password with a 6-digit email OTP; password-change notification emails
- 15-minute JWT session with a countdown and automatic logout
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
- Google Gemini — embeddings for semantic search
- Careerjet — job search
- Gmail SMTP (Nodemailer) — OTP and notification emails
- Google OAuth 2.0 / OpenID Connect — sign-in

## Architecture

```text
Browser ──> Vite (5173) ──/api proxy──> Express API (5000) ──> MySQL
                                              │                Redis ── BullMQ worker ──> Ollama
                                              │                Qdrant <── Gemini embeddings
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

Run the SQL files in `backend/database/migrations/` in order (for example through phpMyAdmin at `http://localhost:8081`).

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
| AI | `OLLAMA_HOST`, `OLLAMA_MODEL`, `GEMINI_API_KEY` |
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

## Testing

Frontend:

```bash
npm run lint
npm run build
```

Backend tests run against a **separate database** (`ai_resume_analyzer_test`), a separate Qdrant collection, and separate Redis keys, so they never touch development data and can run while the dev server is up:

```bash
cd backend
npm run test:db:setup   # create/reset the test DB from the dev schema; rerun after new migrations
npm run type-check
npm test
```

Current automated test suite: **138 tests passing** (19 files), including OAuth, admin, rate-limiting, and analysis-worker integration tests.

## Known Issues

- Careerjet is slow (typically 5–14 s per search); the request timeout is 25 s.
- Ollama analysis takes about 1–2 minutes per run on a local machine.
- Google sign-in only works on origins registered in Google Cloud (e.g. `http://localhost:5173`), not on random Cloudflare quick-tunnel URLs.

## Project Status

Core flows are implemented and tested: authentication (password and Google), resume management, asynchronous AI analysis and job matching, history, insights, job search, profile settings, theming, responsive layouts, and an admin console with audit logging.
