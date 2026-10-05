import express from 'express';
import chatController from '../controllers/chatController';
import { authMiddleware } from '../middleware/authMiddleware';
import { chatRateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { createConversationSchema, sendMessageSchema } from '../validation/chatValidation';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /chat/conversations:
 *   post:
 *     summary: Start a conversation with the Lumina Assistant
 *     description: Optionally scoped to a project, in which case the assistant sees the project's details and recent generation prompts.
 *     tags: [Chat]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectId: { type: string }
 *     responses:
 *       201:
 *         description: Conversation created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Conversation' }
 *       404:
 *         description: Project not found or not owned by the requesting user
 */
router.post('/conversations', validate(createConversationSchema), (req, res) =>
  chatController.createConversation(req, res)
);

/**
 * @swagger
 * /chat/conversations:
 *   get:
 *     summary: List the current user's conversations, most recently active first
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: Conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversations:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Conversation' }
 */
router.get('/conversations', (req, res) => chatController.listConversations(req, res));

/**
 * @swagger
 * /chat/conversations/{id}:
 *   get:
 *     summary: Get a conversation with its messages
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The conversation
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Conversation'
 *                 - type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ChatMessage' }
 *       404:
 *         description: Not found (or not owned by the requesting user)
 */
router.get('/conversations/:id', (req, res) => chatController.getConversation(req, res));

/**
 * @swagger
 * /chat/conversations/{id}:
 *   delete:
 *     summary: Delete a conversation
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Not found (or not owned by the requesting user)
 */
router.delete('/conversations/:id', (req, res) => chatController.deleteConversation(req, res));

/**
 * @swagger
 * /chat/conversations/{id}/messages:
 *   post:
 *     summary: Send a message and stream the assistant's reply
 *     description: |
 *       Responds with `text/event-stream`. Events: `delta` (`{ text }`, repeated as the reply streams),
 *       then either `done` (`{ userMessage, assistantMessage, title }`) or `error` (`{ error, code }`).
 *       Both messages are saved only when the reply completes. Errors before streaming starts are
 *       returned as a normal JSON error response.
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, maxLength: 8000 }
 *     responses:
 *       200:
 *         description: Server-Sent Events stream
 *         content:
 *           text/event-stream:
 *             schema: { type: string }
 *       400:
 *         description: Validation error
 *       404:
 *         description: Conversation not found (or not owned by the requesting user)
 *       429:
 *         description: Chat rate limit reached
 *       503:
 *         description: Assistant not configured (no ANTHROPIC_API_KEY)
 */
router.post('/conversations/:id/messages', chatRateLimiter, validate(sendMessageSchema), (req, res) =>
  chatController.sendMessage(req, res)
);

export default router;
