# AI Teacher

A full-stack, end-to-end AI tutor. Upload learning material (PDF, DOC, DOCX,
PPT, PPTX, TXT) and it teaches from it using retrieval-augmented generation,
or pick any topic and it teaches from its own knowledge. It runs a real
teaching loop — **Understand → Plan → Explain → Demonstrate → Question →
Evaluate → Adapt → Continue** — asks questions, evaluates your answers,
catches misconceptions, adapts its explanations, speaks with real AI voice
narration, can generate a talking-head avatar video, teaches in the language
you write in, and tracks your progress, strengths, weaknesses, and a
recommended learning path over time.

---

## 1. Architecture

```
ai-teacher/
├── backend/           Node.js + Express API
│   ├── src/
│   │   ├── server.js          App entry point
│   │   ├── db.js              SQLite connection
│   │   ├── migrate.js         Schema migration runner
│   │   ├── migrations/init.sql
│   │   ├── middleware/auth.js JWT auth guard
│   │   ├── routes/            auth, materials, chat, profile, media
│   │   └── services/
│   │       ├── openai.js         Chat, embeddings, TTS (OpenAI API)
│   │       ├── fileParser.js     PDF / DOCX / PPTX / TXT extraction
│   │       ├── rag.js            Chunking, embedding storage, retrieval
│   │       ├── prompts.js        All pedagogical prompt templates
│   │       ├── teachingEngine.js The Understand→...→Complete loop
│   │       └── videoService.js   Real D-ID avatar video integration
│   ├── data/                  SQLite DB file + uploaded files (persisted)
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── frontend/           React (Vite) SPA
│   ├── src/
│   │   ├── pages/       Login, Register, Dashboard, SetupLesson, Teach, Profile
│   │   ├── components/  OnScreenPanel, AvatarPanel, Assessment
│   │   ├── api.js        API client
│   │   └── styles.css
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── render.yaml          One-click Render.com deployment blueprint
└── README.md
```

**Stack:** Node.js/Express, SQLite (via `better-sqlite3`, zero external DB
service needed), React 18 + Vite, JWT auth, OpenAI API (chat + embeddings +
TTS), optional D-ID API for avatar video.

**Why SQLite:** it's a real, persistent, file-backed relational database with
no separate service to provision — ideal for reliable single-command
deployment. The schema (`migrations/init.sql`) is standard SQL and can be
pointed at Postgres/MySQL later with minor query changes if you outgrow it.

---

## 2. Prerequisites

