import prompts from 'prompts';
import chalk from 'chalk';
import axios from 'axios';
import { loadConfig, saveConfig } from '../config';
import { getApiErrorMessage } from '../api';

export async function loginCommand(): Promise<void> {
  const config = loadConfig();

  const answers = await prompts([
    { type: 'text', name: 'email', message: 'Email' },
    { type: 'password', name: 'password', message: 'Password' },
  ]);

  // prompts() resolves with an empty object (not a rejected promise) if the
  // user Ctrl+C's out of the form — check explicitly rather than assume.
  if (!answers.email || !answers.password) {
    console.log(chalk.yellow('Login cancelled.'));
    return;
  }

  try {
    const { data } = await axios.post(`${config.apiUrl}/api/auth/login`, {
      email: answers.email,
      password: answers.password,
    });

    saveConfig({ ...config, token: data.token, user: data.user });
    console.log(chalk.green(`✓ Logged in as ${data.user.email}`));
  } catch (error) {
    console.error(chalk.red(`✗ Login failed: ${getApiErrorMessage(error)}`));
    process.exitCode = 1;
  }
}
