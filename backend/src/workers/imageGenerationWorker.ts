import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { imageGenerationQueue, ImageGenerationJobData } from '../queues/imageGenerationQueue';

const prisma = new PrismaClient();

const STABILITY_AI_KEY = process.env.STABILITY_AI_API_KEY;
const STABILITY_AI_URL = process.env.STABILITY_AI_BASE_URL || 'https://api.stability.ai';

// Bull retries failed jobs (see queue's defaultJobOptions), so on transient
// failures we throw instead of writing a final "failed" status — only the
// last attempt's catch block (below) marks the generation as failed for good.
export function startImageGenerationWorker() {
  imageGenerationQueue.process(async (job) => {
    const { generationId, request } = job.data as ImageGenerationJobData;

    if (!STABILITY_AI_KEY) {
      // Not a transient error — retrying won't help without a key configured.
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'failed', error: 'STABILITY_AI_API_KEY not configured' },
      });
      return;
    }

    try {
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'processing' },
      });

      const response = await axios.post(
        `${STABILITY_AI_URL}/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`,
        {
          text_prompts: [{ text: request.prompt, weight: 1 }],
          cfg_scale: request.scale || 7.5,
          clip_guidance_preset: 'FAST_BLUE',
          height: 1024,
          width: 1024,
          samples: request.samples || 1,
          steps: request.steps || 50,
          style_preset: request.style || 'photorealistic',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${STABILITY_AI_KEY}`,
          },
        }
      );

      const artifact = response.data.artifacts?.[0];
      if (!artifact) {
        throw new Error('Stability AI returned no artifacts');
      }

      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: 'completed',
          outputUrl: `data:image/png;base64,${artifact.base64}`,
          metadata: {
            finishReason: artifact.finishReason,
            seed: artifact.seed,
          },
        },
      });
    } catch (error: any) {
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);

      if (isLastAttempt) {
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: 'failed',
            error: error.message || 'Failed to generate image',
          },
        });
      }

      // Re-throw so Bull records the attempt and retries with backoff
      // (unless this was the last attempt, in which case it just marks the job failed).
      throw error;
    }
  });

  console.log('🎨 Image generation worker started');
}
