import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockRegisterRequest = jest.fn();
jest.mock('@/lib/api', () => ({
  registerRequest: (...args: unknown[]) => mockRegisterRequest(...args),
  getApiErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong'),
}));

const mockSetAuth = jest.fn();
jest.mock('@/lib/authStore', () => ({
  useAuthStore: (selector: (state: any) => unknown) => selector({ setAuth: mockSetAuth }),
}));

import RegisterPage from '../page';

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks submission client-side for a password under 8 characters, without calling the API', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/name/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mockRegisterRequest).not.toHaveBeenCalled();
  });

  it('registers, stores auth, and redirects to the dashboard on success', async () => {
    const user = userEvent.setup();
    mockRegisterRequest.mockResolvedValue({
      user: { id: 'user_1', email: 'ada@example.com', name: 'Ada Lovelace', avatar: null },
      token: 'a-token',
    });

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/name/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'supersecret123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegisterRequest).toHaveBeenCalledWith('ada@example.com', 'Ada Lovelace', 'supersecret123');
    });
    expect(mockSetAuth).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('surfaces a server-side error, e.g. a duplicate email, without redirecting', async () => {
    const user = userEvent.setup();
    mockRegisterRequest.mockRejectedValue(new Error('User with this email already exists'));

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/name/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'supersecret123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('User with this email already exists')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
