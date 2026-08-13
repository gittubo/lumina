import {
  generateImageSchema,
  generateVideoSchema,
  generateModelSchema,
  generateAudioSchema,
} from '../generationValidation';

describe('generateImageSchema', () => {
  it('accepts a minimal valid request', () => {
    const { error } = generateImageSchema.validate({
      prompt: 'a red fox in the snow',
      projectId: 'proj_123',
    });
    expect(error).toBeUndefined();
  });

  it('accepts a fully-specified request', () => {
    const { error } = generateImageSchema.validate({
      prompt: 'a red fox in the snow',
      projectId: 'proj_123',
      style: 'photorealistic',
      aspectRatio: '16:9',
      negativePrompt: 'blurry',
      samples: 2,
      steps: 50,
      scale: 7.5,
      seed: 42,
    });
    expect(error).toBeUndefined();
  });

  it('rejects a missing prompt', () => {
    const { error } = generateImageSchema.validate({ projectId: 'proj_123' });
    expect(error).toBeDefined();
    expect(error?.details[0].message).toMatch(/prompt/i);
  });

  it('rejects a missing projectId', () => {
    const { error } = generateImageSchema.validate({ prompt: 'a fox' });
    expect(error).toBeDefined();
  });

  it('rejects an empty prompt', () => {
    const { error } = generateImageSchema.validate({ prompt: '', projectId: 'proj_123' });
    expect(error).toBeDefined();
  });

  it('rejects a prompt over the length cap', () => {
    const { error } = generateImageSchema.validate({
      prompt: 'a'.repeat(2001),
      projectId: 'proj_123',
    });
    expect(error).toBeDefined();
  });

  it('rejects an out-of-range steps value', () => {
    const { error } = generateImageSchema.validate({
      prompt: 'a fox',
      projectId: 'proj_123',
      steps: 500,
    });
    expect(error).toBeDefined();
  });

  it('strips unknown fields rather than erroring', () => {
    const { error, value } = generateImageSchema.validate(
      { prompt: 'a fox', projectId: 'proj_123', notAField: 'x' },
      { stripUnknown: true }
    );
    expect(error).toBeUndefined();
    expect(value.notAField).toBeUndefined();
  });
});

describe('generateVideoSchema', () => {
  it('accepts a minimal valid request', () => {
    const { error } = generateVideoSchema.validate({
      prompt: 'a mountain timelapse',
      projectId: 'proj_123',
    });
    expect(error).toBeUndefined();
  });

  it('rejects a duration outside 1-10 seconds', () => {
    const { error } = generateVideoSchema.validate({
      prompt: 'a mountain timelapse',
      projectId: 'proj_123',
      duration: 30,
    });
    expect(error).toBeDefined();
  });

  it('rejects a non-URL sourceImageUrl', () => {
    const { error } = generateVideoSchema.validate({
      prompt: 'a mountain timelapse',
      projectId: 'proj_123',
      sourceImageUrl: 'not-a-url',
    });
    expect(error).toBeDefined();
  });
});

describe('generateModelSchema', () => {
  it('accepts a minimal valid request', () => {
    const { error } = generateModelSchema.validate({
      prompt: 'a leather messenger bag',
      projectId: 'proj_123',
    });
    expect(error).toBeUndefined();
  });

  it('rejects an invalid topology value', () => {
    const { error } = generateModelSchema.validate({
      prompt: 'a leather messenger bag',
      projectId: 'proj_123',
      topology: 'hexagon',
    });
    expect(error).toBeDefined();
  });

  it('rejects a polycount outside the allowed range', () => {
    const { error } = generateModelSchema.validate({
      prompt: 'a leather messenger bag',
      projectId: 'proj_123',
      targetPolycount: 1000000,
    });
    expect(error).toBeDefined();
  });
});

describe('generateAudioSchema', () => {
  it('accepts a minimal valid request', () => {
    const { error } = generateAudioSchema.validate({
      prompt: 'Hello, welcome to Lumina.',
      projectId: 'proj_123',
    });
    expect(error).toBeUndefined();
  });

  it('rejects a missing prompt', () => {
    const { error } = generateAudioSchema.validate({ projectId: 'proj_123' });
    expect(error).toBeDefined();
  });

  it('allows the higher audio-specific length cap', () => {
    const { error } = generateAudioSchema.validate({
      prompt: 'a'.repeat(3000),
      projectId: 'proj_123',
    });
    expect(error).toBeUndefined();
  });
});
