import axios, { AxiosError } from 'axios';
import type { AuthResponse, Project, Generation, ApiError } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the auth token to every request if we have one
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('lumina_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// If the token is invalid/expired, clear it so the UI can redirect to login
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('lumina_token');
      localStorage.removeItem('lumina_user');
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;
    return data?.error || error.message || 'Something went wrong';
  }
  return 'Something went wrong';
}

// ---- Auth ----

export async function registerRequest(email: string, name: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/register', { email, name, password });
  return data;
}

export async function loginRequest(email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function forgotPasswordRequest(email: string) {
  const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email });
  return data;
}

export async function resetPasswordRequest(token: string, password: string) {
  const { data } = await api.post<{ message: string }>('/auth/reset-password', { token, password });
  return data;
}

// ---- Projects ----

export async function listProjects() {
  const { data } = await api.get<{ projects: Project[] }>('/projects');
  return data.projects;
}

export async function getProjectById(id: string) {
  const { data } = await api.get<Project>(`/projects/${id}`);
  return data;
}

export async function createProject(title: string, description?: string) {
  const { data } = await api.post<Project>('/projects', { title, description });
  return data;
}

export async function deleteProject(id: string) {
  await api.delete(`/projects/${id}`);
}

// ---- Generations ----

export async function generateImage(params: {
  prompt: string;
  projectId: string;
  style?: string;
  aspectRatio?: string;
  negativePrompt?: string;
}) {
  const { data } = await api.post<Generation>('/generations/image', params);
  return data;
}

export async function generateVideo(params: {
  prompt: string;
  projectId: string;
  ratio?: string;
  duration?: number;
  sourceImageUrl?: string;
}) {
  const { data } = await api.post<Generation>('/generations/video', params);
  return data;
}

export async function generateModel(params: {
  prompt: string;
  projectId: string;
  topology?: 'triangle' | 'quad';
  targetPolycount?: number;
  enablePbr?: boolean;
  textureResolution?: '2k' | '4k' | '8k';
}) {
  const { data } = await api.post<Generation>('/generations/model', params);
  return data;
}

export async function generateAudio(params: {
  prompt: string;
  projectId: string;
  voiceId?: string;
  modelId?: string;
}) {
  const { data } = await api.post<Generation>('/generations/audio', params);
  return data;
}

export async function getGenerationStatus(id: string) {
  const { data } = await api.get<Generation>(`/generations/${id}`);
  return data;
}

export async function listGenerationsByProject(projectId: string) {
  const { data } = await api.get<{ generations: Generation[] }>(`/generations/project/${projectId}`);
  return data.generations;
}
