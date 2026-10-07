// Exercises the Lumina Assistant routes end to end through the Express app,
// with the database, JWT verification, and the Claude API mocked — what's
// under test is auth/ownership checks, validation, the SSE wire format, and
// what gets sent to and saved from the model.

jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    process: jest.fn(),
    add: jest.fn().mockResolvedValue({}),
    on: jest.fn(),
  }));
});

jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
    project: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    generation: { count: jest.fn(), create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    conversation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    chatMessage: { create: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { PrismaClient: jest.fn(() => mPrismaClient), Prisma: {} };
});

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue(undefined) })),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('signed-token'),
  verify: jest.fn(),
}));

const mockStream = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk');
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    beta: { messages: { stream: mockStream } },
  }));
  Object.assign(MockAnthropic, {
    APIError: actual.APIError,
    APIUserAbortError: actual.APIUserAbortError,
    RateLimitError: actual.RateLimitError,
    AuthenticationError: actual.AuthenticationError,
  });
  return { __esModule: true, default: MockAnthropic };
});

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from '../app';

const prisma = new PrismaClient() as unknown as {
  project: { findFirst: jest.Mock; findUnique: jest.Mock };
  conversation: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  chatMessage: { create: jest.Mock };
};

// Mimics the SDK's MessageStream: emits each text delta to `on('text')`
// listeners, then resolves finalMessage() with the full response.
function fakeStream(deltas: string[], final: Record<string, unknown>) {
  const listeners: Array<(text: string) => void> = [];
  return {
    on: (event: string, cb: (text: string) => void) => {
      if (event === 'text') listeners.push(cb);
    },
    finalMessage: async () => {
      deltas.forEach((d) => listeners.forEach((cb) => cb(d)));
      return final;
    },
  };
}

function parseSse(body: string) {
  return body
    .trim()
    .split('\n\n')
    .map((chunk) => {
      const [eventLine, dataLine] = chunk.split('\n');
      return { event: eventLine.replace('event: ', ''), data: JSON.parse(dataLine.replace('data: ', '')) };
    });
}

const conversation = {
  id: 'conv_1',
  title: 'New chat',
  userId: 'user_1',
  projectId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user_1', email: 'ada@example.com' });
});

describe('chat routes require authentication', () => {
  it('rejects GET /api/chat/conversations with no Authorization header', async () => {
    (jwt.verify as jest.Mock).mockReset();
    const res = await request(app).get('/api/chat/conversations');
    expect(res.status).toBe(401);
  });

  it('rejects sending a message with no Authorization header, without calling Claude', async () => {
    const res = await request(app).post('/api/chat/conversations/conv_1/messages').send({ message: 'hi' });
    expect(res.status).toBe(401);
    expect(mockStream).not.toHaveBeenCalled();
  });
});

describe('POST /api/chat/conversations', () => {
  it('creates an unscoped conversation', async () => {
    prisma.conversation.create.mockResolvedValue(conversation);

    const res = await request(app)
      .post('/api/chat/conversations')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(201);
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: { userId: 'user_1', projectId: null, title: 'New chat' },
    });
  });

  it('refuses to attach a project the user does not own', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/chat/conversations')
      .set('Authorization', 'Bearer valid-token')
      .send({ projectId: 'someone-elses-project' });

    expect(res.status).toBe(404);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/chat/conversations/:id', () => {
  it('returns 404 for a conversation the user does not own', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/chat/conversations/conv_other')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'conv_other', userId: 'user_1' } })
    );
  });
});

describe('DELETE /api/chat/conversations/:id', () => {
  it('scopes the delete to the requesting user', async () => {
    prisma.conversation.deleteMany.mockResolvedValue({ count: 0 });

    const res = await request(app)
      .delete('/api/chat/conversations/conv_other')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
    expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({
      where: { id: 'conv_other', userId: 'user_1' },
    });
  });
});

