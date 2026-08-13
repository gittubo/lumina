import { PrismaClient } from '@prisma/client';
import { GenerateModelRequest, GenerationResponse } from '../types/generation';
import { modelGenerationQueue } from '../queues/modelGenerationQueue';

const prisma = new PrismaClient();

class MeshyService {
  async generateModel(userId: string, data: GenerateModelRequest): Promise<GenerationResponse> {
    const generation = await prisma.generation.create({
      data: {
        type: '3d',
        prompt: data.prompt,
        status: 'pending',
        userId,
        projectId: data.projectId,
        metadata: {
          topology: data.topology || 'triangle',
          targetPolycount: data.targetPolycount || 30000,
          enablePbr: data.enablePbr ?? false,
          textureResolution: data.textureResolution || '2k',
        },
      },
    });

    await modelGenerationQueue.add({
      generationId: generation.id,
      request: data,
    });

    return generation as GenerationResponse;
  }
}

export default new MeshyService();
