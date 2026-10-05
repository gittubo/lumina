# LUMINA Architecture

## Overview

- **Frontend**: Next.js 14 (App Router) + React 18
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis + Bull — one queue per generation type, each with its own worker
- **AI Services**: Stability AI, Runway, Meshy, Eleven Labs (each behind its own service + worker pair)

## System Architecture

```
┌─────────────────────────────┐
│   Frontend (Next.js)        │
│   auth store (Zustand)      │
└──────────────┬──────────────┘
               │ HTTP/REST (Bearer JWT)
┌──────────────▼─────────────────────────────────────────┐
│  Backend (Express) — src/app.ts                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ helmet, cors, morgan, json body parsing          │   │
│  │ authMiddleware → rate limit → validate (Joi)      │   │
│  │  → verifyProjectOwnership → dailyGenerationCap     │   │
│  │ Routes → Controllers → Services                   │   │
│  └──────────────┬──────────────────────────────────┘   │
└─────────────────┼────────────────────────────────────────┘
                  │
    ┌─────────────┼───────────────┬─────────────────┐
    │             │               │                 │
┌───▼──┐   ┌──────▼──────┐  ┌────▼─────────┐  ┌─────▼──────┐
│  DB  │   │   Redis     │  │  4x Bull      │  │  External   │
│ (PG) │   │  (queue     │  │  queues +     │  │  AI APIs    │
│      │   │   backend)  │  │  workers      │  │  (4 providers)│
└──────┘   └─────────────┘  └───────────────┘  └────────────┘
```

The Bull workers currently run **in-process** alongside the API server (started in `src/index.ts`). For horizontal scaling, they can be split into a separate process/container pointed at the same `REDIS_URL` without any other code changes — the queue definitions in `src/queues/` are already decoupled from `src/app.ts`.

## Request Flow: Generation (all four types follow this shape)

Example — image generation:

