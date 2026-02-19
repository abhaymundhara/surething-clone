# 🧠 SureThing Clone

Self-hosted autonomous AI agent platform — a stripped-down clone of [surething.io](https://surething.io) focused on the core agent architecture with GitHub as the sole connector.

## Architecture

```
┌─────────────────────────────────────┐
│        DESKTOP APP (Tauri 2.0)      │
│  Chat · Tasks · Files · Settings    │
│            WebSocket + REST         │
└──────────────────┬──────────────────┘
                   │
┌──────────────────┴──────────────────┐
│          API LAYER (Hono)           │
│  Auth · Chat · Tasks · Files · WS   │
└──────────────────┬──────────────────┘
                   │
┌──────────────────┴──────────────────┐
│          AGENT CORE (Brain)         │
│  Conductor · Prompt · Tools · Memory │
│  Task Engine · Heartbeat · Skills    │
│  GitHub Connector (12 tools)         │
└──────────────────┬──────────────────┘
                   │
┌──────────────────┴──────────────────┐
│           DATA LAYER                │
│  Postgres + pgvector · Redis/BullMQ │
│  MinIO (files) · Ollama (LLM)       │
└─────────────────────────────────────┘
```

## Features

- **Agent Brain** — LLM-powered conductor with tool calling, persistent memory, and proactive execution
- **Cell System** — Semantic context clusters with compressed cognition (L2/L3/L5/L6 layers)
- **Task Engine** — Delay/cron scheduling, HITL approval flows, task chains
- **GitHub Connector** — 12 tools: repos, issues, PRs, commits, branches, code search, actions, webhooks
- **File Uploads** — MinIO-backed storage with AI analysis pipeline
- **Desktop App** — Tauri 2.0 with chat, tasks, files, settings, system tray
- **Heartbeat System** — YAML-configured proactive checks on cron schedules
- **Memory System** — User memories (profile, preferences, rules) + per-Cell compressed state

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + TypeScript |
| API | Hono |
| Database | PostgreSQL 16 + pgvector |
| ORM | Drizzle |
| Queue | BullMQ + Redis |
| File Storage | MinIO (S3-compatible) |
| LLM | Ollama (local) + OpenAI-compatible fallback |
| Desktop | Tauri 2.0 (Rust) |
| Frontend | React + Tailwind CSS + Zustand |
| GitHub | Octokit SDK |

## Quick Start

### Prerequisites

- Node.js 22+ or Bun
- pnpm (`npm install -g pnpm`)
- Docker & Docker Compose
- Rust (for Tauri desktop app)
- Ollama (`ollama serve`)

### 1. Clone & Install

```bash
git clone https://github.com/abhaymundhara/surething-clone.git
cd surething-clone
pnpm install
```

### 2. Start Infrastructure

```bash
# Start Postgres, Redis, and MinIO
docker compose up -d

# Pull an LLM model
ollama pull llama3.2
ollama pull nomic-embed-text
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings (defaults work for local dev)
```

### 4. Run Database Migrations

```bash
cd packages/server
pnpm run db:generate
pnpm run db:migrate
```

### 5. Start the Server

```bash
# From project root
pnpm --filter @surething/server dev
```

Server starts at `http://localhost:3001`

### 6. Start the Desktop App

```bash
# From project root
cd packages/desktop
pnpm tauri dev
```

### 7. Connect GitHub

1. Create a GitHub OAuth App at https://github.com/settings/developers
2. Set callback URL to `http://localhost:3001/api/connections/github/callback`
3. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to your `.env`
4. In the app Settings panel, click "Connect GitHub"

## Project Structure

```
surething-clone/
├── packages/
│   ├── server/                    # Backend API
│   │   ├── src/
│   │   │   ├── agent/             # 🧠 Agent core
│   │   │   │   ├── conductor.ts   # Central orchestrator
│   │   │   │   ├── prompt.ts      # System prompt builder
│   │   │   │   ├── tools.ts       # Tool registry (6 built-in)
│   │   │   │   ├── memory.ts      # L2/L3/L5/L6 compression
│   │   │   │   ├── heartbeat.ts   # Proactive checks
│   │   │   │   ├── scheduler.ts   # BullMQ task scheduling
│   │   │   │   └── skills.ts      # Pluggable skill loader
│   │   │   ├── connectors/
│   │   │   │   └── github/        # GitHub integration
│   │   │   │       ├── client.ts   # Octokit wrapper
│   │   │   │       ├── tools.ts    # 12 GitHub tools
│   │   │   │       └── webhooks.ts # Event handler
│   │   │   ├── routes/            # API endpoints
│   │   │   ├── db/                # Drizzle schema + migrations
│   │   │   └── lib/               # Utilities
│   │   └── package.json
│   │
│   ├── desktop/                   # Tauri desktop app
│   │   ├── src-tauri/             # Rust backend
│   │   ├── src/                   # React frontend
│   │   │   ├── views/             # Chat, Tasks, Files, Settings
│   │   │   ├── components/        # Sidebar, MessageBubble, ApprovalCard
│   │   │   └── lib/               # Store, API, WebSocket
│   │   └── package.json
│   │
│   └── shared/                    # Shared types & constants
│
├── docker-compose.yml             # Postgres, Redis, MinIO
├── .env.example
└── turbo.json
```

## How It Works

1. **User sends a message** → WebSocket or REST API
2. **Conductor assembles context** → Cell state, user memories, conversation history, connected apps
3. **LLM reasons** → Decides what tools to call, what tasks to create
4. **Tools execute** → GitHub API, search, draft creation, memory saves
5. **HITL flow** → If action needs approval, draft is created and user sees an approval card
6. **State compresses** → Every 10 messages, conversation gets compressed into L2/L3/L5/L6 layers
7. **Heartbeats run** → Proactive checks on configured schedules

## License

MIT
