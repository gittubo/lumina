/**
 * @jest-environment node
 */
import { sendChatMessage, ChatStreamError } from '../api';

// A fetch Response stand-in whose body yields the given chunks — chunk
// boundaries deliberately fall mid-event to exercise the buffering.
function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length ? { done: false, value: encoder.encode(chunks[i++]) } : { done: true, value: undefined },
      }),
    },
  };
}

const done = {
  userMessage: { id: 'u1', role: 'user', text: 'hi', createdAt: '2026-01-01T00:00:00Z' },
  assistantMessage: { id: 'a1', role: 'assistant', text: 'Hello there', createdAt: '2026-01-01T00:00:01Z' },
  title: 'hi',
};

afterEach(() => {
  (global as { fetch?: unknown }).fetch = undefined;
});

describe('sendChatMessage', () => {
  it('emits deltas in order and resolves with the done payload', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      sseResponse([
        'event: delta\ndata: {"text":"Hel',
        'lo"}\n\nevent: delta\ndata: {"text":" there"}\n\n',
        `event: done\ndata: ${JSON.stringify(done)}\n\n`,
      ])
    ) as unknown as typeof fetch;

    const deltas: string[] = [];
    const result = await sendChatMessage('conv_1', 'hi', (t) => deltas.push(t));

    expect(deltas).toEqual(['Hello', ' there']);
    expect(result).toEqual(done);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat/conversations/conv_1/messages'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ message: 'hi' }) })
    );
  });

  it('rejects with the server message on an error event', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      sseResponse(['event: delta\ndata: {"text":"Hi"}\n\n', 'event: error\ndata: {"error":"Upstream failed"}\n\n'])
    ) as unknown as typeof fetch;

    await expect(sendChatMessage('conv_1', 'hi', () => {})).rejects.toThrow('Upstream failed');
  });

  it('rejects with the JSON error for a non-2xx response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      body: null,
      json: async () => ({ error: 'Assistant not configured' }),
    }) as unknown as typeof fetch;

    await expect(sendChatMessage('conv_1', 'hi', () => {})).rejects.toThrow(
      new ChatStreamError('Assistant not configured')
    );
  });

  it('rejects if the stream ends without a done event', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      sseResponse(['event: delta\ndata: {"text":"Hi"}\n\n'])
    ) as unknown as typeof fetch;

    await expect(sendChatMessage('conv_1', 'hi', () => {})).rejects.toThrow(/closed before the reply finished/);
  });
});
