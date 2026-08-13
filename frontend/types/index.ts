export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export type GenerationType = 'image' | 'video' | '3d' | 'audio';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Generation {
  id: string;
  type: GenerationType;
  prompt: string;
  status: GenerationStatus;
  outputUrl: string | null;
  metadata: Record<string, unknown> | null;
  error: string | null;
  projectId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