- Node.js 18+ and npm
- An **OpenAI API key** (required — powers all teaching, RAG, and voice)
- *(Optional)* A **D-ID API key** (https://www.d-id.com/) if you want real
  talking-head avatar video generation. Without it, the app still fully
  works: chat teaching, RAG, multilingual support, voice narration, and
  progress tracking all function normally; only the avatar *video* button
  will report itself as not configured instead of faking a video.

---

## 3. Local setup

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set OPENAI_API_KEY (and JWT_SECRET to a long random string)
npm install
npm run migrate   # creates the SQLite schema in ./data/ai_teacher.db
npm start         # starts the API on http://localhost:8080
```

The server auto-runs migrations on boot as well, so `npm start` alone is
enough after the first install — `npm run migrate` is there if you want to
apply schema changes without restarting the server.

### Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env
# VITE_API_BASE_URL=/api is correct for local dev (Vite proxies to the
# backend automatically — see vite.config.js)
npm install
npm run dev       # starts the app on http://localhost:5173
```

Open `http://localhost:5173`, register an account, and start a lesson.

---

## 4. Environment variables

### backend/.env

| Variable | Required | Description |
|---|---|---|
| `PORT` | no (default 8080) | Port the API listens on |
| `NODE_ENV` | no | `development` or `production` |
| `CLIENT_ORIGIN` | recommended | Exact frontend origin, for CORS |
| `JWT_SECRET` | **yes** | Long random string signing auth tokens |
| `JWT_EXPIRES_IN` | no (default 7d) | Token lifetime |
| `OPENAI_API_KEY` | **yes** | Powers teaching, RAG embeddings, and TTS voice |
| `OPENAI_CHAT_MODEL` | no | Default `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | no | Default `text-embedding-3-small` |
| `OPENAI_TTS_MODEL` | no | Default `tts-1` |
| `OPENAI_TTS_VOICE` | no | Default `alloy` |
| `DID_API_KEY` | no | Enables real avatar video generation via D-ID |
| `DID_AVATAR_IMAGE_URL` | no | Presenter image D-ID animates |
| `DATABASE_FILE` | no | Path to the SQLite file |
| `UPLOAD_DIR` | no | Temp dir for uploads before text extraction |
| `MAX_UPLOAD_MB` | no (default 25) | Max upload size |

### frontend/.env

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL. Use `/api` when frontend and backend share a domain/proxy; use the full backend URL (e.g. `https://your-api.onrender.com/api`) when deployed separately. |

**Never commit your real `.env` files.** Only `.env.example` files are
checked into the repo.

---

## 5. How each requirement is implemented

- **Upload & teach from PDF/DOC/DOCX/PPT/PPTX/TXT with RAG:** `fileParser.js`
  extracts text (via `pdf-parse`, `mammoth`, and a JSZip+xml2js PPTX reader);
  `rag.js` chunks it, embeds every chunk with the OpenAI embeddings API, and
  stores vectors in SQLite. At each teaching turn, the current subtopic +
  student message are embedded and matched by cosine similarity to fetch the
  most relevant chunks, which are injected into the teaching prompt as
  grounding context. *(Legacy binary `.doc`/`.ppt` are rejected with a clear
  message asking for `.docx`/`.pptx`/`.pdf`/`.txt`, since those old binary
  formats can't be reliably parsed without extra native tooling — every
  other required format is fully supported.)*
- **Topic-only teaching:** if no material is attached, the planner and
  teaching prompts fall back to the model's own subject-matter knowledge.
- **Personalized lesson planning:** `SetupLesson.jsx` collects level,
  language, objective, depth, and time; `teachingEngine.createSession()`
  turns that into a structured multi-subtopic plan via the OpenAI API.
- **Human-like teaching loop:** `teachingEngine.processTurn()` and the
  `buildTeachingSystemPrompt` explicitly encode
  Understand→Plan→Explain→Demonstrate→Question→Evaluate→Adapt→Continue as
  a stage machine persisted per session in the `sessions.stage` column.
- **Interactive questioning, evaluation, misconception detection, adaptive
  explanation, final assessment:** every model turn returns structured JSON
  (`misconceptions_detected`, `concept_updates`, `stage`) that the engine
  persists; `generateAssessment`/`gradeAssessment` produce and grade a real
  final quiz and fold results back into the learner profile.
- **AI teaching video (avatar, voice, on-screen content):** `media.js` +
  `openai.js textToSpeech` always provide real natural AI voice narration.
  `videoService.js` calls the real D-ID `/talks` API to render an actual
  talking-head video when `DID_API_KEY` is set; if it isn't, the endpoint
  returns a clear "not configured" response rather than a fake video.
  `OnScreenPanel.jsx` renders synced on-screen key points and a visual
  description the model generates for every explanation.
- **Multilingual with preserved context:** the teaching system prompt
  instructs the model to reply in whatever language the student's latest
  message is written in while keeping the full running conversation history
  (all prior turns, regardless of language) in context every turn.
- **Learning profile & progress tracking:** `learner_profiles` table tracks
  concept mastery, strengths, and weaknesses per user; `/api/profile` and
  `/api/profile/recommendations` expose progress and an AI-generated
  learning path.
- **Modern responsive UI:** React SPA with a cohesive design system in
  `styles.css`, responsive down to mobile.
- **Auth, persistence, error handling, loading states, secure API
  handling:** JWT auth (`auth.js`/`middleware/auth.js`), SQLite persistence,
  try/catch + typed error responses on every route, loading/skeleton states
  throughout the frontend, rate limiting (`express-rate-limit`), and all
  secrets read from environment variables only.

---

## 6. Deployment

### Option A — Render.com (recommended, one blueprint)

1. Push this repo to GitHub.
2. In Render: **New + → Blueprint**, point it at your repo (uses the
   included `render.yaml`).
3. When prompted, set the secret env vars: `OPENAI_API_KEY` (required) and
   `DID_API_KEY` (optional).
4. Render provisions two services: `ai-teacher-backend` (Node web service
   with a persistent disk for the SQLite file) and `ai-teacher-frontend`
   (static site). Update `CLIENT_ORIGIN` on the backend and
   `VITE_API_BASE_URL` on the frontend to match your actual Render URLs
   after first deploy, then redeploy.

### Option B — Docker (any host: Fly.io, Railway, a VPS, etc.)

```bash
# Backend
cd backend
docker build -t ai-teacher-backend .
docker run -p 8080:8080 --env-file .env -v $(pwd)/data:/app/data ai-teacher-backend

# Frontend
cd ../frontend
docker build -t ai-teacher-frontend --build-arg VITE_API_BASE_URL=https://your-api-domain/api .
docker run -p 4173:4173 ai-teacher-frontend
```

### Option C — Any Node host (Railway, Fly.io, a VPS, etc.) without Docker

- Backend: set the working directory to `backend/`, run `npm install`, set
  env vars, run `node src/server.js`. Mount/attach persistent storage at the
  `DATABASE_FILE`/`UPLOAD_DIR` paths so data survives restarts/redeploys.
- Frontend: set the working directory to `frontend/`, run
  `npm install && npm run build`, and serve the resulting `dist/` folder as
  a static site (Vercel, Netlify, Render Static Site, `serve -s dist`,
  nginx, etc.), pointing `VITE_API_BASE_URL` at your deployed backend.

---

## 7. Verifying it's working

1. `GET /api/health` should return
   `{ "status": "ok", "openaiConfigured": true, ... }`.
2. Register a user in the UI, upload a PDF/DOCX/PPTX/TXT file, and start a
   lesson from it — you should see grounded explanations referencing your
   material.
3. Start a second lesson with just a topic name (no upload) to confirm
   topic-only teaching.
4. During a lesson, click "🔊 Play voice" to confirm real AI narration.
5. If `DID_API_KEY` is set, click "🎬 Generate avatar video" to confirm real
   talking-head video generation (takes ~20–40 seconds).
6. Reply in a different language mid-lesson and confirm the AI Teacher
   switches languages while keeping the lesson context.
7. Click "Take final assessment," answer the quiz, and check your Profile
   page afterward for updated strengths/weaknesses/recommendations.

---

## 8. Notes & limitations

- Legacy binary `.doc` and `.ppt` formats are intentionally rejected with a
  clear error asking for `.docx`/`.pptx`/`.pdf`/`.txt` instead, since those
  old binary formats require additional native tooling to parse reliably.
  This is a deliberate accuracy trade-off, not a missing feature — all
  actively-used modern formats are fully supported.
- Avatar video generation depends on the third-party D-ID service and your
  own API key/credits there, exactly like the OpenAI key it sits alongside.
- SQLite is used for zero-ops persistence; for very high concurrent write
  load you would migrate to Postgres using the same `migrations/init.sql`
  schema as a starting point.
