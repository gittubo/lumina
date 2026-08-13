import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPush = jest.fn();
const mockGet = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

const mockResetPasswordRequest = jest.fn();
jest.mock('@/lib/api', () => ({
  resetPasswordRequest: (...args: unknown[]) => mockResetPasswordRequest(...args),
  getApiErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong'),
}));

import ResetPasswordPage from '../page';

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an "invalid link" state and no form when the URL has no token', async () => {
    mockGet.mockReturnValue(null);

    render(<ResetPasswordPage />);

    expect(await screen.findByText(/invalid reset link/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it('blocks submission client-side for a password under 8 characters', async () => {
    mockGet.mockReturnValue('a-valid-token');
    const user = userEvent.setup();

    render(<ResetPasswordPage />);

    await user.type(await screen.findByLabelText(/^new password$/i), 'short');
    await user.type(screen.getByLabelText(/confirm new password/i), 'short');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mockResetPasswordRequest).not.toHaveBeenCalled();
  });

  it('blocks submission client-side when the two password fields do not match', async () => {
    mockGet.mockReturnValue('a-valid-token');
    const user = userEvent.setup();

    render(<ResetPasswordPage />);

    await user.type(await screen.findByLabelText(/^new password$/i), 'supersecret123');
    await user.type(screen.getByLabelText(/confirm new password/i), 'differentPassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(mockResetPasswordRequest).not.toHaveBeenCalled();
  });

  it('submits the token and new password, and shows a success message', async () => {
    mockGet.mockReturnValue('a-valid-token');
    mockResetPasswordRequest.mockResolvedValue({ message: 'ok' });
    const user = userEvent.setup();

    render(<ResetPasswordPage />);

    await user.type(await screen.findByLabelText(/^new password$/i), 'supersecret123');
    await user.type(screen.getByLabelText(/confirm new password/i), 'supersecret123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(mockResetPasswordRequest).toHaveBeenCalledWith('a-valid-token', 'supersecret123');
    });
    expect(await screen.findByText(/password reset/i)).toBeInTheDocument();
  });

  it('shows a server-side error, e.g. an expired token, without showing success', async () => {
    mockGet.mockReturnValue('an-expired-token');
    mockResetPasswordRequest.mockRejectedValue(new Error('Invalid or expired reset token'));
    const user = userEvent.setup();

    render(<ResetPasswordPage />);

    await user.type(await screen.findByLabelText(/^new password$/i), 'supersecret123');
    await user.type(screen.getByLabelText(/confirm new password/i), 'supersecret123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('Invalid or expired reset token')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
