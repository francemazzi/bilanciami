import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useExtractionStore } from '@/stores/extraction.store';

export function ExtractionProgress() {
  const { fileNames, fileCount, status, progress, result } = useExtractionStore();
  const clearJob = useExtractionStore((s) => s.clearJob);

  const isCompleted = status === 'completed';
  const currentIndex = isCompleted ? fileCount : progress?.current ?? 0;
  const totalFiles = progress?.total || fileCount;
  const progressPercent =
    totalFiles > 0 ? Math.round((currentIndex / totalFiles) * 100) : 0;
  const currentFileName = !isCompleted
    ? progress?.currentFile || fileNames[currentIndex] || ''
    : '';

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          )}
          <span className="font-medium">
            {currentIndex}/{totalFiles} file elaborati
          </span>
        </div>
        {isCompleted && (
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link to="/results">Vedi risultati</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={clearJob}>
              Chiudi
            </Button>
          </div>
        )}
      </div>

      <div className="w-full bg-muted rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${
            isCompleted ? 'bg-green-600' : 'bg-blue-600'
          }`}
          style={{ width: `${Math.max(progressPercent, 5)}%` }}
        />
      </div>

      {currentFileName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>Elaborazione: {currentFileName}</span>
        </div>
      )}

      {fileNames.length > 0 && (
        <div className="space-y-2 mt-4">
          {fileNames.map((name, index) => {
            const isDone = isCompleted || index < currentIndex;
            const isCurrent = !isCompleted && index === currentIndex;
            return (
              <div
                key={index}
                className={`flex items-center gap-2 text-sm p-2 rounded ${
                  isDone
                    ? 'text-green-700 bg-green-50'
                    : isCurrent
                    ? 'text-blue-700 bg-blue-50 font-medium'
                    : 'text-muted-foreground'
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

      {result && isCompleted && (
        <div className="text-sm text-muted-foreground border-t pt-3">
          {result.successful} riusciti
          {result.failed > 0 && `, ${result.failed} falliti`}
        </div>
      )}
    </Card>
  );
}
