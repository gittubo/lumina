import chalk from 'chalk';
import { loadConfig } from './config';

export function requireAuth(): boolean {
  const config = loadConfig();
  if (!config.token) {
    console.log(chalk.yellow('Not logged in. Run `lumina login` first (or set LUMINA_TOKEN).'));
    process.exitCode = 1;
    return false;
  }
  return true;
}
