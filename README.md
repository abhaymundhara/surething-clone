# 🧠 SureThing Clone

Self-hosted autonomous AI agent platform — inspired by [surething.io](https://surething.io).

**Core:** Agent brain with persistent memory, task scheduling, and human-in-the-loop approval flows.
**Connector:** GitHub (full API — issues, PRs, commits, code search, webhooks).
**Desktop:** Tauri 2.0 app with chat, tasks, file uploads, and system tray.
**LLM:** Ollama (local-first) with OpenAI-compatible fallback.

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/abhaymundhara/surething-clone.git
cd surething-clone
pnpm install

# 2. Start infrastructure
docker compose up -d

# 3. Setup database
cp .env.example .env
pnpm db:generate
pnpm db:migrate

# 4. Pull Ollama model
ollama pull llama3.2
ollama pull nomic-embed-text

# 5. Start development
pnpm dev
```

## Architecture

```
Desktop App (Tauri 2.0) → API (Hono) → Agent Core → Data Layer
                                           ↓
                                    GitHub Connector
                                    File Storage (MinIO)
                                    Task Queue (BullMQ)
                                    LLM (Ollama)
```

See [full architecture spec](https://www.notion.so/SureThing-Clone-Architecture-Build-Spec-30bafd0c91338112b0c4c4e1e184bde0) for detailed documentation.

## Project Structure

```
surething-clone/
├── packages/
│   ├── server/     # Hono API + Agent Core
│   ├── desktop/    # Tauri 2.0 + React
│   └── shared/     # Shared types & constants
├── docker-compose.yml
└── turbo.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | Hono (TypeScript) |
| Database | PostgreSQL 16 + pgvector |
| ORM | Drizzle |
| Queue | BullMQ + Redis |
| Storage | MinIO (S3-compatible) |
| LLM | Ollama / OpenAI-compatible |
| Desktop | Tauri 2.0 |
| Frontend | React + Tailwind + shadcn/ui |

## License

MIT
