import { parseFenceInfo, buildPromptHandoffUrl, readPromptHandoff } from '../promptHandoff';

describe('parseFenceInfo', () => {
  it('reads the generator and settings, including quoted values', () => {
    expect(parseFenceInfo('image style=cinematic aspectRatio=16:9 negativePrompt="text, watermark"')).toEqual({
      type: 'image',
      options: { style: 'cinematic', aspectRatio: '16:9', negativePrompt: 'text, watermark' },
    });
  });

  it('accepts aliases for 3d and audio', () => {
    expect(parseFenceInfo('model topology=quad').type).toBe('3d');
    expect(parseFenceInfo('speech voice=Bella').type).toBe('audio');
  });

  it('returns no type for an unlabelled or unrelated fence', () => {
    expect(parseFenceInfo('')).toEqual({ type: null, options: {} });
    expect(parseFenceInfo('json').type).toBeNull();
  });
});

describe('buildPromptHandoffUrl / readPromptHandoff', () => {
  function roundTrip(type: Parameters<typeof buildPromptHandoffUrl>[1], prompt: string, options: Record<string, string>) {
    const url = buildPromptHandoffUrl('proj_1', type, prompt, options);
    return { url, handoff: readPromptHandoff(new URL(url, 'http://x').searchParams) };
  }

  it('round-trips an image prompt and its settings', () => {
    const { url, handoff } = roundTrip('image', 'a fox & a hare at dawn', {
      style: 'Cinematic',
      aspectRatio: '16:9',
      negativePrompt: 'text',
    });
    expect(url.startsWith('/dashboard/projects/proj_1?')).toBe(true);
    expect(handoff).toEqual({
      type: 'image',
      prompt: 'a fox & a hare at dawn',
      style: 'cinematic',
      aspectRatio: '16:9',
      negativePrompt: 'text',
    });
  });

  it('drops settings the form does not offer', () => {
    const { handoff } = roundTrip('video', 'waves', { ratio: '4000:3', duration: '7' });
    expect(handoff).toEqual({ type: 'video', prompt: 'waves', videoRatio: undefined, videoDuration: undefined });
  });

  it('maps 3D and voice settings', () => {
    expect(roundTrip('3d', 'a chest', { topology: 'quad', pbr: 'true' }).handoff).toMatchObject({
      topology: 'quad',
      enablePbr: true,
    });
    expect(roundTrip('audio', 'Hello there', { voice: 'bella' }).handoff?.voiceId).toBe('EXAVITQu4vr4xnSDxMaL');
  });

  it('ignores a query string without a type or prompt', () => {
    expect(readPromptHandoff(new URLSearchParams('use=image'))).toBeNull();
    expect(readPromptHandoff(new URLSearchParams('prompt=hi'))).toBeNull();
    expect(readPromptHandoff(new URLSearchParams(''))).toBeNull();
  });
});
