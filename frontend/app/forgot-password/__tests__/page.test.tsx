import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockForgotPasswordRequest = jest.fn();
jest.mock('@/lib/api', () => ({
  forgotPasswordRequest: (...args: unknown[]) => mockForgotPasswordRequest(...args),
  getApiErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong'),
}));

import ForgotPasswordPage from '../page';

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a generic success message after submitting, including the email entered', async () => {
    const user = userEvent.setup();
    mockForgotPasswordRequest.mockResolvedValue({ message: 'ok' });

    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(mockForgotPasswordRequest).toHaveBeenCalledWith('ada@example.com');
  });

  it('shows the same success message even for an email the backend silently ignores', async () => {
    // The backend returns 200 regardless of whether the email is
    // registered — this just confirms the frontend doesn't add its own
    // distinguishing behavior on top of that.
    const user = userEvent.setup();
    mockForgotPasswordRequest.mockResolvedValue({ message: 'ok' });

    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText(/email/i), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it('shows an error message if the request itself fails (e.g. network error)', async () => {
    const user = userEvent.setup();
    mockForgotPasswordRequest.mockRejectedValue(new Error('Network Error'));

    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText('Network Error')).toBeInTheDocument();
  });
});
