import type { GenerationType } from '@/types';
import {
  ASPECT_RATIOS,
  STYLES,
  VIDEO_RATIOS,
  VIDEO_DURATIONS,
  MODEL_TOPOLOGIES,
  VOICES,
} from './generationOptions';

// The assistant labels each ready-to-use prompt's code fence with the
// generator it's for plus suggested settings, e.g.
//   ```image style=cinematic aspectRatio=16:9 negativePrompt="text, watermark"
// "Use this prompt" turns that into a link to the project page, which reads
// the same values back from the query string to prefill its form.

const TYPE_ALIASES: Record<string, GenerationType> = {
  image: 'image',
  video: 'video',
  '3d': '3d',
  model: '3d',
  audio: 'audio',
  speech: 'audio',
  voice: 'audio',
};

export interface FenceInfo {
  type: GenerationType | null;
  options: Record<string, string>;
}

export function parseFenceInfo(info: string): FenceInfo {
  const [first = '', ...rest] = info.trim().split(/\s+/);
  const type = TYPE_ALIASES[first.toLowerCase()] ?? null;
  const options: Record<string, string> = {};
  const pairs = /(\w+)=(?:"([^"]*)"|(\S+))/g;
  let match: RegExpExecArray | null;
  const remainder = rest.join(' ');
  while ((match = pairs.exec(remainder)) !== null) {
    options[match[1]] = match[2] ?? match[3];
  }
  return { type, options };
}

export function buildPromptHandoffUrl(
  projectId: string,
  type: GenerationType,
  prompt: string,
  options: Record<string, string> = {}
): string {
  const params = new URLSearchParams({ use: type, prompt });
  for (const [key, value] of Object.entries(options)) {
    // A fence setting named `use` or `prompt` must not replace the real ones.
    if (!params.has(key)) params.set(key, value);
  }
  return `/dashboard/projects/${encodeURIComponent(projectId)}?${params.toString()}`;
}

export interface PromptHandoff {
  type: GenerationType;
  prompt: string;
  style?: string;
  aspectRatio?: string;
  negativePrompt?: string;
  videoRatio?: string;
  videoDuration?: number;
  topology?: 'triangle' | 'quad';
  enablePbr?: boolean;
  voiceId?: string;
}

function pick(list: string[], value: string | null): string | undefined {
  if (!value) return undefined;
  return list.find((item) => item.toLowerCase() === value.toLowerCase());
}

/**
 * Reads a handoff from the project page's query string. Settings outside
 * the form's own option lists are dropped, so the form falls back to its
 * defaults for them rather than submitting a value the UI can't show.
 */
export function readPromptHandoff(params: URLSearchParams): PromptHandoff | null {
  const type = TYPE_ALIASES[(params.get('use') ?? '').toLowerCase()];
  const prompt = params.get('prompt')?.trim();
  if (!type || !prompt) return null;

  const handoff: PromptHandoff = { type, prompt };

  if (type === 'image') {
    handoff.style = pick(STYLES, params.get('style'));
    handoff.aspectRatio = pick(ASPECT_RATIOS, params.get('aspectRatio'));
    handoff.negativePrompt = params.get('negativePrompt')?.trim() || undefined;
  } else if (type === 'video') {
    handoff.videoRatio = pick(VIDEO_RATIOS, params.get('ratio'));
    const duration = Number(params.get('duration'));
    handoff.videoDuration = VIDEO_DURATIONS.includes(duration) ? duration : undefined;
  } else if (type === '3d') {
    handoff.topology = pick(MODEL_TOPOLOGIES, params.get('topology')) as 'triangle' | 'quad' | undefined;
    const pbr = params.get('pbr');
    handoff.enablePbr = pbr === 'true' ? true : pbr === 'false' ? false : undefined;
  } else {
    const voice = params.get('voice');
    handoff.voiceId = VOICES.find(
      (v) => voice && (v.name.toLowerCase() === voice.toLowerCase() || v.id === voice)
    )?.id;
  }

  return handoff;
}
