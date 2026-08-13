import Bull from 'bull';
import type { GenerateImageRequest } from '../types/generation';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export interface ImageGenerationJobData {
  generationId: string;
  request: GenerateImageRequest;
}

// One shared queue instance. Bull connects lazily and reconnects on its own,
// so this is safe to import from both the API process and a worker process.
export const imageGenerationQueue = new Bull<ImageGenerationJobData>('image-generation', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    // Keep a short history for debugging without letting Redis grow unbounded
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

imageGenerationQueue.on('error', (err) => {
  console.error('[image-generation queue] connection error:', err.message);
});
