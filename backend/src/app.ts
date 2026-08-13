import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Must run before any route/service module is imported below, since several
// of them read process.env (JWT_SECRET, API keys, etc.) at module load time.
dotenv.config();

import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import generationRoutes from './routes/generationRoutes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';

const app = express();

// The Swagger UI page relies on inline <script>/<style> tags to boot itself,
// which helmet's default Content-Security-Policy blocks in a real browser
// (the request would still return 200, but the page would render blank with
// CSP violations in the console). Mounting these routes before the global
// helmet() call means they're never subject to it — the trade-off is that
// the docs page itself doesn't get helmet's other protections, which is a
// reasonable one for a docs UI with no user data or state-changing actions.
app.get('/api/docs.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'LUMINA API Docs',
  })
);

// Middleware (applies to everything below, including auth/projects/generations)
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'LUMINA Backend API',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/generations', generationRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

export default app;
