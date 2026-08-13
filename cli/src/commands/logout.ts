import chalk from 'chalk';
import { clearAuth } from '../config';

export function logoutCommand(): void {
  clearAuth();
  console.log(chalk.green('✓ Logged out'));
}
