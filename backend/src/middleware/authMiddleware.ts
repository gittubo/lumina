import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';
import { AuthenticatedRequest } from '../types/auth';

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid authorization header',
        code: 'UNAUTHORIZED',
      });
    }

    const token = authHeader.substring(7);
    const payload = await authService.verifyToken(token);

    req.userId = payload.userId;
    req.user = {
      id: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error: any) {
    return res.status(401).json({
      error: error.message || 'Authentication failed',
      code: 'UNAUTHORIZED',
    });
  }
};
