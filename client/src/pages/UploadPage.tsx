import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PdfDropzone } from '@/components/upload/PdfDropzone';
import { uploadPdfs } from '@/api/invoices';
import { toast } from 'sonner';
import type { ExtractionResponse } from '@/api/types';

export function UploadPage() {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (files: File[]) => {
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

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Carica Fatture</h1>
        <p className="text-muted-foreground">
          Carica uno o piu file PDF per estrarre automaticamente i dati delle fatture.
          L'estrazione puo richiedere alcuni secondi per ogni file.
        </p>
      </div>

      <PdfDropzone onFilesSelected={handleUpload} isUploading={isUploading} />

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
