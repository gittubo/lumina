import axios, { AxiosInstance } from 'axios';
import { loadConfig } from './config';

export function createApiClient(): AxiosInstance {
  const config = loadConfig();
  return axios.create({
    baseURL: `${config.apiUrl}/api`,
    headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
  });
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    return data?.error || error.message || 'Something went wrong';
  }
  return 'Something went wrong';
}
