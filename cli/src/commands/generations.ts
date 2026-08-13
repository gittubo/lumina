import chalk from 'chalk';
import Table from 'cli-table3';
import { createApiClient, getApiErrorMessage } from '../api';
import { requireAuth } from '../auth-guard';
import { pollUntilDone, GenerationResult } from '../poll';

function statusColor(status: string): string {
  if (status === 'completed') return chalk.green(status);
  if (status === 'failed') return chalk.red(status);
  return chalk.yellow(status);
}

export async function listGenerationsCommand(options: { project: string }): Promise<void> {
  if (!requireAuth()) return;

  try {
    const client = createApiClient();
    const { data } = await client.get<{ generations: GenerationResult[] }>(
      `/generations/project/${options.project}`
    );

    if (data.generations.length === 0) {
      console.log(chalk.dim('No generations yet for this project.'));
      return;
    }

    const table = new Table({ head: ['ID', 'Type', 'Status', 'Prompt', 'Created'] });
    for (const g of data.generations as any[]) {
      const prompt = g.prompt.length > 40 ? g.prompt.slice(0, 40) + '…' : g.prompt;
      table.push([g.id, g.type, statusColor(g.status), prompt, new Date(g.createdAt).toLocaleString()]);
    }
    console.log(table.toString());
  } catch (error) {
    console.error(chalk.red(`✗ ${getApiErrorMessage(error)}`));
    process.exitCode = 1;
  }
}

export async function statusCommand(id: string): Promise<void> {
  if (!requireAuth()) return;

  try {
    const client = createApiClient();
    const { data } = await client.get<GenerationResult>(`/generations/${id}`);

    console.log(chalk.bold('ID:'), data.id);
    console.log(chalk.bold('Type:'), data.type);
    console.log(chalk.bold('Status:'), statusColor(data.status));
    console.log(chalk.bold('Prompt:'), data.prompt);
    if (data.outputUrl) {
      console.log(
        chalk.bold('Output:'),
        data.outputUrl.startsWith('data:') ? chalk.dim('(embedded data)') : data.outputUrl
      );
    }
    if (data.error) {
      console.log(chalk.bold('Error:'), chalk.red(data.error));
    }
  } catch (error) {
    console.error(chalk.red(`✗ ${getApiErrorMessage(error)}`));
    process.exitCode = 1;
  }
}

export async function watchCommand(id: string): Promise<void> {
  if (!requireAuth()) return;

  const client = createApiClient();
  try {
    const result = await pollUntilDone(client, id);
    if (result.outputUrl) {
      console.log(
        chalk.bold('Output:'),
        result.outputUrl.startsWith('data:') ? chalk.dim('(embedded data)') : result.outputUrl
      );
    }
  } catch (error) {
    console.error(chalk.red(`✗ ${getApiErrorMessage(error)}`));
    process.exitCode = 1;
  }
}
