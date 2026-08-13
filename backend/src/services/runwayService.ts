import { PrismaClient } from '@prisma/client';
import { GenerateVideoRequest, GenerationResponse } from '../types/generation';
import { videoGenerationQueue } from '../queues/videoGenerationQueue';

const prisma = new PrismaClient();

class RunwayService {
  async generateVideo(userId: string, data: GenerateVideoRequest): Promise<GenerationResponse> {
    const generation = await prisma.generation.create({
      data: {
        type: 'video',
        prompt: data.prompt,
        status: 'pending',
        userId,
        projectId: data.projectId,
        metadata: {
          ratio: data.ratio || '1280:720',
          duration: data.duration || 5,
          sourceImageUrl: data.sourceImageUrl,
        },
      },
    });

    await videoGenerationQueue.add({
      generationId: generation.id,
      request: data,
    });

    return generation as GenerationResponse;
  }
}

export default new RunwayService();
