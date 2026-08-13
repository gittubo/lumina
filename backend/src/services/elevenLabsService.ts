import { PrismaClient } from '@prisma/client';
import { GenerateAudioRequest, GenerationResponse } from '../types/generation';
import { audioGenerationQueue } from '../queues/audioGenerationQueue';

const prisma = new PrismaClient();

class ElevenLabsService {
  async generateAudio(userId: string, data: GenerateAudioRequest): Promise<GenerationResponse> {
    const generation = await prisma.generation.create({
      data: {
        type: 'audio',
        prompt: data.prompt,
        status: 'pending',
        userId,
        projectId: data.projectId,
        metadata: {
          voiceId: data.voiceId,
          modelId: data.modelId,
        },
      },
    });

    await audioGenerationQueue.add({
      generationId: generation.id,
      request: data,
    });

    return generation as GenerationResponse;
  }
}

export default new ElevenLabsService();
