import chalk from 'chalk';
import { createApiClient, getApiErrorMessage } from '../api';
import { loadConfig } from '../config';
import { requireAuth } from '../auth-guard';

export async function whoamiCommand(): Promise<void> {
  if (!requireAuth()) return;

  const config = loadConfig();
  try {
    const client = createApiClient();
    const { data } = await client.get<{ user: { id: string; email: string } }>('/auth/me');
    console.log(chalk.bold('Logged in as:'), data.user.email);
    console.log(chalk.dim('API:'), config.apiUrl);
  } catch (error) {
    console.error(chalk.red(`✗ ${getApiErrorMessage(error)}`));
    process.exitCode = 1;
  }
}
