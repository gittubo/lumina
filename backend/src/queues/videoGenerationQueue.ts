import Bull from 'bull';
import type { GenerateVideoRequest } from '../types/generation';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export interface VideoGenerationJobData {
  generationId: string;
  request: GenerateVideoRequest;
}

// Video generation is much slower than image generation (Runway tasks are
// polled over the course of minutes), so the job lock is held much longer
// than Bull's default 30s — otherwise Bull would consider the job stalled
// and reassign it to another worker while it's still legitimately running.
export const videoGenerationQueue = new Bull<VideoGenerationJobData>('video-generation', REDIS_URL, {
  settings: {
    lockDuration: 15 * 60 * 1000, // 15 minutes
    lockRenewTime: 5 * 60 * 1000, // renew at the halfway point
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

videoGenerationQueue.on('error', (err) => {
  console.error('[video-generation queue] connection error:', err.message);
});
