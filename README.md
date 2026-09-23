# AI CV Analyzer

AI CV Analyzer is a full-stack web application for uploading, analyzing, and managing resumes. The system uses AI to evaluate resume quality, provide recommendations, track analysis history, and compare resumes with job descriptions.

## Features

- User authentication with JWT
- 15-minute session timeout and automatic logout
- Resume upload and management
- AI resume analysis
- Resume score breakdown
- Strengths, weaknesses, and recommendations
- Analysis history and deletion
- Job matching with job descriptions
- Job search and import
- Insights dashboard and score trends
- User profile and career settings
- Responsive desktop, tablet, and mobile UI
- Thai timezone (`Asia/Bangkok`)

## Tech Stack

**Frontend**
- React
- TypeScript
- Vite
- React Router
- Lucide React

**Backend**
- Node.js
- Express
- TypeScript
- MySQL
- Redis / BullMQ
- Qdrant
- Google Gemini API
- JWT
- Zod

## Architecture

```text
React Frontend
      |
      v
Express REST API
      |
      +---- MySQL
      +---- Redis / BullMQ
      +---- Qdrant
      |
      v
Google Gemini API
```

Resume analysis is processed asynchronously through BullMQ workers.

## Setup

### Frontend

```bash
npm install
npm run dev
```

Create `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### Backend

```bash
cd backend
npm install
npm run dev
```

Configure `backend/.env` with the required database, Redis, JWT, Gemini, Qdrant, and job-provider credentials.

Do not commit `.env` files or API keys to Git.

## Testing

Frontend:

```bash
npm run build
```

Backend:

```bash
cd backend
npm run build
npm run type-check
npm test
```

Current automated test suite: **69 tests passing**.

## Known Issue

Job Match analysis may occasionally fail when the Gemini API returns `503 UNAVAILABLE` due to temporary model demand. The backend includes fallback and retry handling for this condition.

## Project Status

Core application flows are implemented and tested, including authentication, resume management, base resume analysis, history, insights, job search, profile settings, responsive layouts, and timezone handling.