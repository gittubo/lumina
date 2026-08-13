# LUMINA Development Guide

## Prerequisites
- Node.js 18+
- Docker & Docker Compose (recommended), or PostgreSQL 14+ and Redis running locally
- Git

## Local Setup

### Option 1: Docker (recommended)

```bash
git clone https://github.com/gittubo/lumina.git
cd lumina
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker-compose up
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run seed   # optional demo account
```

### Option 2: Manual setup

```bash
cd frontend && npm install && cd ..
cd backend && npm install && cd ..   # postinstall runs `prisma generate`

cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env

# Start Postgres and Redis yourself (or via `docker-compose up postgres redis`)

cd backend
npx prisma migrate dev
npm run seed     # optional — creates demo@lumina.dev / demo12345
npm run dev      # terminal 1

cd ../frontend
npm run dev       # terminal 2
```

> **Note on lockfiles:** this repo doesn't currently commit a `package-lock.json` in either `frontend/` or `backend/`, so `npm install` resolves fresh each time rather than `npm ci`. If you want reproducible installs and faster CI, run `npm install` once in each directory, commit the resulting lockfiles, and switch `npm install` to `npm ci` in `.github/workflows/ci.yml`.

## Project Structure

### Frontend (`/frontend`)
```
frontend/
├── app/
│   ├── login/, register/          # Auth pages
│   ├── dashboard/                 # Project list
│   │   └── projects/[id]/         # Generation UI (image/video/3d/audio tabs)
│   └── page.tsx                    # Landing page
├── components/
│   ├── AuthProvider.tsx            # Hydrates auth state from localStorage on load
│   └── ModelViewer.tsx             # Interactive Three.js GLB viewer
├── lib/
│   ├── api.ts                      # Axios client + typed request helpers
│   └── authStore.ts                # Zustand auth store
└── types/                          # Shared frontend types
```

### Backend (`/backend`)
```
backend/
├── src/
│   ├── app.ts                 # Express app construction (no side effects — safe to import in tests)
│   ├── index.ts                # Entrypoint: app.listen() + starts the 4 workers
│   ├── routes/
│   ├── controllers/
│   ├── services/                # authService, projectService, + one per AI provider
│   ├── workers/                 # Bull processors — one per generation type
│   ├── queues/                  # Bull queue definitions
│   ├── middleware/              # auth, rate limiting, daily cap, ownership, validation
│   ├── validation/              # Joi schemas
│   ├── seeds/                   # `npm run seed`
│   └── **/__tests__/            # Unit tests, co-located; integration tests in src/__tests__/
├── prisma/
└── jest.config.js
```

## Development Workflow

### Adding a new API endpoint
1. Add a controller method in `backend/src/controllers/`
2. Add the route in `backend/src/routes/`, wiring up `authMiddleware`, `validate()`, and any other relevant middleware — routes are only reachable once mounted in `app.ts`, so double check the corresponding `app.use('/api/...', ...)` line is there if you're adding a whole new route file
3. Add a Joi schema in `backend/src/validation/` if the route accepts a body
4. Add the request/response types in `backend/src/types/`
5. Add a frontend API client method in `frontend/lib/api.ts`
6. Add a unit test for anything with real logic, and consider adding a case to `src/__tests__/app.integration.test.ts` if it's a new route (confirms it's actually mounted and the middleware order is correct)

### Adding a new generation provider
Follow the existing four as a template — each is a `queues/<name>Queue.ts` + `workers/<name>Worker.ts` + `services/<name>Service.ts` + a controller method + a route, all following the same create-row-then-enqueue shape described in `docs/ARCHITECTURE.md`.

### Database schema changes
```bash
cd backend
# edit prisma/schema.prisma
npx prisma migrate dev --name describe_the_change
```

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for the full lists. Notable backend ones beyond the obvious DB/Redis/JWT/API keys:
- `HOURLY_GENERATION_RATE_LIMIT` — per-user requests/hour on generation routes (default 30)
- `DAILY_GENERATION_LIMIT` — per-user generations/24h across all types (default 50)

## Testing

```bash
cd backend
npm test                # unit + integration (Jest + Supertest; Prisma/Bull/bcrypt/jwt mocked, no live services needed)
npm run test:watch
npm run test:coverage
```

Frontend:
```bash
cd frontend
npm test                # Jest + React Testing Library, jsdom environment
npm run test:watch
npm run test:coverage
npm run type-check
npm run lint
```

## Code Style

- TypeScript everywhere
- ESLint configs exist for both `frontend/.eslintrc.json` (`next/core-web-vitals`) and `backend/.eslintrc.json` (`@typescript-eslint/recommended`)
- No Prettier config is currently committed — formatting isn't enforced

## CI

`.github/workflows/ci.yml` runs on every push/PR to `main`: type-check, lint, test, and build for both `frontend/` and `backend/`. It uses `npm install` (see the lockfile note above) rather than `npm ci`.

## Common Tasks

```bash
cd backend
npx prisma migrate dev      # apply/create a migration
npm run seed                 # seed a demo user + project
npm run type-check
npm run lint
npm test
```
