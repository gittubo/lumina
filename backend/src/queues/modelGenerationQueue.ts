import Bull from 'bull';
import type { GenerateModelRequest } from '../types/generation';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export interface ModelGenerationJobData {
  generationId: string;
  request: GenerateModelRequest;
}

// Text-to-3D is a two-stage pipeline (preview mesh, then refine/texture),
// each polled independently — this can run longer than video generation,
// so the lock duration is generous.
export const modelGenerationQueue = new Bull<ModelGenerationJobData>('model-generation', REDIS_URL, {
  settings: {
    lockDuration: 20 * 60 * 1000, // 20 minutes
    lockRenewTime: 5 * 60 * 1000,
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

modelGenerationQueue.on('error', (err) => {
  console.error('[model-generation queue] connection error:', err.message);
});
