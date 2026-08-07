import axios from 'axios';
import { GenerateImageRequest, GenerationResponse } from '../types/generation';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STABILITY_AI_KEY = process.env.STABILITY_AI_API_KEY;
const STABILITY_AI_URL = process.env.STABILITY_AI_BASE_URL || 'https://api.stability.ai';

class StabilityAiService {
  async generateImage(userId: string, data: GenerateImageRequest): Promise<GenerationResponse> {
    // Create generation record with pending status
    const generation = await prisma.generation.create({
      data: {
        type: 'image',
        prompt: data.prompt,
        status: 'processing',
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

    // Queue the actual generation
    this.processImageGeneration(generation.id, data).catch((error) => {
      console.error('Error processing image generation:', error);
    });

    return generation as GenerationResponse;
  }

  private async processImageGeneration(
    generationId: string,
    data: GenerateImageRequest
  ): Promise<void> {
    try {
      if (!STABILITY_AI_KEY) {
        throw new Error('STABILITY_AI_API_KEY not configured');
      }

      const response = await axios.post(
        `${STABILITY_AI_URL}/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`,
        {
          text_prompts: [
            {
              text: data.prompt,
              weight: 1,
            },
          ],
          cfg_scale: data.scale || 7.5,
          clip_guidance_preset: 'FAST_BLUE',
          height: 1024,
          width: 1024,
          samples: data.samples || 1,
          steps: data.steps || 50,
          style_preset: data.style || 'photorealistic',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${STABILITY_AI_KEY}`,
          },
        }
      );

      // Save the generated image URL
      if (response.data.artifacts && response.data.artifacts.length > 0) {
        const imageData = response.data.artifacts[0];
        
        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: 'completed',
            outputUrl: `data:image/png;base64,${imageData.base64}`,
            metadata: {
              ...(imageData as any),
              finishReason: imageData.finishReason,
              seed: imageData.seed,
            },
          },
        });
      }
    } catch (error: any) {
      console.error('Stability AI error:', error);
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: 'failed',
          error: error.message || 'Failed to generate image',
        },
      });
    }
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
}

export default new StabilityAiService();
