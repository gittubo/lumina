import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuthStore = jest.fn();
jest.mock('@/lib/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

const mockListProjects = jest.fn();
const mockCreateProject = jest.fn();
const mockDeleteProject = jest.fn();
jest.mock('@/lib/api', () => ({
  listProjects: (...args: unknown[]) => mockListProjects(...args),
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
  getApiErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong'),
}));

import DashboardPage from '../page';

const loggedInState = {
  user: { id: 'user_1', email: 'ada@example.com', name: 'Ada', avatar: null },
  token: 'a-token',
  isHydrated: true,
  logout: jest.fn(),
};

const sampleProject = {
  id: 'proj_1',
  title: 'My First Project',
  description: 'A test project',
  userId: 'user_1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListProjects.mockResolvedValue([]);
  });

  it('redirects to /login once hydrated with no session, instead of rendering the dashboard', async () => {
    mockUseAuthStore.mockReturnValue({ user: null, token: null, isHydrated: true, logout: jest.fn() });

    render(<DashboardPage />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
    expect(mockListProjects).not.toHaveBeenCalled();
  });

  it('shows a loading state before hydration completes, without redirecting', () => {
    mockUseAuthStore.mockReturnValue({ user: null, token: null, isHydrated: false, logout: jest.fn() });

    render(<DashboardPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows an empty state when the user has no projects', async () => {
    mockUseAuthStore.mockReturnValue(loggedInState);
    mockListProjects.mockResolvedValue([]);

    render(<DashboardPage />);

    expect(await screen.findByText(/no projects yet/i)).toBeInTheDocument();
  });

  it("renders the user's projects once loaded", async () => {
    mockUseAuthStore.mockReturnValue(loggedInState);
    mockListProjects.mockResolvedValue([sampleProject]);

    render(<DashboardPage />);

    expect(await screen.findByText('My First Project')).toBeInTheDocument();
    expect(screen.getByText('A test project')).toBeInTheDocument();
  });

  it('creates a project and prepends it to the list', async () => {
    const user = userEvent.setup();
    mockUseAuthStore.mockReturnValue(loggedInState);
    mockListProjects.mockResolvedValue([sampleProject]);
    const newProject = { ...sampleProject, id: 'proj_2', title: 'Brand New Project' };
    mockCreateProject.mockResolvedValue(newProject);

    render(<DashboardPage />);
    await screen.findByText('My First Project');

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.type(screen.getByLabelText(/title/i), 'Brand New Project');
    await user.click(screen.getByRole('button', { name: /^create project$/i }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith('Brand New Project', undefined);
    });
    expect(await screen.findByText('Brand New Project')).toBeInTheDocument();
    // Still shows the original project too — the new one is prepended, not replacing the list.
    expect(screen.getByText('My First Project')).toBeInTheDocument();
  });

  it('deletes a project optimistically', async () => {
    const user = userEvent.setup();
    mockUseAuthStore.mockReturnValue(loggedInState);
    mockListProjects.mockResolvedValue([sampleProject]);
    mockDeleteProject.mockResolvedValue(undefined);

    render(<DashboardPage />);
    await screen.findByText('My First Project');

    await user.click(screen.getByRole('button', { name: /delete my first project/i }));

    await waitFor(() => {
      expect(screen.queryByText('My First Project')).not.toBeInTheDocument();
    });
    expect(mockDeleteProject).toHaveBeenCalledWith('proj_1');
  });

  it('restores the project and shows an error if deletion fails', async () => {
    const user = userEvent.setup();
    mockUseAuthStore.mockReturnValue(loggedInState);
    mockListProjects.mockResolvedValue([sampleProject]);
    mockDeleteProject.mockRejectedValue(new Error('Failed to delete project'));

    render(<DashboardPage />);
    await screen.findByText('My First Project');

    await user.click(screen.getByRole('button', { name: /delete my first project/i }));

    // The optimistic removal is a transient intermediate state whose exact
    // timing depends on microtask ordering — what matters for correctness
    // is the settled end state: the project is back, with an error shown.
    expect(await screen.findByText('My First Project')).toBeInTheDocument();
    expect(await screen.findByText('Failed to delete project')).toBeInTheDocument();
    expect(mockDeleteProject).toHaveBeenCalledWith('proj_1');
  });
});
