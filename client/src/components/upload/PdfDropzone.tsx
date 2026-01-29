import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/formatters';

interface PdfDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
  disabled?: boolean;
}

export function PdfDropzone({ onFilesSelected, isUploading, disabled = false }: PdfDropzoneProps) {
  const isDisabled = isUploading || disabled;
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(
      (f) => f.type === 'application/pdf'
    );
    setFiles((prev) => [...prev, ...pdfFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    maxFiles: 10,
    disabled: isDisabled,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const clearFiles = () => {
    setFiles([]);
  };

  return (
    <div className="space-y-4">
      <Card
        {...getRootProps()}
        className={cn(
          'p-12 border-2 border-dashed cursor-pointer transition-colors',
          isDragActive && 'border-primary bg-primary/5',
          !isDragActive && 'border-muted-foreground/25 hover:border-primary',
          isDisabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center">
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">
            {isDragActive ? 'Rilascia i file PDF qui' : 'Trascina i PDF qui'}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            oppure clicca per selezionare (max 10 file, 50MB ciascuno)
          </p>
        </div>
      </Card>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {files.length} file selezionati
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFiles}
              disabled={isDisabled}
            >
              Rimuovi tutti
            </Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  disabled={isDisabled}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            onClick={handleUpload}
            disabled={isDisabled || files.length === 0}
            className="w-full mt-4"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Estrazione in corso...
              </>
            ) : (
              `Estrai ${files.length} fattur${files.length === 1 ? 'a' : 'e'}`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
