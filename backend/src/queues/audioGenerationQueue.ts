import Bull from 'bull';
import type { GenerateAudioRequest } from '../types/generation';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export interface AudioGenerationJobData {
  generationId: string;
  request: GenerateAudioRequest;
}

// Unlike the other providers, ElevenLabs' TTS endpoint responds synchronously
// with the finished audio — there's no task/polling step. It's still queued
// (rather than called inline from the request handler) so a burst of
// requests doesn't hit ElevenLabs' rate limit all at once, and so it
// survives a server restart mid-request like the other generation types.
export const audioGenerationQueue = new Bull<AudioGenerationJobData>('audio-generation', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

audioGenerationQueue.on('error', (err) => {
  console.error('[audio-generation queue] connection error:', err.message);
});
