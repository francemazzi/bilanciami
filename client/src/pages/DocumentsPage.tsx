import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FileText, Upload, FolderTree, TableIcon, Loader2 } from 'lucide-react';
import { FileExplorer } from '@/components/documents/FileExplorer';
import { DocumentsTable } from '@/components/documents/DocumentsTable';
import { getDocuments, type Document } from '@/api/documents';

type ViewMode = 'explorer' | 'table';

export function DocumentsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('explorer');
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

  if (isLoading) {
    return (
      <div className="container py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="container py-8">
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
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Documenti</h1>
          <p className="text-muted-foreground">
            {documents.length} documenti estratti
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Toggle vista */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('explorer')}
              className={`flex items-center gap-2 px-3 py-2 text-sm ${
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
              className={`flex items-center gap-2 px-3 py-2 text-sm border-l ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TableIcon className="h-4 w-4" />
              Tabella
            </button>
          </div>
          <Button asChild>
            <Link to="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Carica PDF
            </Link>
          </Button>
        </div>
      </div>

      {viewMode === 'explorer' ? (
        <FileExplorer />
      ) : (
        <DocumentsTable documents={documents} onDocumentClick={handleDocumentClick} />
      )}
    </div>
  );
}
