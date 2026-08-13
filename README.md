# LUMINA - AI Creative Platform

**LUMINA** is a multimodal AI creative platform for generating images, video, 3D models, and voice audio through a single project-based workspace.

## 🚀 Features

- **Text-to-Image Generation** — Stability AI (Stable Diffusion XL)
- **Text-to-Video Generation** — Runway (Gen-4.5)
- **Text-to-3D Generation** — Meshy (two-stage preview → textured refine pipeline), with an interactive Three.js viewer in the browser
- **Text-to-Speech / Voice Synthesis** — Eleven Labs
- **Project Management** — Create projects, generate content within them, browse generation history
- **Background Job Processing** — every generation runs through a Redis-backed Bull queue with automatic retries, so it survives a server restart mid-generation
- **Usage Protection** — per-user hourly rate limiting, a daily generation cap, and request validation guard the app (and your API bills) against runaway usage

Not yet implemented: real-time collaboration, file export beyond the generated asset URL itself.

## 📋 Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router) with React 18
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **3D Rendering:** Three.js (`GLTFLoader` + `OrbitControls`)
- **State Management:** Zustand (auth state, persisted to `localStorage`)
- **HTTP:** Axios

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** Custom JWT-based auth (`jsonwebtoken` + `bcryptjs`) — not NextAuth
- **Task Queue:** Bull (Redis-backed), one queue per generation type
- **Validation:** Joi
- **Rate limiting:** `express-rate-limit`, keyed per-user on generation routes

### Infrastructure
- **Containerization:** Docker & Docker Compose
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — type-checks, lints, tests, and builds both frontend and backend on every push/PR

## 🔗 AI Service Integrations

| Provider | Used for | Backend module |
|---|---|---|
| Stability AI | Images | `services/stabilityAiService.ts`, `workers/imageGenerationWorker.ts` |
| Runway | Video | `services/runwayService.ts`, `workers/videoGenerationWorker.ts` |
| Meshy | 3D models | `services/meshyService.ts`, `workers/modelGenerationWorker.ts` |
| Eleven Labs | Voice/audio | `services/elevenLabsService.ts`, `workers/audioGenerationWorker.ts` |

Each provider follows the same pattern: an API route validates the request and confirms the user owns the target project, a service creates a `pending` `Generation` row and enqueues a job, and a worker (started alongside the API server) does the actual API call and updates the row to `completed`/`failed`. The frontend polls in-progress generations until they resolve.

## 📁 Project Structure

```
lumina/
├── frontend/
│   ├── app/                       # Next.js App Router pages
│   │   ├── login/, register/      # Auth pages
│   │   └── dashboard/             # Protected dashboard + project detail/generation UI
│   ├── components/                # AuthProvider, ModelViewer (Three.js)
│   ├── lib/                       # api.ts (Axios client), authStore.ts (Zustand)
│   └── types/                     # Shared frontend TypeScript types
│
├── backend/
│   ├── src/
│   │   ├── routes/                # Express route definitions
│   │   ├── controllers/           # Request handlers
│   │   ├── services/               # One per AI provider + auth/project services
│   │   ├── workers/                # Bull queue processors, one per generation type
│   │   ├── queues/                 # Bull queue definitions
│   │   ├── middleware/             # auth, rate limiting, daily cap, ownership check, validation
│   │   ├── validation/             # Joi schemas
│   │   ├── seeds/                  # Dev database seed script
│   │   ├── app.ts                  # Express app construction (importable by tests)
│   │   └── index.ts                # Entrypoint — starts the server + workers
│   ├── prisma/                     # Schema and migrations
│   └── src/**/__tests__/           # Unit tests (co-located) + integration tests (src/__tests__/)
│
├── cli/
│   ├── src/
│   │   ├── commands/                # login, logout, whoami, projects, generate, generations, config
│   │   ├── config.ts                 # ~/.lumina/config.json read/write, env var overrides
│   │   ├── api.ts                    # Axios client wired to the saved token
│   │   ├── poll.ts                   # Shared "wait for generation to complete" loop
│   │   └── index.ts                  # Entrypoint — commander wiring
│   └── README.md                     # CLI usage guide
│
├── docker-compose.yml
├── .github/workflows/ci.yml
└── docs/
```

## 🖥️ CLI

A terminal client for the same API the web app uses — login, manage projects, and run generations without leaving the terminal. See [cli/README.md](./cli/README.md) for full usage; quick start:

```bash
cd cli && npm install && npm run build && npm link
lumina login
lumina generate image "a red fox in the snow" --project <projectId>
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (or PostgreSQL 14+ and Redis running locally)
- API keys for whichever generation providers you want working: Stability AI, Runway, Meshy, Eleven Labs (each is optional — a provider without a key just fails that generation type with a clear error, the rest of the app works fine)

### Installation

```bash
git clone https://github.com/gittubo/lumina.git
cd lumina

# Install dependencies (no lockfile is committed yet, so this resolves fresh —
# see docs/DEVELOPMENT.md for a note on generating one)
cd frontend && npm install && cd ..
cd backend && npm install && cd ..   # postinstall runs `prisma generate` automatically
```

Set up environment variables:
```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

Start with Docker Compose (development — hot reload via bind mounts):
```bash
docker-compose up
```

For a production-style deployment (builds the real images, no bind mounts or dev servers), see `docker-compose.prod.yml` and `.env.example` at the repo root:
```bash
cp .env.example .env   # fill in real secrets
docker compose -f docker-compose.prod.yml up --build
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy   # first run only
```

Or run locally (requires Postgres + Redis already running):
```bash
cd backend && npx prisma migrate dev && npm run dev    # terminal 1
cd frontend && npm run dev                               # terminal 2
```

Optionally seed a demo account:
```bash
cd backend && npm run seed
# creates demo@lumina.dev / demo12345 with one sample project
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API health check: http://localhost:5000/api/health
- Interactive API docs (Swagger UI): http://localhost:5000/api/docs

## 🧪 Testing

```bash
cd backend
npm test              # unit + integration tests (Jest + Supertest, no live DB/Redis needed — mocked)
npm run test:coverage
npm run type-check
npm run lint
```

```bash
cd frontend
npm test              # Jest + React Testing Library, jsdom environment
npm run test:coverage
npm run type-check
npm run lint
```

The same checks run automatically in CI on every push and pull request against `main`.

## 📚 Documentation

See [docs/](./docs) for the [Architecture Guide](./docs/ARCHITECTURE.md) and [Development Guide](./docs/DEVELOPMENT.md).

## 🔐 Environment Variables

See `backend/.env.example` for the full list. The generation providers, database, and Redis connection are all required for full functionality; notable ones:
```
DATABASE_URL=...
REDIS_URL=...
JWT_SECRET=...
STABILITY_AI_API_KEY=...
RUNWAY_API_KEY=...
MESHY_API_KEY=...
ELEVEN_LABS_API_KEY=...
HOURLY_GENERATION_RATE_LIMIT=30   # per-user, generation endpoints
DAILY_GENERATION_LIMIT=50         # per-user, all generation types combined
```

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome — open an issue or a pull request.

## 📞 Support

For issues and feature requests, please use GitHub Issues.

---

**LUMINA** - Where creativity meets artificial intelligence.
