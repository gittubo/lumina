import chalk from 'chalk';
import fs from 'fs';
import { createApiClient, getApiErrorMessage } from '../api';
import { requireAuth } from '../auth-guard';
import { pollUntilDone, GenerationResult } from '../poll';

interface CommonGenerateOptions {
  project: string;
  watch?: boolean; // commander: --no-watch sets this to false; defaults true
  output?: string;
}

function saveOutput(generation: GenerationResult, outputPath: string): void {
  if (!generation.outputUrl) {
    console.log(chalk.yellow('No output to save.'));
    return;
  }

  if (generation.outputUrl.startsWith('data:')) {
    // Images and audio come back as base64 data URIs — decode and write directly.
    const base64 = generation.outputUrl.split(',')[1];
    fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'));
    console.log(chalk.green(`✓ Saved to ${outputPath}`));
  } else {
    // Video and 3D outputs are hosted URLs (Runway/Meshy), not embedded data.
    console.log(chalk.yellow('Output is a hosted URL, not embedded data — download it directly:'));
    console.log(generation.outputUrl);
  }
}

async function runGenerate(
  endpoint: 'image' | 'video' | 'model' | 'audio',
  body: Record<string, unknown>,
  options: CommonGenerateOptions
): Promise<void> {
  if (!requireAuth()) return;

  const client = createApiClient();
  try {
    const { data } = await client.post<GenerationResult>(`/generations/${endpoint}`, body);
    console.log(chalk.green('✓ Queued generation'), chalk.dim(data.id));

    if (options.watch === false) {
      console.log(chalk.dim(`Check status with: lumina generations status ${data.id}`));
      return;
    }

    const result = await pollUntilDone(client, data.id);

    if (result.outputUrl && !options.output) {
      console.log(
        chalk.bold('Output:'),
        result.outputUrl.startsWith('data:') ? chalk.dim('(embedded data — use --output to save it)') : result.outputUrl
      );
    }

    if (options.output) {
      saveOutput(result, options.output);
    }
  } catch (error) {
    console.error(chalk.red(`✗ ${getApiErrorMessage(error)}`));
    process.exitCode = 1;
  }
}

interface ImageOptions extends CommonGenerateOptions {
  style?: string;
  aspectRatio?: string;
  negativePrompt?: string;
  samples?: string;
  steps?: string;
  scale?: string;
  seed?: string;
}

export async function generateImageCommand(prompt: string, options: ImageOptions): Promise<void> {
  await runGenerate(
    'image',
    {
      prompt,
      projectId: options.project,
      style: options.style,
      aspectRatio: options.aspectRatio,
      negativePrompt: options.negativePrompt,
      samples: options.samples ? Number(options.samples) : undefined,
      steps: options.steps ? Number(options.steps) : undefined,
      scale: options.scale ? Number(options.scale) : undefined,
      seed: options.seed ? Number(options.seed) : undefined,
    },
    options
  );
}

interface VideoOptions extends CommonGenerateOptions {
  ratio?: string;
  duration?: string;
  sourceImage?: string;
}

export async function generateVideoCommand(prompt: string, options: VideoOptions): Promise<void> {
  await runGenerate(
    'video',
    {
      prompt,
      projectId: options.project,
      ratio: options.ratio,
      duration: options.duration ? Number(options.duration) : undefined,
      sourceImageUrl: options.sourceImage,
    },
    options
  );
}

interface ModelOptions extends CommonGenerateOptions {
  topology?: string;
  polycount?: string;
  pbr?: boolean;
  textureResolution?: string;
}

export async function generateModelCommand(prompt: string, options: ModelOptions): Promise<void> {
  await runGenerate(
    'model',
    {
      prompt,
      projectId: options.project,
      topology: options.topology,
      targetPolycount: options.polycount ? Number(options.polycount) : undefined,
      enablePbr: options.pbr || undefined,
      textureResolution: options.textureResolution,
    },
    options
  );
}

interface AudioOptions extends CommonGenerateOptions {
  voiceId?: string;
  modelId?: string;
}

export async function generateAudioCommand(text: string, options: AudioOptions): Promise<void> {
  await runGenerate(
    'audio',
    {
      prompt: text,
      projectId: options.project,
      voiceId: options.voiceId,
      modelId: options.modelId,
    },
    options
  );
}
