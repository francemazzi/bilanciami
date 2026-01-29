import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  hasOpenaiApiKey: boolean;
  openaiApiKeyLastChars: string | null;
  isLoading: boolean;
  setSettings: (hasKey: boolean, lastChars?: string) => void;
  setLoading: (isLoading: boolean) => void;
  clearSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hasOpenaiApiKey: false,
      openaiApiKeyLastChars: null,
      isLoading: true,
      setSettings: (hasKey, lastChars) =>
        set({
          hasOpenaiApiKey: hasKey,
          openaiApiKeyLastChars: lastChars || null,
          isLoading: false,
        }),
      setLoading: (isLoading) => set({ isLoading }),
      clearSettings: () =>
        set({
          hasOpenaiApiKey: false,
          openaiApiKeyLastChars: null,
          isLoading: false,
        }),
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        hasOpenaiApiKey: state.hasOpenaiApiKey,
        openaiApiKeyLastChars: state.openaiApiKeyLastChars,
      }),
    }
  )
);
