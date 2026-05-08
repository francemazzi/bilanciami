import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, History, Loader2, TableIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DdtTable } from '@/components/ddt/DdtTable';
import { DdtArticleHistory } from '@/components/ddt/DdtArticleHistory';
import { getDocuments, type Document } from '@/api/documents';

type DdtViewMode = 'table' | 'history';
const VALID_VIEWS: DdtViewMode[] = ['table', 'history'];

export function DdtPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const viewMode: DdtViewMode = VALID_VIEWS.includes(viewParam as DdtViewMode)
    ? (viewParam as DdtViewMode)
    : 'table';

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setViewMode = useCallback((mode: DdtViewMode) => {
    setSearchParams({ view: mode }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    async function loadDocuments() {
      try {
        setIsLoading(true);
        const data = await getDocuments({ documentKind: 'ddt' });
        setDocuments(data);
      } catch (err) {
        setError('Errore nel caricamento dei DDT');
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
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <CardTitle>Nessun DDT</CardTitle>
              <CardDescription>
                Non hai ancora estratto documenti di trasporto. Carica dei PDF per iniziare.
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
          <h1 className="text-xl md:text-2xl font-bold">DDT</h1>
          <p className="text-sm text-muted-foreground">
            {documents.length} documenti di trasporto estratti
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TableIcon className="h-4 w-4" />
              Tabella
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm border-l ${
                viewMode === 'history'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <History className="h-4 w-4" />
              Cronologia articoli
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

      {viewMode === 'table' ? (
        <DdtTable documents={documents} onDocumentClick={handleDocumentClick} />
      ) : (
        <DdtArticleHistory />
      )}
    </div>
  );
}
