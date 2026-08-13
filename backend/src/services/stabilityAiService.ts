import { PrismaClient } from '@prisma/client';
import { GenerateImageRequest, GenerationResponse } from '../types/generation';
import { imageGenerationQueue } from '../queues/imageGenerationQueue';

const prisma = new PrismaClient();

class StabilityAiService {
  async generateImage(userId: string, data: GenerateImageRequest): Promise<GenerationResponse> {
    // Create the generation record up front so it's immediately visible to the
    // user, then hand the actual work off to the queue. The worker (see
    // src/workers/imageGenerationWorker.ts) picks it up, retries on transient
    // failure, and survives an API server restart mid-generation.
    const generation = await prisma.generation.create({
      data: {
        type: 'image',
        prompt: data.prompt,
        status: 'pending',
        userId,
        projectId: data.projectId,
        metadata: {
          style: data.style || 'photorealistic',
          aspectRatio: data.aspectRatio || '1:1',
          negativePrompt: data.negativePrompt,
          samples: data.samples || 1,
          steps: data.steps || 50,
          scale: data.scale || 7.5,
          seed: data.seed || -1,
        },
      },
    });

    await imageGenerationQueue.add({
      generationId: generation.id,
      request: data,
    });

    return generation as GenerationResponse;
  }

  async getGenerationStatus(generationId: string, userId: string): Promise<GenerationResponse | null> {
    const generation = await prisma.generation.findFirst({
      where: {
        id: generationId,
        userId,
      },
    });

    return generation as GenerationResponse | null;
  }

  async listByProject(projectId: string, userId: string): Promise<GenerationResponse[]> {
    const generations = await prisma.generation.findMany({
      where: {
        projectId,
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return generations as GenerationResponse[];
  }
}

export default new StabilityAiService();
