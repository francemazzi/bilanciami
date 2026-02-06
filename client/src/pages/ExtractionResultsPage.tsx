import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InvoiceCard } from '@/components/invoice/InvoiceCard';
import { ArrowLeft, Upload, CheckCircle2, XCircle } from 'lucide-react';
import type { ExtractionResponse } from '@/api/types';

export function ExtractionResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const results = location.state?.results as ExtractionResponse | undefined;

  if (!results) {
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
