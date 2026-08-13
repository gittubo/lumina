import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { videoGenerationQueue, VideoGenerationJobData } from '../queues/videoGenerationQueue';

const prisma = new PrismaClient();

const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
const RUNWAY_BASE_URL = process.env.RUNWAY_BASE_URL || 'https://api.dev.runwayml.com';
const RUNWAY_API_VERSION = '2024-11-06';
const RUNWAY_MODEL = 'gen4.5';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // Runway's own SDK default timeout

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RunwayTask {
  id: string;
  status: 'PENDING' | 'THROTTLED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  output?: string[];
  failure?: string;
}

export function startVideoGenerationWorker() {
  videoGenerationQueue.process(async (job) => {
    const { generationId, request } = job.data as VideoGenerationJobData;

    if (!RUNWAY_API_KEY) {
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'failed', error: 'RUNWAY_API_KEY not configured' },
      });
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RUNWAY_API_KEY}`,
      'X-Runway-Version': RUNWAY_API_VERSION,
    };

    try {
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'processing' },
      });

      // Text-to-video when no source image is given; image-to-video otherwise —
      // both go through the same image_to_video endpoint per Runway's API.
      const createResponse = await axios.post(
        `${RUNWAY_BASE_URL}/v1/image_to_video`,
        {
          model: RUNWAY_MODEL,
          promptText: request.prompt,
          ...(request.sourceImageUrl ? { promptImage: request.sourceImageUrl } : {}),
          ratio: request.ratio || '1280:720',
          duration: request.duration || 5,
        },
        { headers }
      );

      const taskId: string = createResponse.data.id;

      const startedAt = Date.now();
      let task: RunwayTask;

      // Poll until the task resolves or we exceed the timeout. This job's
      // Bull lock duration is set well above POLL_TIMEOUT_MS (see the queue
      // definition) so the lock won't expire mid-poll.
      while (true) {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          throw new Error('Timed out waiting for Runway video generation to complete');
        }

        await sleep(POLL_INTERVAL_MS);

        const statusResponse = await axios.get<RunwayTask>(`${RUNWAY_BASE_URL}/v1/tasks/${taskId}`, {
          headers,
        });
        task = statusResponse.data;

        if (task.status === 'SUCCEEDED' || task.status === 'FAILED' || task.status === 'CANCELED') {
          break;
        }
        // PENDING, THROTTLED, RUNNING — keep polling
      }

      if (task.status === 'SUCCEEDED' && task.output?.[0]) {
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: 'completed',
            outputUrl: task.output[0],
            metadata: { taskId, model: RUNWAY_MODEL },
          },
        });
      } else {
        throw new Error(task.failure || `Runway task ended with status ${task.status}`);
      }
    } catch (error: any) {
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);

      if (isLastAttempt) {
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: 'failed',
            error: error.response?.data?.error || error.message || 'Failed to generate video',
          },
        });
      }

      throw error;
    }
  });

  console.log('🎬 Video generation worker started');
}
