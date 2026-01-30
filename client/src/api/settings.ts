import { apiRequest } from './client';

export type LLMProviderType = 'openai' | 'ollama';

export interface UserSettings {
  hasOpenaiApiKey: boolean;
  openaiApiKeyLastChars?: string;
  llmProvider: LLMProviderType;
  ollamaBaseUrl: string;
  ollamaTextModel: string;
  ollamaVisionModel: string;
  openaiTextModel: string;
  openaiVisionModel: string;
}

export interface LLMProviderSettings {
  llmProvider?: LLMProviderType;
  ollamaBaseUrl?: string;
  ollamaTextModel?: string;
  ollamaVisionModel?: string;
  openaiTextModel?: string;
  openaiVisionModel?: string;
}

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export async function getSettings(): Promise<UserSettings> {
  return apiRequest<UserSettings>('/settings');
}

export async function setOpenaiApiKey(
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    '/settings/openai-api-key',
    {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    }
  );
}

export async function deleteOpenaiApiKey(): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/settings/openai-api-key', {
    method: 'DELETE',
  });
}

export async function updateLLMProviderSettings(
  settings: LLMProviderSettings
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/settings/llm-provider', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function getOllamaModels(): Promise<{ models: OllamaModel[] }> {
  return apiRequest<{ models: OllamaModel[] }>('/settings/ollama/models');
}

export async function testOllamaConnection(
  baseUrl?: string
): Promise<{ success: boolean; models?: string[]; error?: string }> {
  return apiRequest<{ success: boolean; models?: string[]; error?: string }>(
    '/settings/ollama/test',
    {
      method: 'POST',
      body: JSON.stringify({ baseUrl }),
    }
  );
}
