/** @jest-environment node */
import { checkRateLimit, resetRateLimit } from '../rateLimit';

beforeEach(resetRateLimit);

it('allows requests up to the limit, then blocks until the window resets', () => {
  const now = 1_000_000;
  expect(checkRateLimit('ip', 2, 60_000, now).ok).toBe(true);
  expect(checkRateLimit('ip', 2, 60_000, now).ok).toBe(true);
  expect(checkRateLimit('ip', 2, 60_000, now)).toEqual({ ok: false, retryAfterSeconds: 60 });
  expect(checkRateLimit('other', 2, 60_000, now).ok).toBe(true);
  expect(checkRateLimit('ip', 2, 60_000, now + 60_000).ok).toBe(true);
});
