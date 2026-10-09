import axios, { AxiosError } from 'axios';
import type {
  AuthResponse,
  Project,
  Generation,
  ApiError,
  Conversation,
  ConversationWithMessages,
  ChatMessage,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getStoredToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('lumina_token') : null;
}

// Called on a 401: the token is invalid/expired, so clear it and let the UI
// redirect to login.
function clearStoredAuth() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('lumina_token');
    localStorage.removeItem('lumina_user');
  }
}

// Attach the auth token to every request if we have one
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) clearStoredAuth();
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

// ---- Lumina Assistant (chat) ----

export async function listConversations() {
  const { data } = await api.get<{ conversations: Conversation[] }>('/chat/conversations');
  return data.conversations;
}

export async function getConversation(id: string) {
  const { data } = await api.get<ConversationWithMessages>(`/chat/conversations/${id}`);
  return data;
}

export async function createConversation(projectId?: string) {
  const { data } = await api.post<Conversation>('/chat/conversations', projectId ? { projectId } : {});
  return data;
}

export async function deleteConversation(id: string) {
  await api.delete(`/chat/conversations/${id}`);
}

export interface ChatReply {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  title: string;
}

export class ChatStreamError extends Error {}

/**
 * Sends a message and streams the reply. The endpoint answers with
 * Server-Sent Events over a POST, which EventSource can't do (and axios
 * can't stream in the browser), so this reads the body with fetch.
 */
export async function sendChatMessage(
  conversationId: string,
  message: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal
): Promise<ChatReply> {
  const token = getStoredToken();
  const response = await fetch(`${API_URL}/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!response.ok || !response.body) {
    if (response.status === 401) clearStoredAuth();
    const data = (await response.json().catch(() => null)) as ApiError | null;
    throw new ChatStreamError(data?.error || 'Something went wrong');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let event = 'message';
      let data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (!data) continue;
      const payload = JSON.parse(data);

      if (event === 'delta') onDelta(payload.text);
      else if (event === 'done') return payload as ChatReply;
      else if (event === 'error') throw new ChatStreamError(payload.error || 'Something went wrong');
    }
  }

  throw new ChatStreamError('The connection closed before the reply finished. Please try again.');
}
