import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { modelGenerationQueue, ModelGenerationJobData } from '../queues/modelGenerationQueue';

const prisma = new PrismaClient();

const MESHY_API_KEY = process.env.MESHY_API_KEY;
const MESHY_BASE_URL = process.env.MESHY_BASE_URL || 'https://api.meshy.ai';

const POLL_INTERVAL_MS = 5000;
// Each stage (preview, refine) gets its own timeout budget.
const STAGE_TIMEOUT_MS = 10 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MeshyTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  model_urls?: Record<string, string>;
  thumbnail_url?: string;
  task_error?: { message: string };
}

async function pollTask(taskId: string, headers: Record<string, string>): Promise<MeshyTask> {
  const startedAt = Date.now();

  while (true) {
    if (Date.now() - startedAt > STAGE_TIMEOUT_MS) {
      throw new Error('Timed out waiting for Meshy task to complete');
    }

    await sleep(POLL_INTERVAL_MS);

    const { data } = await axios.get<MeshyTask>(`${MESHY_BASE_URL}/openapi/v2/text-to-3d/${taskId}`, {
      headers,
    });

    if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(data.status)) {
      return data;
    }
    // PENDING, IN_PROGRESS — keep polling
  }
}

export function startModelGenerationWorker() {
  modelGenerationQueue.process(async (job) => {
    const { generationId, request } = job.data as ModelGenerationJobData;

    if (!MESHY_API_KEY) {
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'failed', error: 'MESHY_API_KEY not configured' },
      });
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MESHY_API_KEY}`,
    };

    try {
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'processing' },
      });

      // Stage 1: preview — untextured mesh
      const previewCreate = await axios.post(
        `${MESHY_BASE_URL}/openapi/v2/text-to-3d`,
        {
          mode: 'preview',
          prompt: request.prompt,
          topology: request.topology || 'triangle',
          target_polycount: request.targetPolycount || 30000,
          target_formats: ['glb'],
        },
        { headers }
      );

      const previewTaskId: string = previewCreate.data.result;
      const previewResult = await pollTask(previewTaskId, headers);

      if (previewResult.status !== 'SUCCEEDED') {
        throw new Error(previewResult.task_error?.message || 'Meshy preview stage failed');
      }

      // Stage 2: refine — apply texture to the approved preview mesh
      const refineCreate = await axios.post(
        `${MESHY_BASE_URL}/openapi/v2/text-to-3d`,
        {
          mode: 'refine',
          preview_task_id: previewTaskId,
          enable_pbr: request.enablePbr ?? false,
          texture_resolution: request.textureResolution || '2k',
          target_formats: ['glb'],
        },
        { headers }
      );

      const refineTaskId: string = refineCreate.data.result;
      const refineResult = await pollTask(refineTaskId, headers);

      if (refineResult.status !== 'SUCCEEDED' || !refineResult.model_urls?.glb) {
        throw new Error(refineResult.task_error?.message || 'Meshy refine stage failed');
      }

      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: 'completed',
          outputUrl: refineResult.model_urls.glb,
          metadata: {
            previewTaskId,
            refineTaskId,
            thumbnailUrl: refineResult.thumbnail_url,
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
            error: error.response?.data?.message || error.message || 'Failed to generate 3D model',
          },
        });
      }

      throw error;
    }
  });

  console.log('🧊 3D model generation worker started');
}
