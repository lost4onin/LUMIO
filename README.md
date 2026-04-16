<div align="center">

<br />

# LUMIO

### *Where every student is seen, every struggle is understood, every parent is informed.*

<br />

[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_15-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)

<br />

Built for **IEEE CODE2CURE SIGHT Day Congress 4.0** — TBS & INSAT IEEE Student Branches, Tunisia.

</div>

---

## Table of Contents

- [About the Project](#-about-the-project)
- [Features](#-features)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [n8n Email Automation](#-n8n-email-automation)
- [User Roles & Portals](#-user-roles--portals)
- [Team](#-team)

---

## 🎯 About the Project

**LUMIO** is a real-time, privacy-first educational platform that connects students, teachers, and parents in a single unified ecosystem. It addresses a critical challenge in modern classrooms — students with attention difficulties often go undetected until they are significantly behind.

Using **MediaPipe FaceMesh running entirely in the browser**, LUMIO tracks student focus continuously during study sessions. Focus data is streamed to the teacher's dashboard in real time. When a student's attention drops, the teacher is alerted with contextual data. When persistent patterns emerge, parents are automatically notified through automated email workflows.

**What makes it different:**
- 🔒 **Zero video surveillance** — all computer vision runs on the student's device. No frames are ever uploaded.
- ⚡ **Real-time** — WebSocket-based live streaming from every student to the teacher dashboard simultaneously.
- 📧 **Automated communication** — n8n workflows send clinically-aware alerts to teachers and parents without manual effort.
- 🏥 **Clinically grounded** — focus thresholds, risk tiers, and alert logic are validated against DSM-5 criteria.

---

## ✨ Features

| Role | Key Features |
|---|---|
| **Student** | Live focus session with Pomodoro timer, session history, focus timeline, homework submission, XP gamification |
| **Teacher** | Real-time classroom dashboard, per-student 30-day focus trend, distraction breakdown, homework management |
| **Parent** | Weekly focus reports, session history, homework completion tracking |
| **Admin** | School-wide analytics, teacher management, system settings |
| **Platform** | Role-based authentication (JWT), n8n alert automation, FAISS vector search for RAG |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                      │
│  React + Vite + TypeScript          MediaPipe FaceMesh       │
│  Port 5173 (dev)                    Focus tracking — local   │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST / WebSocket
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                          │
│  Port 8000  ·  Async SQLAlchemy  ·  JWT Auth                │
│  FAISS vector search  ·  Ollama / Groq LLM                  │
└───────┬───────────────┬──────────────────┬──────────────────┘
        │               │                  │
        ▼               ▼                  ▼
  PostgreSQL 15      Redis 7             n8n
  Port 5432          Port 6379          Port 5678
  (persistent)       (cache/pubsub)     (email automation)
```

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS | Recharts for analytics, Framer Motion for animations |
| **Backend** | FastAPI, Python 3.11, SQLAlchemy (async) | Alembic migrations, Pydantic v2 schemas |
| **Database** | PostgreSQL 15 | → Supabase in production |
| **Cache / PubSub** | Redis 7 | → Upstash in production |
| **Automation** | n8n | Gmail OAuth2, 3 pre-built workflows |
| **LLM (dev)** | Ollama — `mistral:7b` + `nomic-embed-text` | Local, free, no API key |
| **LLM (prod)** | Groq Cloud — `llama-3.3-70b-versatile` | Free tier, switch via `LLM_PROVIDER=groq` |
| **CV / Focus** | MediaPipe FaceMesh | Runs entirely in browser — no video leaves device |

---

## 📁 Project Structure

```
LUMIO/
├── backend/
│   ├── app/
│   │   ├── routers/          # auth, analytics, homework, rag
│   │   ├── services/         # alerts, recommender, rule_engine, rag_service, n8n_service
│   │   ├── schemas/          # Pydantic request/response models
│   │   ├── config.py         # all settings from .env
│   │   ├── database.py       # SQLAlchemy models + engine
│   │   └── main.py           # FastAPI app entrypoint
│   ├── scripts/
│   │   └── seed_demo.py      # seed the DB with demo users + data
│   ├── tests/                # pytest unit & integration tests
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── components/       # shared UI components + shadcn/ui
│       ├── contexts/         # AuthContext (JWT + role routing)
│       ├── pages/
│       │   ├── student/      # Dashboard, LiveSession, SessionSummary, Homework, Settings
│       │   ├── teacher/      # Dashboard, LiveClass, Students, StudentDetail, Homework
│       │   ├── parent/       # Dashboard, Homework, Settings
│       │   └── admin/        # Dashboard, Teachers, Settings
│       ├── App.tsx           # routing with RequireAuth role guards
│       └── main.tsx
│
├── n8n-workflows/            # importable JSON workflow files
│   ├── 01_focus_alert.json       # teacher alert when student focus < 40%
│   ├── 02_high_risk_alert.json   # parent + teacher alert for high-risk flag
│   └── 03_weekly_report.json     # Sunday 8AM parent weekly digest
│
├── faiss_index/              # pre-built FAISS vector index (KB embeddings)
├── kb/                       # clinical knowledge base PDFs
├── docker-compose.yml
├── wait-docker.ps1           # waits for Postgres healthcheck before running migrations
└── .env                      # local environment (not committed)
```

---

## ⚙️ Prerequisites

Ensure the following are installed and running on your machine before proceeding:

### Required

| Tool | Min Version | Install |
|---|---|---|
| **Docker Desktop** | Latest | [docker.com/products/docker-desktop](https://docker.com/products/docker-desktop) |
| **Node.js** | v18.0.0 | [nodejs.org](https://nodejs.org) |
| **npm** | v9.0.0 | Bundled with Node.js |
| **Git** | Any | [git-scm.com](https://git-scm.com) |

### For Local LLM (Recommended for dev)

| Tool | Purpose | Install |
|---|---|---|
| **Ollama** | Run LLMs locally, free, no API key | [ollama.com](https://ollama.com) |

> **Note:** If you prefer to skip Ollama entirely, you can set `LLM_PROVIDER=groq` in `.env` and use a [Groq](https://console.groq.com) API key instead (free tier available).

---

## 🚀 Installation & Setup

### Step 1 — Clone the repository

```bash
git clone https://github.com/lost4onin/LUMIO.git
cd LUMIO
```

---

### Step 2 — Configure environment variables

The `.env` file at the root is the single source of truth for all services. There is **no `.env.example`** yet, so create the file manually:

```bash
# Create the env file
# Windows (PowerShell)
New-Item .env

# Mac / Linux
touch .env
```

Then open `.env` and paste the following, filling in the required values:

```env
# ── Database ─────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://lumio:localdev@postgres:5432/lumio

# ── Redis ────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Auth ─────────────────────────────────────────────────────
# REQUIRED: generate a random 32-character string
# Mac/Linux: openssl rand -hex 32
# Windows:   [System.Web.Security.Membership]::GeneratePassword(32,0)
JWT_SECRET_KEY=REPLACE_WITH_A_32_CHAR_RANDOM_STRING

# ── LLM — choose one provider ────────────────────────────────
LLM_PROVIDER=ollama            # or "groq" for cloud

# Ollama (for local dev — Ollama must be running on your machine)
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=mistral:7b
OLLAMA_EMBED_MODEL=nomic-embed-text

# Groq (alternative — get free key at console.groq.com)
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# ── n8n ──────────────────────────────────────────────────────
N8N_BASE_URL=http://n8n:5678

# Leave empty to disable alerts in dev, or paste your n8n webhook URLs
N8N_WEBHOOK_HIGH_RISK=
N8N_WEBHOOK_STRUGGLE=
N8N_WEBHOOK_WEEKLY=

# ── Supabase (production only, leave blank for local dev) ─────
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

> ⚠️ **Never commit `.env` to git.** It is already in `.gitignore`.

---

### Step 3 — Pull Ollama models (if using local LLM)

Make sure Ollama is installed and the app is running, then pull the two required models:

```bash
ollama pull mistral:7b
ollama pull nomic-embed-text
```

This downloads approximately **5GB** total. You only need to do this once.

> Confirm Ollama is running: open `http://localhost:11434` in your browser. You should see `"Ollama is running"`.

---

### Step 4 — Start backend services with Docker

This single command builds and starts all 4 services: **FastAPI, PostgreSQL, Redis, and n8n**.

```bash
docker-compose up --build
```

> **First run:** Docker will download base images (~2–3 GB). This only happens once.  
> **Subsequent runs:** Use `docker-compose up` (without `--build`) for a fast start.

To run in the background (detached mode):

```bash
docker-compose up --build -d
```

**Verify all containers are healthy:**

```bash
docker-compose ps
```

You should see all 4 services with status `running` or `healthy`:

```
NAME               STATUS
lumio-api          running
lumio-postgres     healthy
lumio-redis        healthy
lumio-n8n          running
```

---

### Step 5 — Seed the database with demo data

Run this once after the containers are healthy to populate demo users and sessions:

```bash
# Windows (PowerShell)
docker exec lumio-api python scripts/seed_demo.py

# Mac / Linux
docker exec lumio-api python scripts/seed_demo.py
```

This creates demo accounts for all 4 roles so you can log in immediately.

---

### Step 6 — Start the frontend dev server

Open a **new terminal** and run:

```bash
cd frontend
npm install
npm run dev
```

Vite will start on `http://localhost:5173` with hot-module replacement enabled.

---

## 🌐 Running the Application

Once both Docker and the Vite dev server are running, open these URLs:

| Service | URL | Purpose |
|---|---|---|
| **LUMIO App** | [localhost:5173](http://localhost:5173) | Main frontend (React) |
| **API Docs (Swagger)** | [localhost:8000/docs](http://localhost:8000/docs) | FastAPI interactive API explorer |
| **API Docs (Redoc)** | [localhost:8000/redoc](http://localhost:8000/redoc) | Alternative API reference |
| **n8n Automation** | [localhost:5678](http://localhost:5678) | Email workflow editor |
| **PostgreSQL** | `localhost:5432` | Connect with any DB client (e.g. DBeaver) |
| **Redis** | `localhost:6379` | Inspect with `redis-cli` or RedisInsight |

### Demo Login Credentials

| Role | Email | Password |
|---|---|---|
| Student | `student@lumio.dev` | `demo1234` |
| Teacher | `teacher@lumio.dev` | `demo1234` |
| Parent | `parent@lumio.dev` | `demo1234` |
| Admin | `admin@lumio.dev` | `demo1234` |

---

## 🔑 Environment Variables

Full reference for all supported environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL async connection string |
| `REDIS_URL` | ✅ | — | Redis connection URL |
| `JWT_SECRET_KEY` | ✅ | — | JWT signing secret — min 32 chars |
| `LLM_PROVIDER` | ✅ | `ollama` | `"ollama"` or `"groq"` |
| `OLLAMA_BASE_URL` | — | `http://host.docker.internal:11434` | Ollama server (local dev) |
| `OLLAMA_MODEL` | — | `mistral:7b` | Generation model name |
| `OLLAMA_EMBED_MODEL` | — | `nomic-embed-text` | Embedding model name |
| `GROQ_API_KEY` | — | *(empty)* | Groq API key for cloud LLM |
| `GROQ_MODEL` | — | `llama-3.3-70b-versatile` | Groq model name |
| `N8N_BASE_URL` | — | `http://n8n:5678` | Internal n8n URL (container-to-container) |
| `N8N_WEBHOOK_HIGH_RISK` | — | *(empty)* | Webhook URL for high-risk student alert |
| `N8N_WEBHOOK_STRUGGLE` | — | *(empty)* | Webhook URL for real-time focus drop alert |
| `N8N_WEBHOOK_WEEKLY` | — | *(empty)* | Webhook URL for weekly parent report cron |
| `SUPABASE_URL` | — | *(empty)* | Supabase project URL (production only) |
| `SUPABASE_ANON_KEY` | — | *(empty)* | Supabase anon key (production only) |

---

## 📧 n8n Email Automation

Three ready-to-import n8n workflow files are included in `n8n-workflows/`:

| File | Trigger | Recipients | When |
|---|---|---|---|
| `01_focus_alert.json` | FastAPI webhook | Teacher | Student focus < 40% for 5+ min during live session |
| `02_high_risk_alert.json` | FastAPI webhook | Parent + Teacher | Risk score ≥ 65% + 7-day persistent pattern |
| `03_weekly_report.json` | Cron (Sun 8AM) | All parents | Every Sunday — full weekly digest with stats |

### Importing workflows into n8n

1. Open [localhost:5678](http://localhost:5678)
2. **Workflows → Import from file**
3. Select a `.json` file from `n8n-workflows/`
4. Connect your **Gmail OAuth2** credential
5. Copy the webhook URL and paste it into the corresponding `.env` variable
6. Activate the workflow

---

## 👤 User Roles & Portals

```
/student/dashboard        Focus stats, recent sessions, upcoming homework
/student/session          Live focus timer with Pomodoro + MediaPipe tracking
/student/session/:id/summary  Post-session stats and focus timeline
/student/homework         Assignment list with file submission
/student/settings         Profile and notification preferences

/teacher/dashboard        Class overview, at-risk students, recent activity
/teacher/live             Real-time class monitor with per-student focus bars
/teacher/students         Full student roster with risk filtering and search
/teacher/students/:id     Individual student 30-day trend + distraction breakdown
/teacher/homework         Assignment management — create, track submissions

/parent/dashboard         Child's weekly focus trend + recent sessions
/parent/homework          Child's assignment completion and grades
/parent/settings          Profile and notification settings

/admin/dashboard          School-wide KPIs and analytics
/admin/teachers           Teacher management
/admin/settings           System configuration
```

---

## 🧑‍💻 Running Tests

```bash
# Run the full test suite inside the container
docker exec lumio-api pytest

# Run with verbose output
docker exec lumio-api pytest -v

# Run a specific test file
docker exec lumio-api pytest tests/test_auth.py
```

---

## 🛑 Stopping the Application

```bash
# Stop all containers (keeps data volumes)
docker-compose down

# Stop and remove all data (full reset)
docker-compose down -v
```

---

## 👥 Team

| Member | Role | Owns |
|---|---|---|
| **Person A** | Backend & AI | FastAPI, database schema, FAISS / RAG pipeline, rule engine, n8n, Docker |
| **Person B** | Frontend & DevOps | React portals, MediaPipe CV module, routing, Vite config, Vercel deployment |
| **Clinical Advisor** | DSM-5 Validation | Focus thresholds, risk tier definitions, evidence-based alert logic |

---

<div align="center">
  <br />
  <p>Built with ❤️ at <strong>IEEE CODE2CURE SIGHT Day Congress 4.0</strong></p>
  <p><sub>Privacy-first · No video stored · All focus tracking is 100% on-device</sub></p>
  <br />
</div>
