import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { InvoiceCard } from '@/components/invoice/InvoiceCard';
import { ArrowLeft, Upload, CheckCircle2, XCircle, Loader2, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getJobStatus } from '@/api/invoices';
import type { ExtractionResponse, JobStatusResponse } from '@/api/types';

const POLL_INTERVAL = 3000;

interface LocationState {
  jobId?: string;
  fileNames?: string[];
  fileCount?: number;
  // Legacy: direct results (for backwards compat)
  results?: ExtractionResponse;
}

export function ExtractionResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | undefined;

  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastShownRef = useRef(false);

  const jobId = state?.jobId;
  const fileNames = state?.fileNames || [];
  const fileCount = state?.fileCount || fileNames.length;

  // Legacy support: if results were passed directly
  const legacyResults = state?.results;

  useEffect(() => {
    if (!jobId && !legacyResults) return;
    if (legacyResults) return; // No polling needed for legacy

    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const status = await getJobStatus(jobId!);
        if (cancelled) return;
        setJobStatus(status);

        if (status.status === 'completed') {
          if (!toastShownRef.current && status.result) {
            toastShownRef.current = true;
            const { successful, failed } = status.result;
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
          return; // Stop polling
        }

        if (status.status === 'failed') {
          if (!toastShownRef.current) {
            toastShownRef.current = true;
            toast.error(status.error || 'Errore durante l\'estrazione');
          }
          return; // Stop polling
        }

        // Continue polling
        pollingRef.current = setTimeout(poll, POLL_INTERVAL);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Errore di connessione';
        setError(message);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [jobId, legacyResults]);

  // No state at all
  if (!jobId && !legacyResults) {
    return (
      <div className="container py-4 md:py-8 px-4 text-center">
        <h1 className="text-xl md:text-2xl font-bold mb-4">Nessun risultato</h1>
        <p className="text-muted-foreground mb-6">
          Non ci sono risultati di estrazione da mostrare.
        </p>
        <Button asChild>
          <Link to="/upload">
            <Upload className="mr-2 h-4 w-4" />
            Carica fatture
          </Link>
        </Button>
      </div>
    );
  }

  // Get results from either source
  const results = legacyResults || (jobStatus?.status === 'completed' ? jobStatus.result : undefined);
  const isProcessing = !legacyResults && jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed';
  const isFailed = !legacyResults && jobStatus?.status === 'failed';
  const progress = jobStatus?.progress;

  // Processing state
  if (isProcessing && !error) {
    const currentFileIndex = progress?.current ?? 0;
    const totalFiles = progress?.total || fileCount;
    const progressPercent = totalFiles > 0 ? Math.round((currentFileIndex / totalFiles) * 100) : 0;
    const currentFileName = progress?.currentFile || fileNames[currentFileIndex] || '';

    return (
      <div className="container max-w-2xl py-4 md:py-8 px-4">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold mb-2">Estrazione in corso</h1>
          <p className="text-sm text-muted-foreground">
            Elaborazione delle fatture. Questa operazione potrebbe richiedere qualche minuto.
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="font-medium">
              {currentFileIndex}/{totalFiles} file elaborati
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(progressPercent, 5)}%` }}
            />
          </div>

          {/* Current file */}
          {currentFileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Elaborazione: {currentFileName}</span>
            </div>
          )}

          {/* File list */}
          {fileNames.length > 0 && (
            <div className="space-y-2 mt-4">
              {fileNames.map((name, index) => {
                const isDone = index < currentFileIndex;
                const isCurrent = index === currentFileIndex;
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-2 text-sm p-2 rounded ${
                      isDone ? 'text-green-700 bg-green-50' :
                      isCurrent ? 'text-blue-700 bg-blue-50 font-medium' :
                      'text-muted-foreground'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600 flex-shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="truncate">{name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Error state
  if (isFailed || error) {
    return (
      <div className="container max-w-2xl py-4 md:py-8 px-4">
        <Card className="p-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold">Estrazione fallita</h2>
          <p className="text-sm text-muted-foreground">
            {jobStatus?.error || error || 'Si e verificato un errore durante l\'estrazione.'}
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" asChild>
              <Link to="/upload">
                <Upload className="mr-2 h-4 w-4" />
                Riprova
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Results state
  if (!results) return null;

  return (
    <div className="container py-4 md:py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Risultati Estrazione</h1>
            <p className="text-sm text-muted-foreground">
              {results.total_processed} file processati
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-10 sm:ml-0">
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {results.successful} riusciti
          </Badge>
          {results.failed > 0 && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              {results.failed} falliti
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {results.results.map((result, index) => (
          <InvoiceCard key={index} result={result} />
        ))}
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <Button variant="outline" asChild>
          <Link to="/upload">
            <Upload className="mr-2 h-4 w-4" />
            Carica altre fatture
          </Link>
        </Button>
      </div>
    </div>
  );
}
