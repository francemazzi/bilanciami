import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Zap } from 'lucide-react';

export function HomePage() {
  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Benvenuto in Bilanciami
        </h1>
        <p className="text-xl text-muted-foreground">
          Estrai automaticamente i dati dalle tue fatture PDF usando l'intelligenza artificiale
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <Upload className="h-10 w-10 mb-2 text-primary" />
            <CardTitle>Carica PDF</CardTitle>
            <CardDescription>
              Carica una o piu fatture in formato PDF
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/upload">Inizia</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Zap className="h-10 w-10 mb-2 text-primary" />
            <CardTitle>Estrazione AI</CardTitle>
            <CardDescription>
              I dati vengono estratti automaticamente usando modelli AI avanzati
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Fornitore e cliente</li>
              <li>Righe fattura</li>
              <li>Totali e IVA</li>
              <li>Dati di pagamento</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <FileText className="h-10 w-10 mb-2 text-primary" />
            <CardTitle>Dati Strutturati</CardTitle>
            <CardDescription>
              Ottieni i dati in formato JSON pronto per l'uso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/documents">Documenti</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
