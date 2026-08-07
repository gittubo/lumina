# LUMINA Development Guide

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (recommended)
- Git

### Local Setup

#### Option 1: Using Docker (Recommended)

```bash
# Clone repository
git clone https://github.com/gittubo/lumina.git
cd lumina

# Start all services
docker-compose up

# Run migrations
docker-compose exec backend npm run migrate
```

#### Option 2: Manual Setup

```bash
# Install dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# Setup environment files
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env.local

# Start PostgreSQL and Redis (manually or using services)

# Run migrations
cd backend
npm run migrate
cd ..

# Start backend
cd backend && npm run dev

# In another terminal, start frontend
cd frontend && npm run dev
```

## Project Structure

### Frontend (`/frontend`)
```
frontend/
├── app/              # Next.js pages and layouts
├── components/       # Reusable React components
├── lib/              # Utility functions
├── hooks/            # Custom React hooks
├── store/            # Zustand state management
├── types/            # TypeScript type definitions
└── public/           # Static assets
```

### Backend (`/backend`)
```
backend/
├── src/
│   ├── routes/       # Express route definitions
│   ├── controllers/  # Request handlers
│   ├── services/     # Business logic
│   ├── models/       # Prisma models
│   ├── middleware/   # Express middleware
│   ├── utils/        # Utility functions
│   ├── types/        # TypeScript types
│   └── index.ts      # Entry point
├── prisma/           # Database schema and migrations
└── tests/            # Test files
```

## Development Workflow

### Creating a New Feature

1. Create a branch from `develop`
   ```bash
   git checkout -b feature/feature-name
   ```

2. Make changes to frontend and/or backend

3. Test locally
   ```bash
   npm run test
   ```

4. Commit with clear messages
   ```bash
   git commit -m "feat: add feature description"
   ```

5. Push and create Pull Request
   ```bash
   git push origin feature/feature-name
   ```

### Adding a New Database Schema

1. Update `backend/prisma/schema.prisma`
2. Create a migration
   ```bash
   cd backend
   npm run migrate
   ```
3. Push generated types to frontend if needed

### Adding a New API Endpoint

1. Create controller in `backend/src/controllers/`
2. Create route in `backend/src/routes/`
3. Register route in `backend/src/index.ts`
4. Add TypeScript types in `backend/src/types/`
5. Create frontend API client method
6. Integrate in frontend component

## Environment Variables

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_APP_NAME` - Application name

### Backend (.env)
- Database connection string
- Redis connection string
- JWT secret
- AI service API keys
- AWS credentials (if using S3)

## Testing

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Code Style

- Use TypeScript for all code
- Follow ESLint configuration
- Use Prettier for formatting
- Write clear, self-documenting code
- Add comments for complex logic

## Common Tasks

### Reset Database
```bash
cd backend
npm run migrate -- --create-only
```

### Seed Database
```bash
cd backend
npm run seed
```

### Check TypeScript
```bash
npm run type-check
```

### Lint Code
```bash
npm run lint
```