1. Frontend `POST /api/generations/image` with a Bearer token and `{ prompt, projectId, ... }`
2. `authMiddleware` verifies the JWT, attaches `req.userId`
3. `generationRateLimiter` checks the per-user hourly request count (Redis-independent, in-memory)
4. `validate(generateImageSchema)` (Joi) rejects malformed input before anything hits the database
5. `verifyProjectOwnership` confirms `projectId` belongs to `req.userId` (prevents attaching a generation to someone else's project)
6. `dailyGenerationCap` checks the user hasn't hit their 24h generation limit
7. `stabilityAiService.generateImage()` creates a `Generation` row with `status: 'pending'` and enqueues a job on `imageGenerationQueue`
8. The response returns immediately with the `pending` generation — the frontend polls `GET /api/generations/:id` (or the project's generation list) until it resolves
9. `imageGenerationWorker` picks the job off the queue, sets `status: 'processing'`, calls the Stability AI API, and on success writes the output URL and sets `status: 'completed'` (or `'failed'` with an error message after Bull's retry attempts are exhausted)

Video (Runway) and 3D (Meshy) follow the same shape, but their workers poll a provider-side task ID to completion rather than getting a synchronous response — video takes a few minutes, 3D is a two-stage preview→refine pipeline that can take longer. Audio (Eleven Labs) is unique in that the provider's TTS endpoint responds synchronously with the finished audio; it's still queued for consistency and to smooth out request bursts.

## Request Flow: Lumina Assistant (chat)

The chatbot doesn't use the queue — a reply is streamed straight back to the browser while it's generated.

1. Frontend `POST /api/chat/conversations` (optionally with a `projectId`, ownership-checked) creates an empty `Conversation`
2. Frontend `POST /api/chat/conversations/:id/messages` with `{ message }`; `authMiddleware`, `chatRateLimiter` (per-user hourly), and `validate(sendMessageSchema)` run first
3. `chatService.sendMessage()` loads the conversation (scoped to `req.userId`), rebuilds the history, and calls Claude (`claude-opus-5-5` by default, override with `CHAT_MODEL`) via the Anthropic SDK's streaming API. The system prompt describes LUMINA's generators; for project-scoped chats a second system block adds the project's title, description, and recent generation prompts
4. Each text fragment is forwarded to the browser as a Server-Sent Event (`delta`); when the reply finishes the user and assistant messages are saved in one transaction and a `done` event carries them back. Errors before the first token are a normal JSON error response; later ones arrive as an `error` event
5. If the browser disconnects, the Claude request is aborted and nothing is saved, so a failed or stopped message can simply be re-sent

Assistant messages store the full content blocks Claude returned (`ChatMessage.content`, including thinking blocks) and are replayed verbatim on later turns, keeping the history append-only as the API expects. Requests opt into server-side refusal fallback (`fallbacks: "default"`) and prompt caching of the conversation prefix.

## Key Modules

### Auth (`services/authService.ts`, `middleware/authMiddleware.ts`)
- JWT-based; `bcryptjs` for password hashing
- `authMiddleware` attaches `req.userId`/`req.user` to authenticated requests

### Generation services + workers (`services/*Service.ts`, `workers/*Worker.ts`, `queues/*Queue.ts`)
- One triplet per provider (Stability AI, Runway, Meshy, Eleven Labs)
- The service layer only ever creates the DB row and enqueues — no external API calls happen on the request thread
- Each worker owns its provider's request/response or request/poll shape

### Abuse & cost protection (`middleware/rateLimiter.ts`, `middleware/dailyGenerationCap.ts`, `validation/`)
- `authRateLimiter` — per-IP, on `/auth/register` and `/auth/login`
- `generationRateLimiter` — per-user, on all `/generations/*` routes
- `chatRateLimiter` — per-user, on sending chat messages (each one is a paid Claude API call)
- `dailyGenerationCap` — per-user, a live count of generations in the last 24h, independent of the rate limiter (bounds total spend, not just burst rate)
- Joi schemas cap prompt length and validate enum/numeric fields before any provider is called

## Database Schema

- `users` — accounts, hashed passwords
- `projects` — owned by a user, contain generations
- `generations` — `type` (`image`/`video`/`3d`/`audio`), `status` (`pending`/`processing`/`completed`/`failed`), `outputUrl`, `metadata` (JSON, provider-specific), `error`

## API Conventions

RESTful, all under `/api`:
- `GET /api/resource` — list/retrieve
- `POST /api/resource` — create
- `PUT /api/resource/:id` — update
- `DELETE /api/resource/:id` — delete

All routes except `/api/health`, `/api/docs`, `/api/auth/register`, and `/api/auth/login` require a `Bearer` JWT.

## Testing Architecture

**Backend:**
- **Unit tests** — co-located in `__tests__/` next to the module they cover (validation schemas, `authService`, individual middleware). Prisma/bcrypt/jwt/axios are mocked at the module boundary.
- **Integration tests** — `src/__tests__/app.integration.test.ts`, using Supertest against the real `app.ts` (Prisma and Bull mocked). These catch route-wiring mistakes — an unmounted router, wrong middleware order — that isolated unit tests can't see.

**Frontend:**
- Jest + React Testing Library, `jest-environment-jsdom`, using Next.js's built-in `next/jest` transformer
- Co-located in `__tests__/` next to the module/page they cover: `lib/__tests__/` (pure logic — `getApiErrorMessage`, the Zustand auth store against real jsdom `localStorage`), and one per page under `app/*/__tests__/` (login, register, dashboard) using React Testing Library + `@testing-library/user-event` against mocked `next/navigation`, `lib/api`, and `lib/authStore`

CI (`.github/workflows/ci.yml`) runs all of the above, plus type-checking and linting for both frontend and backend, on every push/PR.

## Deployment

```
Docker Compose
├── frontend  (Next.js)
├── backend   (Express — API server + in-process workers)
├── postgres
└── redis
```

`docker-compose.yml` orchestrates all four over an internal Docker network.
