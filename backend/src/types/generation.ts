export type GenerationType = 'image' | 'video' | '3d' | 'audio';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GenerateImageRequest {
  prompt: string;
  projectId: string;
  style?: string;
  aspectRatio?: string;
  negativePrompt?: string;
  samples?: number;
  steps?: number;
  scale?: number;
  seed?: number;
}

export interface GenerateVideoRequest {
  prompt: string;
  projectId: string;
  ratio?: string; // e.g. '1280:720'
  duration?: number; // seconds, model-dependent (typically 5 or 10)
  sourceImageUrl?: string; // optional image-to-video input; omit for text-to-video
}

export interface GenerateModelRequest {
  prompt: string;
  projectId: string;
  topology?: 'triangle' | 'quad';
  targetPolycount?: number;
  enablePbr?: boolean;
  textureResolution?: '2k' | '4k' | '8k';
}

export interface GenerateAudioRequest {
  prompt: string; // text to speak
  projectId: string;
  voiceId?: string;
  modelId?: string;
}

export interface GenerationResponse {
  id: string;
  type: GenerationType;
  prompt: string;
  status: GenerationStatus;
  outputUrl: string | null;
  metadata: Record<string, unknown> | null;
  error: string | null;
  projectId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
