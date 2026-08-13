import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { GenerateImageRequest, GenerateVideoRequest, GenerateModelRequest, GenerateAudioRequest } from '../types/generation';
import stabilityAiService from '../services/stabilityAiService';
import runwayService from '../services/runwayService';
import meshyService from '../services/meshyService';
import elevenLabsService from '../services/elevenLabsService';

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

  async listByProject(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      const { projectId } = req.params;
      const generations = await stabilityAiService.listByProject(projectId, req.userId);

      return res.status(200).json({ generations });
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to fetch generations',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async generateVideo(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      const { prompt, projectId, ratio, duration, sourceImageUrl } = req.body as GenerateVideoRequest;

      if (!prompt || !projectId) {
        return res.status(400).json({
          error: 'Prompt and projectId are required',
          code: 'INVALID_REQUEST',
        });
      }

      const generation = await runwayService.generateVideo(req.userId, {
        prompt,
        projectId,
        ratio,
        duration,
        sourceImageUrl,
      });

      return res.status(201).json(generation);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to generate video',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async generateModel(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      const { prompt, projectId, topology, targetPolycount, enablePbr, textureResolution } =
        req.body as GenerateModelRequest;

      if (!prompt || !projectId) {
        return res.status(400).json({
          error: 'Prompt and projectId are required',
          code: 'INVALID_REQUEST',
        });
      }

      const generation = await meshyService.generateModel(req.userId, {
        prompt,
        projectId,
        topology,
        targetPolycount,
        enablePbr,
        textureResolution,
      });

      return res.status(201).json(generation);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to generate 3D model',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async generateAudio(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      const { prompt, projectId, voiceId, modelId } = req.body as GenerateAudioRequest;

      if (!prompt || !projectId) {
        return res.status(400).json({
          error: 'Prompt and projectId are required',
          code: 'INVALID_REQUEST',
        });
      }

      const generation = await elevenLabsService.generateAudio(req.userId, {
        prompt,
        projectId,
        voiceId,
        modelId,
      });

      return res.status(201).json(generation);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to generate audio',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}

export default new GenerationController();
