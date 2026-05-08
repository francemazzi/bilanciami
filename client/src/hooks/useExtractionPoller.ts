import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getJobStatus } from '@/api/invoices';
import { useExtractionStore } from '@/stores/extraction.store';

const POLL_INTERVAL = 3000;

export function useExtractionPoller() {
  const jobId = useExtractionStore((s) => s.jobId);
  const status = useExtractionStore((s) => s.status);
  const toastShown = useExtractionStore((s) => s.toastShown);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) return;
    if (status === 'completed' || status === 'failed') return;

    let cancelled = false;

    async function poll() {
      if (cancelled || !jobId) return;
      try {
        const next = await getJobStatus(jobId);
        if (cancelled) return;
        useExtractionStore.getState().applyStatus(next);

        if (next.status === 'completed' || next.status === 'failed') return;

        timerRef.current = setTimeout(poll, POLL_INTERVAL);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Errore di connessione';
        useExtractionStore.getState().fail(message);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId, status]);

  useEffect(() => {
    if (toastShown) return;
    if (status === 'completed') {
      const result = useExtractionStore.getState().result;
      if (result) {
        const { successful, failed } = result;
        if (successful > 0) {
          toast.success(
            `${successful} fattur${successful === 1 ? 'a estratta' : 'e estratte'} con successo`
          );
        }
        if (failed > 0) {
          toast.error(
            `${failed} fattur${failed === 1 ? 'a' : 'e'} non ${failed === 1 ? 'estratta' : 'estratte'}`
          );
        }
      }
      useExtractionStore.getState().markToastShown();
    } else if (status === 'failed') {
      const error = useExtractionStore.getState().error;
      toast.error(error || 'Errore durante l\'estrazione');
      useExtractionStore.getState().markToastShown();
    }
  }, [status, toastShown]);
}
