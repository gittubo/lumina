import { registerSchema, loginSchema } from '../authValidation';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const { error } = registerSchema.validate({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      password: 'supersecret123',
    });
    expect(error).toBeUndefined();
  });

  it('rejects an invalid email', () => {
    const { error } = registerSchema.validate({
      email: 'not-an-email',
      name: 'Ada Lovelace',
      password: 'supersecret123',
    });
    expect(error).toBeDefined();
  });

  it('rejects a password under 8 characters', () => {
    const { error } = registerSchema.validate({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      password: 'short',
    });
    expect(error).toBeDefined();
  });

  it('rejects a missing name', () => {
    const { error } = registerSchema.validate({
      email: 'ada@example.com',
      password: 'supersecret123',
    });
    expect(error).toBeDefined();
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const { error } = loginSchema.validate({
      email: 'ada@example.com',
      password: 'anything',
    });
    expect(error).toBeUndefined();
  });

  it('rejects a missing password', () => {
    const { error } = loginSchema.validate({ email: 'ada@example.com' });
    expect(error).toBeDefined();
  });

  it('does not enforce the 8-character minimum on login (unlike registration)', () => {
    // Login must accept short passwords too — otherwise a user whose
    // password predates a minimum-length rule could be locked out.
    const { error } = loginSchema.validate({
      email: 'ada@example.com',
      password: 'x',
    });
    expect(error).toBeUndefined();
  });
});
