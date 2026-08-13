import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockLoginRequest = jest.fn();
jest.mock('@/lib/api', () => ({
  loginRequest: (...args: unknown[]) => mockLoginRequest(...args),
  getApiErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong'),
}));

const mockSetAuth = jest.fn();
jest.mock('@/lib/authStore', () => ({
  useAuthStore: (selector: (state: any) => unknown) => selector({ setAuth: mockSetAuth }),
}));

import LoginPage from '../page';

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs in, stores auth, and redirects to the dashboard on success', async () => {
    const user = userEvent.setup();
    mockLoginRequest.mockResolvedValue({
      user: { id: 'user_1', email: 'ada@example.com', name: 'Ada', avatar: null },
      token: 'a-token',
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'supersecret123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockLoginRequest).toHaveBeenCalledWith('ada@example.com', 'supersecret123');
    });
    expect(mockSetAuth).toHaveBeenCalledWith(
      { id: 'user_1', email: 'ada@example.com', name: 'Ada', avatar: null },
      'a-token'
    );
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('shows an error message and does not redirect on failed login', async () => {
    const user = userEvent.setup();
    mockLoginRequest.mockRejectedValue(new Error('Invalid email or password'));

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(mockSetAuth).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('disables the submit button while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: unknown) => void;
    mockLoginRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'supersecret123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();

    resolveLogin!({ user: { id: 'user_1', email: 'ada@example.com', name: null, avatar: null }, token: 't' });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
  });
});
