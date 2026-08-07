import express from 'express';
import projectController from '../controllers/projectController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/', (req, res) => projectController.create(req, res));
router.get('/', (req, res) => projectController.list(req, res));
router.get('/:id', (req, res) => projectController.getById(req, res));
router.put('/:id', (req, res) => projectController.update(req, res));
router.delete('/:id', (req, res) => projectController.delete(req, res));

export default router;
