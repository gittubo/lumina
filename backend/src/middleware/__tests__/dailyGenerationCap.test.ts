jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    generation: {
      count: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

import { PrismaClient } from '@prisma/client';
import { Response } from 'express';
import { dailyGenerationCap } from '../dailyGenerationCap';
import { AuthenticatedRequest } from '../../types/auth';

const prisma = new PrismaClient() as unknown as { generation: { count: jest.Mock } };

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('dailyGenerationCap', () => {
  const originalEnv = process.env.DAILY_GENERATION_LIMIT;

  afterEach(() => {
    process.env.DAILY_GENERATION_LIMIT = originalEnv;
  });

  it('rejects an unauthenticated request', async () => {
    const req = {} as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await dailyGenerationCap(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the user is under the daily limit', async () => {
    process.env.DAILY_GENERATION_LIMIT = '50';
    prisma.generation.count.mockResolvedValue(10);

    const req = { userId: 'user_1' } as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await dailyGenerationCap(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks with 429 once the user has reached the daily limit', async () => {
    process.env.DAILY_GENERATION_LIMIT = '50';
    prisma.generation.count.mockResolvedValue(50);

    const req = { userId: 'user_1' } as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await dailyGenerationCap(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('scopes the count query to the requesting user and the last 24 hours', async () => {
    process.env.DAILY_GENERATION_LIMIT = '50';
    prisma.generation.count.mockResolvedValue(0);

    const req = { userId: 'user_1' } as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await dailyGenerationCap(req, res, next);

    expect(prisma.generation.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user_1',
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    );
  });
});
