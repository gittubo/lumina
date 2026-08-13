jest.mock('../../services/authService', () => ({
  __esModule: true,
  default: {
    verifyToken: jest.fn(),
  },
}));

import { Response } from 'express';
import { authMiddleware } from '../authMiddleware';
import authService from '../../services/authService';
import { AuthenticatedRequest } from '../../types/auth';

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('authMiddleware', () => {
  it('rejects a request with no authorization header', async () => {
    const req = { headers: {} } as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a header that is not a Bearer token', async () => {
    const req = { headers: { authorization: 'Basic abc123' } } as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token', async () => {
    (authService.verifyToken as jest.Mock).mockRejectedValue(new Error('Invalid or expired token'));
    const req = { headers: { authorization: 'Bearer bad-token' } } as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches userId and user, then calls next() for a valid token', async () => {
    (authService.verifyToken as jest.Mock).mockResolvedValue({
      userId: 'user_1',
      email: 'ada@example.com',
    });
    const req = { headers: { authorization: 'Bearer good-token' } } as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(req.userId).toBe('user_1');
    expect(req.user).toEqual({ id: 'user_1', email: 'ada@example.com' });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
