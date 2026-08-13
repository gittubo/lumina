// Third-party infra (Redis-backed queues, the database, external crypto
// libs) is mocked so this suite runs anywhere with no Redis or Postgres
// required — what it's actually verifying is that routes are mounted,
// middleware runs in the right order, and requests reach the right
// handlers. That's exactly the class of bug (an unmounted router, a
// missing auth check) that unit tests of individual functions can't catch,
// because each of those functions works fine in isolation.

jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    process: jest.fn(),
    add: jest.fn().mockResolvedValue({}),
    on: jest.fn(),
  }));
});

jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    generation: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

// emailService imports nodemailer transitively — mock it so no real SMTP
// connection is attempted (and so createTransport doesn't need real config).
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('bcryptjs', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('signed-token'),
  verify: jest.fn(),
}));

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from '../app';

const prisma = new PrismaClient() as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; findFirst: jest.Mock };
  project: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock };
  generation: { count: jest.Mock; create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
};

describe('GET /api/health', () => {
  it('responds 200 without requiring auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/docs', () => {
  it('serves the Swagger UI page', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
  });
});

describe('GET /api/docs.json', () => {
  it('serves a valid OpenAPI spec covering the main route groups', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info.title).toBe('LUMINA API');

    const paths = Object.keys(res.body.paths);
    expect(paths).toEqual(
      expect.arrayContaining(['/auth/register', '/auth/login', '/projects', '/generations/image'])
    );
  });
});

describe('unknown routes', () => {
  it('falls through to the 404 handler', async () => {
    const res = await request(app).get('/api/this-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

describe('POST /api/auth/register', () => {
  it('rejects an invalid body before ever touching the database', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates a user and returns a token for a valid request', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user_1',
      email: 'ada@example.com',
      name: 'Ada',
      avatar: null,
    });

    const res = await request(app).post('/api/auth/register').send({
      email: 'ada@example.com',
      name: 'Ada',
      password: 'supersecret123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBe('signed-token');
    expect(res.body.user.email).toBe('ada@example.com');
  });
});

describe('routes that require authentication', () => {
  it('rejects GET /api/projects with no Authorization header', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('rejects POST /api/generations/image with no Authorization header', async () => {
    // Confirms authMiddleware runs before validation/ownership/rate-limit
    // checks on this route — the same class of ordering bug that would let
    // an unauthenticated request reach a paid third-party API call.
    const res = await request(app)
      .post('/api/generations/image')
      .send({ prompt: 'a fox', projectId: 'proj_1' });

    expect(res.status).toBe(401);
    expect(prisma.generation.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed body on an authenticated generation request before hitting the daily cap check', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user_1', email: 'ada@example.com' });

    const res = await request(app)
      .post('/api/generations/image')
      .set('Authorization', 'Bearer valid-token')
      .send({ projectId: 'proj_1' }); // missing prompt

    expect(res.status).toBe(400);
    expect(prisma.generation.count).not.toHaveBeenCalled();
    expect(prisma.generation.create).not.toHaveBeenCalled();
  });

  it('rejects a generation request for a project the user does not own', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user_1', email: 'ada@example.com' });
    prisma.project.findFirst.mockResolvedValue(null); // not found / not owned

    const res = await request(app)
      .post('/api/generations/image')
      .set('Authorization', 'Bearer valid-token')
      .send({ prompt: 'a fox', projectId: 'someone-elses-project' });

    expect(res.status).toBe(404);
    expect(prisma.generation.create).not.toHaveBeenCalled();
  });

  it('accepts a well-formed, owned, valid generation request', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user_1', email: 'ada@example.com' });
    prisma.project.findFirst.mockResolvedValue({ id: 'proj_1', userId: 'user_1', title: 'My Project' });
    prisma.generation.count.mockResolvedValue(0);
    prisma.generation.create.mockResolvedValue({
      id: 'gen_1',
      type: 'image',
      prompt: 'a fox',
      status: 'pending',
      projectId: 'proj_1',
      userId: 'user_1',
    });

    const res = await request(app)
      .post('/api/generations/image')
      .set('Authorization', 'Bearer valid-token')
      .send({ prompt: 'a fox', projectId: 'proj_1' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(prisma.generation.create).toHaveBeenCalled();
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns the same generic response for a registered email as an unregistered one', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a malformed email before touching the database', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/reset-password', () => {
  it('rejects an invalid or expired token', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'bad-token', password: 'newSuperSecret123' });

    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a password under 8 characters before touching the database', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'some-token', password: 'short' });

    expect(res.status).toBe(400);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('resets the password for a valid token', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user_1' });
    prisma.user.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'good-token', password: 'newSuperSecret123' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user_1' },
        data: expect.objectContaining({ resetTokenHash: null, resetTokenExpiry: null }),
      })
    );
  });
});
