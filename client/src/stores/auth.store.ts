import { create } from 'zustand';
import { useSettingsStore } from './settings.store';
import { useLicenseStore } from './license.store';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  (set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    setAuth: (user) =>
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      }),
    setUser: (user) =>
      set({ user }),
    logout: () => {
      useSettingsStore.getState().clearSettings();
      useLicenseStore.getState().clearLicense();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    },
    setLoading: (isLoading) =>
      set({ isLoading }),
  })
);
