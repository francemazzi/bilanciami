import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PdfDropzone } from '@/components/upload/PdfDropzone';
import { uploadPdfs } from '@/api/invoices';
import { getSettings, getLicenseInfo } from '@/api/settings';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { useLicenseStore } from '@/stores/license.store';
import { AlertCircle, Settings, FileWarning, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UploadPage() {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const { hasOpenaiApiKey, setSettings, setLoading } = useSettingsStore();
  const {
    licenseTier,
    pdfLimit,
    pdfCount,
    remainingPdfs,
    isLimitReached,
    setLicenseInfo,
    decrementRemaining,
  } = useLicenseStore();

  const isFreeUser = licenseTier === 'free';

  useEffect(() => {
    checkApiKeyAndLicense();
  }, []);

  const checkApiKeyAndLicense = async () => {
    setIsCheckingKey(true);
    setLoading(true);
    try {
      const [settings, license] = await Promise.all([
        getSettings(),
        getLicenseInfo(),
      ]);
      setSettings(settings);
      setLicenseInfo(license);
    } catch {
      // Ignore errors, will show warning
    } finally {
      setIsCheckingKey(false);
      setLoading(false);
    }
  };

  const handleUpload = async (files: File[]) => {
    if (!hasOpenaiApiKey) {
      toast.error('Configura la chiave API OpenAI per continuare');
      return;
    }

    // Check client-side limit
    if (isLimitReached) {
      toast.error('Hai raggiunto il limite di PDF. Passa a un piano superiore.');
      return;
    }

    if (remainingPdfs !== -1 && files.length > remainingPdfs) {
      toast.error(`Puoi caricare ancora ${remainingPdfs} PDF. Hai selezionato ${files.length} file.`);
      return;
    }

    setIsUploading(true);
    try {
      const { jobId, fileCount } = await uploadPdfs(files);

      // Optimistically update remaining PDFs count
      decrementRemaining(fileCount);

      // Navigate to results page with jobId for polling
      navigate('/results', {
        state: {
          jobId,
          fileNames: files.map((f) => f.name),
          fileCount,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante l\'upload';
      toast.error(message);
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  if (isCheckingKey) {
    return (
      <div className="container max-w-2xl py-4 md:py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-4 md:py-8 px-4">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Carica Fatture</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Carica uno o piu file PDF per estrarre automaticamente i dati delle fatture.
          L'estrazione puo richiedere alcuni secondi per ogni file.
        </p>
      </div>

      {/* PDF Limit Info Banner */}
      {isFreeUser && !isLimitReached && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <FileWarning className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-800 font-medium">
                Piano gratuito: {pdfCount}/{pdfLimit} PDF utilizzati
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Puoi ancora caricare {remainingPdfs} PDF.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Limit Reached Error */}
      {isLimitReached && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">
                Limite raggiunto
              </p>
              <p className="text-sm text-red-700 mt-1">
                Hai utilizzato tutti i {pdfLimit} PDF disponibili nel piano {licenseTier}.
                Passa a un piano superiore per continuare.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/pricing">
                  <Crown className="h-4 w-4 mr-2" />
                  Passa a Pro
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!hasOpenaiApiKey && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-800 font-medium">
                Chiave API OpenAI non configurata
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Per utilizzare l'estrazione automatica delle fatture, devi prima configurare
                la tua chiave API OpenAI nelle impostazioni.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Vai alle impostazioni
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      <PdfDropzone
        onFilesSelected={handleUpload}
        isUploading={isUploading}
        disabled={!hasOpenaiApiKey || isLimitReached}
        maxFiles={remainingPdfs === -1 ? 10 : Math.min(10, remainingPdfs)}
        remainingPdfs={remainingPdfs}
      />

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">Formati supportati</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>Fatture elettroniche italiane (TD01, TD24, etc.)</li>
          <li>DDT e note di credito</li>
          <li>Fatture pro-forma</li>
          <li>Massimo 10 file per volta, 50MB per file</li>
        </ul>
      </div>
    </div>
  );
}
