jest.mock('../../services/projectService', () => ({
  __esModule: true,
  default: {
    getProjectById: jest.fn(),
  },
}));

import { Response } from 'express';
import { verifyProjectOwnership } from '../verifyProjectOwnership';
import projectService from '../../services/projectService';
import { AuthenticatedRequest } from '../../types/auth';

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('verifyProjectOwnership', () => {
  it('rejects an unauthenticated request', async () => {
    const req = { body: { projectId: 'proj_1' } } as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await verifyProjectOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a request with no projectId in the body', async () => {
    const req = { userId: 'user_1', body: {} } as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await verifyProjectOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist or belongs to another user', async () => {
    // getProjectById is itself scoped by (projectId, userId), so this same
    // path covers both "doesn't exist" and "exists but isn't yours" —
    // deliberately, so the response can't be used to distinguish the two.
    (projectService.getProjectById as jest.Mock).mockResolvedValue(null);

    const req = { userId: 'user_1', body: { projectId: 'someone-elses-project' } } as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await verifyProjectOwnership(req, res, next);

    expect(projectService.getProjectById).toHaveBeenCalledWith('someone-elses-project', 'user_1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the project belongs to the requesting user', async () => {
    (projectService.getProjectById as jest.Mock).mockResolvedValue({
      id: 'proj_1',
      title: 'My Project',
      userId: 'user_1',
    });

    const req = { userId: 'user_1', body: { projectId: 'proj_1' } } as AuthenticatedRequest;
    const res = mockResponse();
    const next = jest.fn();

    await verifyProjectOwnership(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
