# LUMINA Architecture

## Overview

LUMINA is built with a modern microservices-ready architecture using:

- **Frontend**: Next.js 14 with React 18
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with Bull
- **AI Services**: External API integrations

## System Architecture

```
┌─────────────────────────────┐
│   Frontend                  │
│   (Next.js)                 │
└──────────────┬──────────────┘
               │
               │ HTTP/REST
               │
┌──────────────▼─────────────────────────────────────┐
│     Backend (Express.js)                           │
│  ┌──────────────────────────────────────────────┐  │
│  │  Auth & Middleware                           │  │
│  │  Routes & Controllers                        │  │
│  │  Service Layer                               │  │
│  └──────────────┬─────────────────────────────┘  │
└─────────────────┼────────────────────────────────┘
                  │
    ┌─────────────┼──────────────┬─────────────┐
    │             │              │             │
┌───▼──┐  ┌──▼──┐  ┌────────▼──┐  ┌──────▼──┐
│  DB  │  │Cache│  │Queue      │  │External │
│(PG)  │  │Redis│  │(Bull)     │  │APIs     │
└──────┘  └─────┘  └───────────┘  └─────────┘
```

## Data Flow

### Image Generation Flow
1. User submits text prompt via Frontend
2. Frontend sends POST request to `/api/generations/image`
3. Backend validates request and creates Generation record
4. Job is queued in Redis/Bull for async processing
5. Worker processes job using Stability AI API
6. Result is stored, and status is updated
7. Frontend polls or uses WebSocket for real-time updates

## Key Services

### 1. Authentication Service
- JWT-based authentication
- User registration and login
- Session management

### 2. Generation Service
- Handles all content generation requests
- Routes to appropriate AI service
- Manages async job processing

### 3. AI Service Integration Layer
- Stability AI (Image Generation)
- Runway (Video Generation)
- Meshy (3D Generation)
- Eleven Labs (Voice Synthesis)

### 4. Storage Service
- AWS S3 integration for file storage
- CDN caching strategy

## Database Schema

### Core Tables
- `users` - User accounts and authentication
- `projects` - User projects
- `generations` - Generated content records

## API Architecture

All endpoints follow RESTful conventions:
- `GET /api/resource` - List/Retrieve
- `POST /api/resource` - Create
- `PUT /api/resource/:id` - Update
- `DELETE /api/resource/:id` - Delete

## Deployment Architecture

```
Docker Container Environment
├── Frontend Container (Next.js)
├── Backend Container (Express)
├── Database Container (PostgreSQL)
└── Cache Container (Redis)
```

All containers communicate via internal Docker network and are orchestrated via docker-compose.