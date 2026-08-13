import { getApiErrorMessage } from '../api';

function fakeAxiosError(overrides: { message?: string; response?: { data?: unknown } }) {
  // axios.isAxiosError() checks only the `isAxiosError` flag at runtime, so
  // a plain object shaped like this is a faithful stand-in for a real
  // AxiosError instance without needing to construct one.
  return {
    isAxiosError: true,
    message: overrides.message ?? 'Request failed',
    response: overrides.response,
  };
}

describe('getApiErrorMessage', () => {
  it("extracts the backend's `error` field from an Axios error response", () => {
    const error = fakeAxiosError({ response: { data: { error: 'Invalid email or password' } } });
    expect(getApiErrorMessage(error)).toBe('Invalid email or password');
  });

  it("falls back to the Axios error's own message when there's no response body error field", () => {
    const error = fakeAxiosError({ message: 'connect ECONNREFUSED 127.0.0.1:5000', response: undefined });
    expect(getApiErrorMessage(error)).toBe('connect ECONNREFUSED 127.0.0.1:5000');
  });

  it('falls back to a generic message for a non-Axios error', () => {
    expect(getApiErrorMessage(new Error('boom'))).toBe('Something went wrong');
  });

  it('falls back to a generic message for a completely unknown thrown value', () => {
    expect(getApiErrorMessage('a string')).toBe('Something went wrong');
    expect(getApiErrorMessage(undefined)).toBe('Something went wrong');
  });
});
