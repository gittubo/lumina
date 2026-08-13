jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

jest.mock('bcryptjs', () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('../emailService', () => ({
  __esModule: true,
  default: {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authService from '../authService';
import emailService from '../emailService';

const prisma = new PrismaClient() as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; findFirst: jest.Mock };
};

describe('authService.register', () => {
  it('creates a user and returns a token when the email is unused', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    prisma.user.create.mockResolvedValue({
      id: 'user_1',
      email: 'ada@example.com',
      name: 'Ada',
      avatar: null,
    });
    (jwt.sign as jest.Mock).mockReturnValue('signed-token');

    const result = await authService.register({
      email: 'ada@example.com',
      name: 'Ada',
      password: 'supersecret123',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('supersecret123', 'salt');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'ada@example.com', password: 'hashed-password' }),
      })
    );
    expect(result).toEqual({
      token: 'signed-token',
      user: { id: 'user_1', email: 'ada@example.com', name: 'Ada', avatar: null },
    });
  });

  it('throws when the email is already registered', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing_user' });

    await expect(
      authService.register({ email: 'ada@example.com', name: 'Ada', password: 'supersecret123' })
    ).rejects.toThrow('User with this email already exists');

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('authService.login', () => {
  it('returns a token for correct credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'ada@example.com',
      name: 'Ada',
      avatar: null,
      password: 'hashed-password',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue('signed-token');

    const result = await authService.login({ email: 'ada@example.com', password: 'supersecret123' });

    expect(result.token).toBe('signed-token');
    expect(result.user.email).toBe('ada@example.com');
  });

  it('throws for a nonexistent user without revealing that distinction', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'nobody@example.com', password: 'whatever' })
    ).rejects.toThrow('Invalid email or password');
  });

  it('throws for an incorrect password with the same message as a nonexistent user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'ada@example.com',
      password: 'hashed-password',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      authService.login({ email: 'ada@example.com', password: 'wrong-password' })
    ).rejects.toThrow('Invalid email or password');
  });
});

describe('authService.requestPasswordReset', () => {
  it('stores a hashed token with an expiry and sends the reset email for a registered user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user_1', email: 'ada@example.com' });
    prisma.user.update.mockResolvedValue({});

    await authService.requestPasswordReset('ada@example.com');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user_1' },
        data: expect.objectContaining({
          resetTokenHash: expect.any(String),
          resetTokenExpiry: expect.any(Date),
        }),
      })
    );
    // The raw token must never be stored — only a sha256 hex digest of it
    // (64 hex characters).
    const storedData = prisma.user.update.mock.calls[0][0].data;
    expect(storedData.resetTokenHash).toMatch(/^[0-9a-f]{64}$/);

    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      'ada@example.com',
      expect.stringContaining('/reset-password?token=')
    );
  });

  it('does nothing (no error, no email) for an unregistered email — prevents account enumeration', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(authService.requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('authService.resetPassword', () => {
  it('updates the password and clears the reset token for a valid, unexpired token', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user_1' });
    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
    prisma.user.update.mockResolvedValue({});

    await authService.resetPassword('raw-token-value', 'newSuperSecret123');

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resetTokenHash: expect.any(String),
          resetTokenExpiry: expect.objectContaining({ gt: expect.any(Date) }),
        }),
      })
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        password: 'new-hashed-password',
        resetTokenHash: null,
        resetTokenExpiry: null,
      },
    });
  });

  it('throws for an invalid or expired token, without updating anything', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(authService.resetPassword('bad-or-expired-token', 'newSuperSecret123')).rejects.toThrow(
      'Invalid or expired reset token'
    );

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
