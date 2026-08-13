import { getApiErrorMessage } from '../api';

function fakeAxiosError(overrides: { message?: string; response?: { data?: unknown } }) {
  // axios.isAxiosError() checks only the `isAxiosError` flag at runtime, so
  // a plain object shaped like this is a faithful, dependency-free stand-in
  // for a real AxiosError instance.
  return {
    isAxiosError: true,
    message: overrides.message ?? 'Request failed',
    response: overrides.response,
  };
}

describe('getApiErrorMessage', () => {
  it("extracts the backend's `error` field from an Axios error response", () => {
    const error = fakeAxiosError({ response: { data: { error: 'Email already registered' } } });
    expect(getApiErrorMessage(error)).toBe('Email already registered');
  });

  it("falls back to the Axios error's own message when the response has no `error` field", () => {
    const error = fakeAxiosError({ message: 'Network Error', response: undefined });
    expect(getApiErrorMessage(error)).toBe('Network Error');
  });

  it("falls back to the Axios error's own message when the response body has no `error` field", () => {
    const error = fakeAxiosError({ message: 'Network Error', response: { data: {} } });
    expect(getApiErrorMessage(error)).toBe('Network Error');
  });

  it('falls back to a generic message for a non-Axios error', () => {
    expect(getApiErrorMessage(new Error('some other failure'))).toBe('Something went wrong');
  });

  it('falls back to a generic message for a completely unknown thrown value', () => {
    expect(getApiErrorMessage('a plain string was thrown')).toBe('Something went wrong');
    expect(getApiErrorMessage(undefined)).toBe('Something went wrong');
  });
});
