import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LicenseTier, LicenseInfo } from '../api/settings';

interface LicenseState {
  licenseTier: LicenseTier;
  pdfLimit: number;
  pdfCount: number;
  remainingPdfs: number;
  isLimitReached: boolean;
  licenseExpiresAt: string | null;
  isLicenseActive: boolean;
  isLoading: boolean;
  setLicenseInfo: (info: Partial<LicenseInfo>) => void;
  decrementRemaining: (count: number) => void;
  setLoading: (isLoading: boolean) => void;
  clearLicense: () => void;
}

const DEFAULT_LICENSE: Omit<LicenseState, 'isLoading' | 'setLicenseInfo' | 'decrementRemaining' | 'setLoading' | 'clearLicense'> = {
  licenseTier: 'free',
  pdfLimit: 20,
  pdfCount: 0,
  remainingPdfs: 20,
  isLimitReached: false,
  licenseExpiresAt: null,
  isLicenseActive: false,
};

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set) => ({
      ...DEFAULT_LICENSE,
      isLoading: true,
      setLicenseInfo: (info) =>
        set((state) => ({
          ...state,
          licenseTier: info.licenseTier ?? state.licenseTier,
          pdfLimit: info.pdfLimit ?? state.pdfLimit,
          pdfCount: info.pdfCount ?? state.pdfCount,
          remainingPdfs: info.remainingPdfs ?? state.remainingPdfs,
          isLimitReached: info.isLimitReached ?? state.isLimitReached,
          licenseExpiresAt: info.licenseExpiresAt ?? state.licenseExpiresAt,
          isLicenseActive: info.isLicenseActive ?? state.isLicenseActive,
          isLoading: false,
        })),
      decrementRemaining: (count) =>
        set((state) => {
          // -1 means unlimited
          if (state.remainingPdfs === -1) return state;
          const newRemaining = Math.max(0, state.remainingPdfs - count);
          return {
            ...state,
            pdfCount: state.pdfCount + count,
            remainingPdfs: newRemaining,
            isLimitReached: newRemaining <= 0,
          };
        }),
      setLoading: (isLoading) => set({ isLoading }),
      clearLicense: () =>
        set({
          ...DEFAULT_LICENSE,
          isLoading: false,
        }),
    }),
    {
      name: 'license-storage',
      partialize: (state) => ({
        licenseTier: state.licenseTier,
        pdfLimit: state.pdfLimit,
        pdfCount: state.pdfCount,
        remainingPdfs: state.remainingPdfs,
        isLimitReached: state.isLimitReached,
      }),
    }
  )
);
