import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { GenerateImageRequest } from '../types/generation';
import stabilityAiService from '../services/stabilityAiService';

class GenerationController {
  async generateImage(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      const { prompt, projectId, style, aspectRatio, negativePrompt, samples, steps, scale, seed } =
        req.body as GenerateImageRequest;

      if (!prompt || !projectId) {
        return res.status(400).json({
          error: 'Prompt and projectId are required',
          code: 'INVALID_REQUEST',
        });
      }

      const generation = await stabilityAiService.generateImage(req.userId, {
        prompt,
        projectId,
        style,
        aspectRatio,
        negativePrompt,
        samples,
        steps,
        scale,
        seed,
      });

      return res.status(201).json(generation);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to generate image',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async getStatus(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      const { id } = req.params;
      const generation = await stabilityAiService.getGenerationStatus(id, req.userId);

      if (!generation) {
        return res.status(404).json({
          error: 'Generation not found',
          code: 'NOT_FOUND',
        });
      }

      return res.status(200).json(generation);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to fetch generation status',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}

export default new GenerationController();
