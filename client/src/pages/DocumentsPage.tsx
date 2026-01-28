import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FileText, Upload } from 'lucide-react';

export function DocumentsPage() {
  // TODO: Fetch documents from API when implemented
  const documents: unknown[] = [];

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
            Lista dei documenti estratti
          </p>
        </div>
        <Button asChild>
          <Link to="/upload">
            <Upload className="mr-2 h-4 w-4" />
            Carica PDF
          </Link>
        </Button>
      </div>

      {/* TODO: DocumentsTable component */}
      <p>Documenti saranno mostrati qui</p>
    </div>
  );
}
