#!/usr/bin/env node
import { Command } from 'commander';
import { loginCommand } from './commands/login';
import { logoutCommand } from './commands/logout';
import { whoamiCommand } from './commands/whoami';
import { listProjectsCommand, createProjectCommand, deleteProjectCommand } from './commands/projects';
import {
  generateImageCommand,
  generateVideoCommand,
  generateModelCommand,
  generateAudioCommand,
} from './commands/generate';
import { listGenerationsCommand, statusCommand, watchCommand } from './commands/generations';
import { setApiUrlCommand, showConfigCommand } from './commands/config';

const program = new Command();

program
  .name('lumina')
  .description('Command-line interface for the LUMINA AI creative platform')
  .version('0.1.0');

program.command('login').description('Log in to your LUMINA account').action(loginCommand);
program.command('logout').description('Log out and clear saved credentials').action(logoutCommand);
program.command('whoami').description('Show the currently logged-in user').action(whoamiCommand);

// --- projects ---
const projects = program.command('projects').description('Manage projects');

projects.command('list').description('List your projects').action(listProjectsCommand);

projects
  .command('create <title>')
  .description('Create a new project')
  .option('-d, --description <description>', 'Project description')
  .action(createProjectCommand);

projects
  .command('delete <id>')
  .description('Delete a project')
  .option('-y, --yes', 'Skip the confirmation prompt')
  .action(deleteProjectCommand);

// --- generate ---
const generate = program.command('generate').description('Generate content');

generate
  .command('image <prompt>')
  .description('Generate an image (Stability AI)')
  .requiredOption('-p, --project <projectId>', 'Project ID')
  .option('--style <style>', 'Image style, e.g. photorealistic')
  .option('--aspect-ratio <ratio>', 'Aspect ratio, e.g. 16:9')
  .option('--negative-prompt <text>', 'What to avoid in the image')
  .option('--samples <n>', 'Number of samples (1-4)')
  .option('--steps <n>', 'Diffusion steps (10-150)')
  .option('--scale <n>', 'CFG scale (0-35)')
  .option('--seed <n>', 'Seed')
  .option('--no-watch', "Queue it and exit immediately, don't wait for the result")
  .option('-o, --output <path>', 'Save the output to this file')
  .action(generateImageCommand);

generate
  .command('video <prompt>')
  .description('Generate a video (Runway) — text-to-video, or image-to-video with --source-image')
  .requiredOption('-p, --project <projectId>', 'Project ID')
  .option('--ratio <ratio>', 'e.g. 1280:720')
  .option('--duration <seconds>', 'Duration in seconds (1-10)')
  .option('--source-image <url>', 'Source image URL for image-to-video (omit for text-to-video)')
  .option('--no-watch', "Queue it and exit immediately, don't wait for the result")
  .option('-o, --output <path>', 'Save the output to this file')
  .action(generateVideoCommand);

generate
  .command('model <prompt>')
  .description('Generate a 3D model (Meshy) — a two-stage pipeline that can take several minutes')
  .requiredOption('-p, --project <projectId>', 'Project ID')
  .option('--topology <type>', 'triangle or quad')
  .option('--polycount <n>', 'Target polygon count (100-300000)')
  .option('--pbr', 'Enable PBR texture maps')
  .option('--texture-resolution <res>', '2k, 4k, or 8k')
  .option('--no-watch', "Queue it and exit immediately, don't wait for the result")
  .option('-o, --output <path>', 'Save the output to this file (note: 3D output is a hosted URL, not embedded data)')
  .action(generateModelCommand);

generate
  .command('audio <text>')
  .description('Generate speech audio (Eleven Labs)')
  .requiredOption('-p, --project <projectId>', 'Project ID')
  .option('--voice-id <id>', 'Eleven Labs voice ID')
  .option('--model-id <id>', 'Eleven Labs model ID')
  .option('--no-watch', "Queue it and exit immediately, don't wait for the result")
  .option('-o, --output <path>', 'Save the output to this file')
  .action(generateAudioCommand);

// --- generations ---
const generations = program.command('generations').description('View past generations');

generations
  .command('list')
  .description('List generations for a project')
  .requiredOption('-p, --project <projectId>', 'Project ID')
  .action(listGenerationsCommand);

generations.command('status <id>').description("Show a generation's current status").action(statusCommand);

generations.command('watch <id>').description('Wait for a generation to complete').action(watchCommand);

// --- config ---
const config = program.command('config').description('CLI configuration');

config
  .command('set-api-url <url>')
  .description('Point the CLI at a different backend (default: http://localhost:5000)')
  .action(setApiUrlCommand);

config.command('show').description('Show the current CLI configuration').action(showConfigCommand);

program.parse();
