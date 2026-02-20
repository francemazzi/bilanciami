import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FileText, Upload, FolderTree, TableIcon, Columns3, Loader2 } from 'lucide-react';
import { FileExplorer } from '@/components/documents/FileExplorer';
import { DocumentsTable } from '@/components/documents/DocumentsTable';
import { KanbanBoard } from '@/components/documents/KanbanBoard';
import { getDocuments, updateDocumentDone, type Document } from '@/api/documents';
import { toast } from 'sonner';

type ViewMode = 'explorer' | 'table' | 'kanban';

const VALID_VIEWS: ViewMode[] = ['explorer', 'table', 'kanban'];

export function DocumentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const viewMode: ViewMode = VALID_VIEWS.includes(viewParam as ViewMode) ? (viewParam as ViewMode) : 'explorer';

  const setViewMode = useCallback((mode: ViewMode) => {
    setSearchParams({ view: mode }, { replace: true });
  }, [setSearchParams]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocuments() {
      try {
        setIsLoading(true);
        const data = await getDocuments();
        setDocuments(data);
      } catch (err) {
        setError('Errore nel caricamento dei documenti');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDocuments();
  }, []);

  const handleDocumentClick = (doc: Document) => {
    navigate(`/documents/${doc.id}`);
  };

  const handleToggleDone = useCallback(async (docId: string, done: boolean) => {
    const prev = documents;
    setDocuments((docs) => docs.map((d) => d.id === docId ? { ...d, done } : d));
    try {
      await updateDocumentDone(docId, done);
      toast.success(done ? 'Segnato come fatto' : 'Segnato come da fare');
    } catch {
      setDocuments(prev);
      toast.error('Errore nell\'aggiornamento');
    }
  }, [documents]);

  if (isLoading) {
    return (
      <div className="container py-4 md:py-8 px-4 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-4 md:py-8 px-4">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="container py-4 md:py-8 px-4">
        <div className="max-w-md mx-auto text-center">
          <Card>
            <CardHeader>
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <CardTitle>Nessun documento</CardTitle>
              <CardDescription>
                Non hai ancora estratto nessuna fattura. Carica dei PDF per iniziare.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Carica PDF
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4 md:py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Documenti</h1>
          <p className="text-sm text-muted-foreground">
            {documents.length} documenti estratti
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Toggle vista */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('explorer')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm ${
                viewMode === 'explorer'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FolderTree className="h-4 w-4" />
              Explorer
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm border-l ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TableIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Tabella</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm border-l ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Columns3 className="h-4 w-4" />
              <span className="hidden sm:inline">Scadenze</span>
            </button>
          </div>
          <Button asChild size="sm">
            <Link to="/upload">
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Carica PDF</span>
            </Link>
          </Button>
        </div>
      </div>

      {viewMode === 'explorer' ? (
        <FileExplorer />
      ) : viewMode === 'table' ? (
        <DocumentsTable documents={documents} onDocumentClick={handleDocumentClick} onToggleDone={handleToggleDone} />
      ) : (
        <KanbanBoard documents={documents} onDocumentsChange={setDocuments} />
      )}
    </div>
  );
}