describe('POST /api/chat/conversations/:id/messages', () => {
  it('rejects an empty message before calling Claude', async () => {
    const res = await request(app)
      .post('/api/chat/conversations/conv_1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ message: '   ' });

    expect(res.status).toBe(400);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('returns a JSON 404 for an unknown conversation', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/chat/conversations/conv_missing/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ message: 'hi' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('returns 503 when no Anthropic API key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    prisma.conversation.findFirst.mockResolvedValue({ ...conversation, messages: [] });

    const res = await request(app)
      .post('/api/chat/conversations/conv_1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ message: 'hi' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('CHAT_NOT_CONFIGURED');
  });

  it('streams the reply, replays history, and saves both turns', async () => {
    const priorAssistantContent = [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: 'Try a misty forest.' },
    ];
    prisma.conversation.findFirst.mockResolvedValue({
      ...conversation,
      title: 'Ideas for a fox image',
      messages: [
        { id: 'm1', role: 'user', text: 'Ideas for a fox image', content: null, createdAt: new Date() },
        { id: 'm2', role: 'assistant', text: 'Try a misty forest.', content: priorAssistantContent, createdAt: new Date() },
      ],
    });
    const replyContent = [{ type: 'text', text: 'Here is a prompt.' }];
    mockStream.mockReturnValue(
      fakeStream(['Here is ', 'a prompt.'], { content: replyContent, stop_reason: 'end_turn' })
    );
    prisma.chatMessage.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: `msg_${data.role}`, createdAt: new Date(), ...data })
    );
    prisma.conversation.update.mockResolvedValue(conversation);

    const res = await request(app)
      .post('/api/chat/conversations/conv_1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ message: 'Make it a prompt' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);

    const events = parseSse(res.text);
    expect(events.filter((e) => e.event === 'delta').map((e) => e.data.text).join('')).toBe('Here is a prompt.');
    const done = events.find((e) => e.event === 'done');
    expect(done?.data.assistantMessage.text).toBe('Here is a prompt.');
    expect(done?.data.title).toBe('Ideas for a fox image'); // only the first message sets the title

    const params = mockStream.mock.calls[0][0];
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.messages).toEqual([
      { role: 'user', content: 'Ideas for a fox image' },
      { role: 'assistant', content: priorAssistantContent }, // replayed verbatim
      { role: 'user', content: 'Make it a prompt' },
    ]);

    expect(prisma.chatMessage.create).toHaveBeenCalledWith({
      data: { conversationId: 'conv_1', role: 'assistant', text: 'Here is a prompt.', content: replyContent },
    });
  });

  it('titles a new conversation from its first message and includes project context', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ ...conversation, projectId: 'proj_1', messages: [] });
    prisma.project.findUnique.mockResolvedValue({
      id: 'proj_1',
      title: 'Forest Short Film',
      description: 'A moody short about a fox',
      generations: [{ type: 'image', prompt: 'a fox at dawn', status: 'completed' }],
    });
    mockStream.mockReturnValue(
      fakeStream(['Sure.'], { content: [{ type: 'text', text: 'Sure.' }], stop_reason: 'end_turn' })
    );
    prisma.chatMessage.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: `msg_${data.role}`, createdAt: new Date(), ...data })
    );
    prisma.conversation.update.mockResolvedValue(conversation);

    const res = await request(app)
      .post('/api/chat/conversations/conv_1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ message: 'Help me plan   the opening shot' });

    expect(parseSse(res.text).find((e) => e.event === 'done')?.data.title).toBe('Help me plan the opening shot');

    const system = mockStream.mock.calls[0][0].system;
    expect(system).toHaveLength(2);
    // The frontend's "Use this prompt" button relies on this fence-label format.
    expect(system[0].text).toContain('```image style=cinematic aspectRatio=16:9');
    expect(system[1].text).toContain('Forest Short Film');
    expect(system[1].text).toContain('a fox at dawn');
  });

  it('sends an error event and saves nothing when Claude declines', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ ...conversation, messages: [] });
    mockStream.mockReturnValue(fakeStream([], { content: [], stop_reason: 'refusal' }));

    const res = await request(app)
      .post('/api/chat/conversations/conv_1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ message: 'something off-limits' });

    // No tokens were streamed, so this arrives as a plain JSON error.
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('REFUSED');
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });
});
