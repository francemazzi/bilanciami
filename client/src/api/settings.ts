import { apiRequest } from './client';

export interface UserSettings {
  hasOpenaiApiKey: boolean;
  openaiApiKeyLastChars?: string;
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
