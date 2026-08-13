import { Response } from 'express';
import { RegisterRequest, LoginRequest, AuthenticatedRequest } from '../types/auth';
import authService from '../services/authService';

class AuthController {
  async register(req: AuthenticatedRequest, res: Response) {
    try {
      const { email, name, password } = req.body as RegisterRequest;

      // Validation
      if (!email || !name || !password) {
        return res.status(400).json({
          error: 'Email, name, and password are required',
          code: 'INVALID_REQUEST',
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long',
          code: 'INVALID_REQUEST',
        });
      }

      const result = await authService.register({ email, name, password });
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({
        error: error.message || 'Registration failed',
        code: 'INVALID_REQUEST',
      });
    }
  }

  async login(req: AuthenticatedRequest, res: Response) {
    try {
      const { email, password } = req.body as LoginRequest;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required',
          code: 'INVALID_REQUEST',
        });
      }

      const result = await authService.login({ email, password });
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(401).json({
        error: error.message || 'Login failed',
        code: 'UNAUTHORIZED',
      });
    }
  }

  async me(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      return res.status(200).json({
        user: req.user,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async forgotPassword(req: AuthenticatedRequest, res: Response) {
    try {
      const { email } = req.body as { email: string };
      await authService.requestPasswordReset(email);

      // Same response whether or not the email is registered — see the
      // comment in authService.requestPasswordReset for why.
      return res.status(200).json({
        message: 'If that email is registered, a password reset link has been sent.',
      });
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to process request',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async resetPassword(req: AuthenticatedRequest, res: Response) {
    try {
      const { token, password } = req.body as { token: string; password: string };
      await authService.resetPassword(token, password);

      return res.status(200).json({ message: 'Password reset successful' });
    } catch (error: any) {
      if (error.message?.includes('Invalid or expired')) {
        return res.status(400).json({
          error: error.message,
          code: 'INVALID_TOKEN',
        });
      }

      return res.status(500).json({
        error: error.message || 'Failed to reset password',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}

export default new AuthController();
