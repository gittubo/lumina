import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config';

export function setApiUrlCommand(url: string): void {
  const config = loadConfig();
  saveConfig({ ...config, apiUrl: url.replace(/\/$/, '') });
  console.log(chalk.green(`✓ API URL set to ${url}`));
}

export function showConfigCommand(): void {
  const config = loadConfig();
  console.log(chalk.bold('API URL:'), config.apiUrl);
  console.log(
    chalk.bold('Logged in:'),
    config.token ? chalk.green('yes') + (config.user ? ` (${config.user.email})` : '') : chalk.yellow('no')
  );
}
