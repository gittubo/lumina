import { PrismaClient } from '@prisma/client';
import { CreateProjectRequest, UpdateProjectRequest, ProjectResponse } from '../types/project';

const prisma = new PrismaClient();

class ProjectService {
  async createProject(userId: string, data: CreateProjectRequest): Promise<ProjectResponse> {
    const project = await prisma.project.create({
      data: {
        title: data.title,
        description: data.description,
        userId,
      },
    });

    return project;
  }

  async getProjectsByUser(userId: string): Promise<ProjectResponse[]> {
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return projects;
  }

  async getProjectById(projectId: string, userId: string): Promise<ProjectResponse | null> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    return project;
  }

  async updateProject(
    projectId: string,
    userId: string,
    data: UpdateProjectRequest
  ): Promise<ProjectResponse> {
    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found or unauthorized');
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data,
    });

    return updated;
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found or unauthorized');
    }

    await prisma.project.delete({
      where: { id: projectId },
    });
  }
}

export default new ProjectService();
