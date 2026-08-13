import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth';

const prisma = new PrismaClient();

const DAILY_LIMIT = Number(process.env.DAILY_GENERATION_LIMIT) || 50;

// Rate limiting (see rateLimiter.ts) bounds how fast requests can come in;
// this bounds total cost per user per day. A user could easily stay under
// the hourly rate limit while still running up a large bill by generating
// steadily all day, especially with video/3D generations which cost more
// per call than a single image.
export async function dailyGenerationCap(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const countToday = await prisma.generation.count({
    where: {
      userId: req.userId,
      createdAt: { gte: since },
    },
  });

  if (countToday >= DAILY_LIMIT) {
    return res.status(429).json({
      error: `Daily generation limit reached (${DAILY_LIMIT} per 24 hours). Please try again later.`,
      code: 'DAILY_LIMIT_REACHED',
    });
  }

  next();
}
