# LUMINA - Next-Generation AI Creative Platform

**LUMINA** is a revolutionary multimodal AI creative engine designed to democratize professional content creation. It combines cutting-edge AI technologies to generate ultra-realistic images, cinematic videos, 3D environments, and synthetic media with unprecedented quality.

## 🚀 Features

- **Text-to-Image Generation** - Powered by Stability AI Diffusion models
- **Video Generation & Enhancement** - Runway AI integration for cinematic video creation
- **3D Environment & Model Generation** - Meshy AI for photorealistic 3D scenes
- **Voice & Audio Synthesis** - Eleven Labs for human-level voice generation
- **Project Management** - Full project workspace with version history
- **Real-time Collaboration** - Work with team members seamlessly
- **Multi-format Export** - Output as images, videos, 3D models, and more
- **Advanced Customization** - Fine-tune every aspect of your generated content

## 📋 Tech Stack

### Frontend
- **Framework:** Next.js 14 with React 18
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **3D Rendering:** Three.js
- **State Management:** Zustand
- **UI Components:** Radix UI + Custom components

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js
- **Task Queue:** Bull (Redis-based job queue)
- **API Documentation:** Swagger/OpenAPI

### Infrastructure
- **Containerization:** Docker & Docker Compose
- **CI/CD:** GitHub Actions
- **Deployment:** Docker-ready configuration

## 🔗 AI Service Integrations

- **Stability AI** - Image generation (SDXL, SD3)
- **Runway AI** - Video generation and editing
- **Meshy AI** - 3D model and environment generation
- **Eleven Labs** - Voice synthesis and cloning

## 📁 Project Structure

```
lumina/
├── frontend/              # Next.js web application
│   ├── app/              # App router pages
│   ├── components/       # React components
│   ├── lib/              # Utilities and helpers
│   ├── hooks/            # Custom React hooks
│   ├── store/            # Zustand state management
│   ├── types/            # TypeScript type definitions
│   └── public/           # Static assets
│
├── backend/              # Express.js API server
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── controllers/  # Business logic
│   │   ├── services/     # External service integrations
│   │   ├── models/       # Database models
│   │   ├── middleware/   # Express middleware
│   │   ├── utils/        # Utility functions
│   │   └── types/        # TypeScript definitions
│   ├── prisma/           # Prisma schema and migrations
│   └── tests/            # Test files
│
├── packages/             # Shared packages
│   ├── shared-types/     # Shared TypeScript types
│   └── shared-utils/     # Shared utilities
│
├── docker-compose.yml    # Docker services configuration
├── .github/workflows/    # CI/CD pipelines
└── docs/                 # Documentation
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+ (or use Docker)
- API keys for:
  - Stability AI
  - Runway AI
  - Meshy AI
  - Eleven Labs

### Installation

1. Clone the repository:
```bash
git clone https://github.com/gittubo/lumina.git
cd lumina
```

2. Install dependencies:
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

3. Set up environment variables:
```bash
# Copy example env files
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env.local
```

4. Start with Docker Compose:
```bash
docker-compose up
```

Or run locally:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

5. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Docs: http://localhost:5000/api/docs

## 📚 Documentation

See [docs/](./docs) for:
- [API Documentation](./docs/API.md)
- [Architecture Guide](./docs/ARCHITECTURE.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## 🔐 Environment Variables

Required API keys:
```
STABILITY_AI_API_KEY=your_key
RUNWAY_API_KEY=your_key
MESHY_API_KEY=your_key
ELEVEN_LABS_API_KEY=your_key
```

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## 📞 Support

For issues and feature requests, please use GitHub Issues.

---

**LUMINA** - Where creativity meets artificial intelligence.