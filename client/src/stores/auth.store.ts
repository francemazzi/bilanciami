import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setUser: (user: User) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      setAuth: (user, accessToken) =>
        set({
          user,
          accessToken,
          isAuthenticated: true,
          isLoading: false,
        }),
      setUser: (user) =>
        set({ user }),
      setAccessToken: (accessToken) =>
        set({ accessToken }),
      logout: () => {
        useSettingsStore.getState().clearSettings();
        useLicenseStore.getState().clearLicense();
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
      setLoading: (isLoading) =>
        set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      // SECURITY: Only persist user info, NOT the accessToken
      // accessToken is kept only in memory and refreshed via httpOnly cookie
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // accessToken is intentionally NOT persisted for security
      }),
    }
  )
);
