import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LLMProviderType, UserSettings } from '../api/settings';

interface SettingsState {
  hasOpenaiApiKey: boolean;
  openaiApiKeyLastChars: string | null;
  llmProvider: LLMProviderType;
  ollamaBaseUrl: string;
  ollamaTextModel: string;
  ollamaVisionModel: string;
  openaiTextModel: string;
  openaiVisionModel: string;
  isLoading: boolean;
  setSettings: (settings: Partial<UserSettings>) => void;
  setLoading: (isLoading: boolean) => void;
  clearSettings: () => void;
}

const DEFAULT_SETTINGS: Omit<SettingsState, 'isLoading' | 'setSettings' | 'setLoading' | 'clearSettings'> = {
  hasOpenaiApiKey: false,
  openaiApiKeyLastChars: null,
  llmProvider: 'openai',
  ollamaBaseUrl: 'http://ollama:11434',
  ollamaTextModel: 'llama3.2:3b',
  ollamaVisionModel: 'llava:7b-v1.6-mistral-q4_K_M',
  openaiTextModel: 'gpt-4o',
  openaiVisionModel: 'gpt-4o',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      isLoading: true,
      setSettings: (settings) =>
        set((state) => ({
          ...state,
          hasOpenaiApiKey: settings.hasOpenaiApiKey ?? state.hasOpenaiApiKey,
          openaiApiKeyLastChars: settings.openaiApiKeyLastChars ?? state.openaiApiKeyLastChars,
          llmProvider: settings.llmProvider ?? state.llmProvider,
          ollamaBaseUrl: settings.ollamaBaseUrl ?? state.ollamaBaseUrl,
          ollamaTextModel: settings.ollamaTextModel ?? state.ollamaTextModel,
          ollamaVisionModel: settings.ollamaVisionModel ?? state.ollamaVisionModel,
          openaiTextModel: settings.openaiTextModel ?? state.openaiTextModel,
          openaiVisionModel: settings.openaiVisionModel ?? state.openaiVisionModel,
          isLoading: false,
        })),
      setLoading: (isLoading) => set({ isLoading }),
      clearSettings: () =>
        set({
          ...DEFAULT_SETTINGS,
          isLoading: false,
        }),
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        hasOpenaiApiKey: state.hasOpenaiApiKey,
        openaiApiKeyLastChars: state.openaiApiKeyLastChars,
        llmProvider: state.llmProvider,
      }),
    }
  )
);
