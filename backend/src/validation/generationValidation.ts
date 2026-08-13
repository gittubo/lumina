import Joi from 'joi';

// A prompt over ~2000 chars is almost certainly abuse or a mistake, not a
// legitimate creative brief — every provider we call (Stability, Runway,
// Meshy, Eleven Labs) bills per request regardless of how large the input
// is, so an oversized prompt is pure wasted spend with no benefit.
const PROMPT_MAX_LENGTH = 2000;
const prompt = Joi.string().trim().min(1).max(PROMPT_MAX_LENGTH).required();
const projectId = Joi.string().trim().required();

export const generateImageSchema = Joi.object({
  prompt,
  projectId,
  style: Joi.string().max(50).optional(),
  aspectRatio: Joi.string().max(20).optional(),
  negativePrompt: Joi.string().max(PROMPT_MAX_LENGTH).allow('').optional(),
  samples: Joi.number().integer().min(1).max(4).optional(),
  steps: Joi.number().integer().min(10).max(150).optional(),
  scale: Joi.number().min(0).max(35).optional(),
  seed: Joi.number().integer().optional(),
});

export const generateVideoSchema = Joi.object({
  prompt,
  projectId,
  ratio: Joi.string().max(20).optional(),
  duration: Joi.number().integer().min(1).max(10).optional(),
  sourceImageUrl: Joi.string().uri().max(2000).optional(),
});

export const generateModelSchema = Joi.object({
  prompt,
  projectId,
  topology: Joi.string().valid('triangle', 'quad').optional(),
  targetPolycount: Joi.number().integer().min(100).max(300000).optional(),
  enablePbr: Joi.boolean().optional(),
  textureResolution: Joi.string().valid('2k', '4k', '8k').optional(),
});

export const generateAudioSchema = Joi.object({
  prompt: Joi.string().trim().min(1).max(5000).required(), // ElevenLabs' own per-request cap
  projectId,
  voiceId: Joi.string().max(100).optional(),
  modelId: Joi.string().max(100).optional(),
});
