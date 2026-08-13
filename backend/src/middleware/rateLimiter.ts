import rateLimit from 'express-rate-limit';
import { AuthenticatedRequest } from '../types/auth';

// Auth endpoints run before authMiddleware, so there's no userId yet —
// limit by IP. Tight enough to slow down credential stuffing / spam
// registration without being annoying for a real user who mistypes a
// password a couple of times.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' },
});

// Generation endpoints hit paid third-party APIs (Stability AI, Runway,
// Meshy, Eleven Labs), so these are rate-limited per authenticated user
// rather than per IP — otherwise users behind a shared IP (office, VPN)
// would throttle each other, and a single user spread across IPs
// wouldn't be limited at all.
export const generationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: Number(process.env.HOURLY_GENERATION_RATE_LIMIT) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthenticatedRequest).userId || req.ip || 'unknown',
  message: {
    error: 'Generation rate limit reached. Please slow down and try again shortly.',
    code: 'RATE_LIMITED',
  },
});
