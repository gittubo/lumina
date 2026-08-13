import chalk from 'chalk';
import Table from 'cli-table3';
import prompts from 'prompts';
import { createApiClient, getApiErrorMessage } from '../api';
import { requireAuth } from '../auth-guard';

interface Project {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}

export async function listProjectsCommand(): Promise<void> {
  if (!requireAuth()) return;

  try {
    const client = createApiClient();
    const { data } = await client.get<{ projects: Project[] }>('/projects');

    if (data.projects.length === 0) {
      console.log(chalk.dim('No projects yet. Create one with `lumina projects create <title>`.'));
      return;
    }

    const table = new Table({ head: ['ID', 'Title', 'Description', 'Created'] });
    for (const p of data.projects) {
      table.push([p.id, p.title, p.description || chalk.dim('—'), new Date(p.createdAt).toLocaleDateString()]);
    }
    console.log(table.toString());
  } catch (error) {
    console.error(chalk.red(`✗ ${getApiErrorMessage(error)}`));
    process.exitCode = 1;
  }
}

export async function createProjectCommand(
  title: string,
  options: { description?: string }
): Promise<void> {
  if (!requireAuth()) return;

  try {
    const client = createApiClient();
    const { data } = await client.post<Project>('/projects', {
      title,
      description: options.description,
    });
    console.log(chalk.green(`✓ Created project "${data.title}"`), chalk.dim(data.id));
  } catch (error) {
    console.error(chalk.red(`✗ ${getApiErrorMessage(error)}`));
    process.exitCode = 1;
  }
}

export async function deleteProjectCommand(id: string, options: { yes?: boolean }): Promise<void> {
  if (!requireAuth()) return;

  if (!options.yes) {
    const answer = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: `Delete project ${id}? This cannot be undone.`,
      initial: false,
    });
    if (!answer.confirmed) {
      console.log(chalk.yellow('Cancelled.'));
      return;
    }
  }

  try {
    const client = createApiClient();
    await client.delete(`/projects/${id}`);
    console.log(chalk.green(`✓ Deleted project ${id}`));
  } catch (error) {
    console.error(chalk.red(`✗ ${getApiErrorMessage(error)}`));
    process.exitCode = 1;
  }
}
