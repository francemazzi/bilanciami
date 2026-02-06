import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PdfDropzone } from '@/components/upload/PdfDropzone';
import { uploadPdfs } from '@/api/invoices';
import { getSettings } from '@/api/settings';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { AlertCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExtractionResponse } from '@/api/types';

export function UploadPage() {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const { hasOpenaiApiKey, setSettings, setLoading } = useSettingsStore();

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    setIsCheckingKey(true);
    setLoading(true);
    try {
      const settings = await getSettings();
      setSettings(settings);
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

    setIsUploading(true);
    try {
      const data: ExtractionResponse = await uploadPdfs(files);

      if (data.successful > 0) {
        toast.success(
          `${data.successful} fattur${data.successful === 1 ? 'a estratta' : 'e estratte'} con successo`
        );
      }
      if (data.failed > 0) {
        toast.error(
          `${data.failed} fattur${data.failed === 1 ? 'a' : 'e'} non ${data.failed === 1 ? 'estratta' : 'estratte'}`
        );
      }

      // Navigate to results with the extraction data
      navigate('/results', { state: { results: data } });
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
        disabled={!hasOpenaiApiKey}
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
