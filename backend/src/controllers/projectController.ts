import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { CreateProjectRequest, UpdateProjectRequest } from '../types/project';
import projectService from '../services/projectService';

class ProjectController {
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      const { title, description } = req.body as CreateProjectRequest;

      if (!title) {
        return res.status(400).json({
          error: 'Title is required',
          code: 'INVALID_REQUEST',
        });
      }

      const project = await projectService.createProject(req.userId, {
        title,
        description,
      });

      return res.status(201).json(project);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to create project',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async list(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      const projects = await projectService.getProjectsByUser(req.userId);
      return res.status(200).json({ projects });
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to fetch projects',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      const { id } = req.params;
      const project = await projectService.getProjectById(id, req.userId);

      if (!project) {
        return res.status(404).json({
          error: 'Project not found',
          code: 'NOT_FOUND',
        });
      }

      return res.status(200).json(project);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to fetch project',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      const { id } = req.params;
      const data = req.body as UpdateProjectRequest;

      const project = await projectService.updateProject(id, req.userId, data);
      return res.status(200).json(project);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: error.message,
          code: 'NOT_FOUND',
        });
      }

      return res.status(500).json({
        error: error.message || 'Failed to update project',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'UNAUTHORIZED',
        });
      }

      const { id } = req.params;
      await projectService.deleteProject(id, req.userId);

      return res.status(204).send();
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: error.message,
          code: 'NOT_FOUND',
        });
      }

      return res.status(500).json({
        error: error.message || 'Failed to delete project',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}

export default new ProjectController();
