import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExtractionResponse, JobProgress, JobStatusResponse } from '@/api/types';

export type JobStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

interface ExtractionState {
  jobId: string | null;
  fileNames: string[];
  fileCount: number;
  status: JobStatus;
  progress?: JobProgress;
  result?: ExtractionResponse;
  error?: string;
  startedAt: number | null;
  toastShown: boolean;
  startJob: (jobId: string, fileNames: string[], fileCount: number) => void;
  applyStatus: (status: JobStatusResponse) => void;
  fail: (error: string) => void;
  markToastShown: () => void;
  clearJob: () => void;
}

const INITIAL: Pick<
  ExtractionState,
  'jobId' | 'fileNames' | 'fileCount' | 'status' | 'progress' | 'result' | 'error' | 'startedAt' | 'toastShown'
> = {
  jobId: null,
  fileNames: [],
  fileCount: 0,
  status: 'idle',
  progress: undefined,
  result: undefined,
  error: undefined,
  startedAt: null,
  toastShown: false,
};

export const useExtractionStore = create<ExtractionState>()(
  persist(
    (set) => ({
      ...INITIAL,
      startJob: (jobId, fileNames, fileCount) =>
        set({
          ...INITIAL,
          jobId,
          fileNames,
          fileCount,
          status: 'pending',
          startedAt: Date.now(),
        }),
      applyStatus: (status) =>
        set((state) => ({
          status: status.status,
          progress: status.progress ?? state.progress,
          result: status.result ?? state.result,
          error: status.error ?? state.error,
        })),
      fail: (error) => set({ status: 'failed', error }),
      markToastShown: () => set({ toastShown: true }),
      clearJob: () => set(INITIAL),
    }),
    {
      name: 'bilanciami-extraction-job',
      partialize: (state) => ({
        jobId: state.jobId,
        fileNames: state.fileNames,
        fileCount: state.fileCount,
        status: state.status,
        progress: state.progress,
        result: state.result,
        error: state.error,
        startedAt: state.startedAt,
        toastShown: state.toastShown,
      }),
    }
  )
);
