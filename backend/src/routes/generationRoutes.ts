import express from 'express';
import generationController from '../controllers/generationController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/image', (req, res) => generationController.generateImage(req, res));
router.get('/:id', (req, res) => generationController.getStatus(req, res));

export default router;
