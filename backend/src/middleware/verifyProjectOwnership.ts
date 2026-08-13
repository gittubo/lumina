import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import projectService from '../services/projectService';

// Every generation-create endpoint takes a projectId in its body. Without
// this check, a user who knows or guesses another user's project ID could
// have their generation silently attached to it — an IDOR. This confirms
// the project exists AND belongs to req.userId before the controller ever
// touches a paid third-party API.
export async function verifyProjectOwnership(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
  }

  const { projectId } = req.body as { projectId?: string };

  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required', code: 'INVALID_REQUEST' });
  }

  const project = await projectService.getProjectById(projectId, req.userId);

  if (!project) {
    return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
  }

  next();
}
