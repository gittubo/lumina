import express from 'express';
import generationController from '../controllers/generationController';
import { authMiddleware } from '../middleware/authMiddleware';
import { generationRateLimiter } from '../middleware/rateLimiter';
import { dailyGenerationCap } from '../middleware/dailyGenerationCap';
import { validate } from '../middleware/validate';
import { verifyProjectOwnership } from '../middleware/verifyProjectOwnership';
import {
  generateImageSchema,
  generateVideoSchema,
  generateModelSchema,
  generateAudioSchema,
} from '../validation/generationValidation';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Applied to every route below: burst rate limiting per user (see rateLimiter.ts).
router.use(generationRateLimiter);

/**
 * @swagger
 * /generations/image:
 *   post:
 *     summary: Generate an image (Stability AI)
 *     description: Creates a `pending` Generation and enqueues it for background processing. Poll `GET /generations/{id}` for its result.
 *     tags: [Generations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt, projectId]
 *             properties:
 *               prompt: { type: string, maxLength: 2000 }
 *               projectId: { type: string }
 *               style: { type: string }
 *               aspectRatio: { type: string, example: "16:9" }
 *               negativePrompt: { type: string }
 *               samples: { type: integer, minimum: 1, maximum: 4 }
 *               steps: { type: integer, minimum: 10, maximum: 150 }
 *               scale: { type: number }
 *               seed: { type: integer }
 *     responses:
 *       201:
 *         description: Generation queued
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Generation' }
 *       400:
 *         description: Validation error
 *       404:
 *         description: Project not found or not owned by the requesting user
 *       429:
 *         description: Rate limit or daily generation cap reached
 */
router.post(
  '/image',
  validate(generateImageSchema),
  verifyProjectOwnership,
  dailyGenerationCap,
  (req, res) => generationController.generateImage(req, res)
);

/**
 * @swagger
 * /generations/video:
 *   post:
 *     summary: Generate a video (Runway)
 *     description: Creates a `pending` Generation and enqueues it for background processing. Video generation can take a few minutes — poll `GET /generations/{id}` for its result.
 *     tags: [Generations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt, projectId]
 *             properties:
 *               prompt: { type: string, maxLength: 2000 }
 *               projectId: { type: string }
 *               ratio: { type: string, example: "1280:720" }
 *               duration: { type: integer, minimum: 1, maximum: 10 }
 *               sourceImageUrl: { type: string, format: uri, description: "Omit for text-to-video" }
 *     responses:
 *       201:
 *         description: Generation queued
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Generation' }
 *       400:
 *         description: Validation error
 *       404:
 *         description: Project not found or not owned by the requesting user
 *       429:
 *         description: Rate limit or daily generation cap reached
 */
router.post(
  '/video',
  validate(generateVideoSchema),
  verifyProjectOwnership,
  dailyGenerationCap,
  (req, res) => generationController.generateVideo(req, res)
);

/**
 * @swagger
 * /generations/model:
 *   post:
 *     summary: Generate a 3D model (Meshy)
 *     description: Two-stage pipeline (preview mesh, then textured refine) run in the background — can take several minutes. Poll `GET /generations/{id}` for its result.
 *     tags: [Generations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt, projectId]
 *             properties:
 *               prompt: { type: string, maxLength: 2000 }
 *               projectId: { type: string }
 *               topology: { type: string, enum: [triangle, quad] }
 *               targetPolycount: { type: integer, minimum: 100, maximum: 300000 }
 *               enablePbr: { type: boolean }
 *               textureResolution: { type: string, enum: ["2k", "4k", "8k"] }
 *     responses:
 *       201:
 *         description: Generation queued
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Generation' }
 *       400:
 *         description: Validation error
 *       404:
 *         description: Project not found or not owned by the requesting user
 *       429:
 *         description: Rate limit or daily generation cap reached
 */
router.post(
  '/model',
  validate(generateModelSchema),
  verifyProjectOwnership,
  dailyGenerationCap,
  (req, res) => generationController.generateModel(req, res)
);

/**
 * @swagger
 * /generations/audio:
 *   post:
 *     summary: Generate speech audio (Eleven Labs)
 *     description: Creates a `pending` Generation and enqueues it for background processing. Poll `GET /generations/{id}` for its result.
 *     tags: [Generations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt, projectId]
 *             properties:
 *               prompt: { type: string, maxLength: 5000, description: "The text to speak" }
 *               projectId: { type: string }
 *               voiceId: { type: string }
 *               modelId: { type: string }
 *     responses:
 *       201:
 *         description: Generation queued
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Generation' }
 *       400:
 *         description: Validation error
 *       404:
 *         description: Project not found or not owned by the requesting user
 *       429:
 *         description: Rate limit or daily generation cap reached
 */
router.post(
  '/audio',
  validate(generateAudioSchema),
  verifyProjectOwnership,
  dailyGenerationCap,
  (req, res) => generationController.generateAudio(req, res)
);

/**
 * @swagger
 * /generations/project/{projectId}:
 *   get:
 *     summary: List all generations for a project
 *     tags: [Generations]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Generations for this project belonging to the requesting user, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 generations:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Generation' }
 */
router.get('/project/:projectId', (req, res) => generationController.listByProject(req, res));

/**
 * @swagger
 * /generations/{id}:
 *   get:
 *     summary: Get a single generation's current status/result
 *     tags: [Generations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The generation
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Generation' }
 *       404:
 *         description: Not found (or not owned by the requesting user)
 */
router.get('/:id', (req, res) => generationController.getStatus(req, res));

export default router;
