import fs from 'fs';
import os from 'os';
import path from 'path';

const CONFIG_DIR = path.join(os.homedir(), '.lumina');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_API_URL = 'http://localhost:5000';

export interface CliConfig {
  apiUrl: string;
  token?: string;
  user?: { id: string; email: string };
}

function readConfigFile(): CliConfig {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return { apiUrl: DEFAULT_API_URL, ...JSON.parse(raw) };
  } catch {
    // No config file yet, or it's unreadable/corrupt — fall back to
    // defaults rather than crashing every command.
    return { apiUrl: DEFAULT_API_URL };
  }
}

/**
 * Loads CLI config. Environment variables take precedence over the saved
 * file, so CI/automation can do `LUMINA_TOKEN=xxx lumina generate ...`
 * without ever running an interactive `lumina login`.
 */
export function loadConfig(): CliConfig {
  const fileConfig = readConfigFile();
  return {
    apiUrl: process.env.LUMINA_API_URL || fileConfig.apiUrl,
    token: process.env.LUMINA_TOKEN || fileConfig.token,
    user: fileConfig.user,
  };
}

export function saveConfig(config: CliConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  // 0o600: the file contains a bearer token, so it should only be
  // readable by the current user, not world-readable like a typical file.
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearAuth(): void {
  const config = readConfigFile();
  delete config.token;
  delete config.user;
  saveConfig(config);
}
