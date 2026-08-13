import os from 'os';
import fs from 'fs';
import path from 'path';

// Redirect the config file to a throwaway temp directory so these tests
// never read or write the real ~/.lumina on whichever machine runs them.
const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-cli-test-'));
jest.spyOn(os, 'homedir').mockReturnValue(TEST_HOME);

import { loadConfig, saveConfig, clearAuth } from '../config';

const CONFIG_FILE = path.join(TEST_HOME, '.lumina', 'config.json');

beforeEach(() => {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.rmSync(CONFIG_FILE);
  }
  delete process.env.LUMINA_API_URL;
  delete process.env.LUMINA_TOKEN;
});

afterAll(() => {
  fs.rmSync(TEST_HOME, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('returns the default API URL when no config file exists yet', () => {
    const config = loadConfig();
    expect(config.apiUrl).toBe('http://localhost:5000');
    expect(config.token).toBeUndefined();
  });

  it('round-trips a saved config', () => {
    saveConfig({ apiUrl: 'https://example.com', token: 'abc123', user: { id: 'u1', email: 'a@b.com' } });

    const config = loadConfig();

    expect(config).toEqual({
      apiUrl: 'https://example.com',
      token: 'abc123',
      user: { id: 'u1', email: 'a@b.com' },
    });
  });

  it('writes the config file with 0600 permissions (owner read/write only)', () => {
    saveConfig({ apiUrl: 'https://example.com', token: 'abc123' });

    const mode = fs.statSync(CONFIG_FILE).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('LUMINA_API_URL and LUMINA_TOKEN env vars override the saved file', () => {
    saveConfig({ apiUrl: 'https://from-file.com', token: 'file-token' });
    process.env.LUMINA_API_URL = 'https://from-env.com';
    process.env.LUMINA_TOKEN = 'env-token';

    const config = loadConfig();

    expect(config.apiUrl).toBe('https://from-env.com');
    expect(config.token).toBe('env-token');
  });
});

describe('clearAuth', () => {
  it('removes the token and user but keeps apiUrl', () => {
    saveConfig({ apiUrl: 'https://example.com', token: 'abc123', user: { id: 'u1', email: 'a@b.com' } });

    clearAuth();

    const config = loadConfig();
    expect(config.token).toBeUndefined();
    expect(config.user).toBeUndefined();
    expect(config.apiUrl).toBe('https://example.com');
  });
});
