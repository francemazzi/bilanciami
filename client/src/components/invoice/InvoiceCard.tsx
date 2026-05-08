import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import type { Invoice, DdtDocument, ExtractionResult } from '@/api/types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { LineItemsTable } from './LineItemsTable';
import { cn } from '@/lib/utils';

interface InvoiceCardProps {
  result: ExtractionResult;
}

function isValidInvoice(invoice: unknown): invoice is Invoice {
  return (
    invoice !== null &&
    typeof invoice === 'object' &&
    'invoice_id' in invoice &&
    'supplier' in invoice &&
    'customer' in invoice
  );
}

function isValidDdt(ddt: unknown): ddt is DdtDocument {
  return (
    ddt !== null &&
    typeof ddt === 'object' &&
    'ddt_id' in ddt &&
    'supplier' in ddt &&
    'recipient' in ddt
  );
}

export function InvoiceCard({ result }: InvoiceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { file_name, success, invoice, ddt, error, errors, confidence } = result;

  const allErrors = [
    ...(error ? [error] : []),
    ...(errors || []),
  ];

  if (success && result.documentKind === 'ddt' && isValidDdt(ddt)) {
    return <DdtCard fileName={file_name} ddt={ddt} confidence={confidence} />;
  }

  // Handle failed extraction or empty/invalid invoice
  if (!success || !invoice || !isValidInvoice(invoice)) {
    return (
      <Card className={allErrors.length > 0 ? "border-destructive/50" : "border-yellow-500/50"}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            {allErrors.length > 0 ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            <CardTitle className="text-base font-medium">{file_name}</CardTitle>
          </div>
          <Badge variant={allErrors.length > 0 ? "destructive" : "secondary"}>
            {allErrors.length > 0 ? "Errore" : "Dati incompleti"}
          </Badge>
        </CardHeader>
        <CardContent>
          {allErrors.length > 0 ? (
            <ul className="text-sm text-muted-foreground space-y-1">
              {allErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              L'estrazione non ha prodotto dati validi
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <CardTitle className="text-base font-medium">
              {invoice.invoice_id}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{file_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {confidence !== undefined && (
            <Badge variant={confidence > 0.8 ? 'default' : 'secondary'}>
              {(confidence * 100).toFixed(0)}%
            </Badge>
          )}
          <Badge variant="outline">{invoice.document_type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Fornitore
            </h4>
            <p className="text-sm font-medium">{invoice.supplier.name}</p>
            <p className="text-xs text-muted-foreground">
              P.IVA: {invoice.supplier.vat_number}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Cliente
            </h4>
            <p className="text-sm font-medium">{invoice.customer.name}</p>
            <p className="text-xs text-muted-foreground">
              P.IVA: {invoice.customer.vat_number}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Data</p>
              <p className="text-sm font-medium">
                {formatDate(invoice.document_date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Righe</p>
              <p className="text-sm font-medium">{invoice.line_items.length}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Totale</p>
            <p className="text-xl font-bold">
              {formatCurrency(invoice.totals.total_amount)}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-2 h-4 w-4" />
              Nascondi dettagli
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-4 w-4" />
              Mostra dettagli
            </>
          )}
        </Button>

        <div
          className={cn(
            'overflow-hidden transition-all duration-300',
            expanded ? 'max-h-[1000px]' : 'max-h-0'
          )}
        >
          <InvoiceDetails invoice={invoice} />
        </div>
      </CardContent>
    </Card>
  );
}

function DdtCard({ fileName, ddt, confidence }: { fileName: string; ddt: DdtDocument; confidence?: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <CardTitle className="text-base font-medium">DDT {ddt.ddt_id}</CardTitle>
            <p className="text-xs text-muted-foreground">{fileName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {confidence !== undefined && (
            <Badge variant={confidence > 0.8 ? 'default' : 'secondary'}>
              {(confidence * 100).toFixed(0)}%
            </Badge>
          )}
          <Badge variant="outline">DDT</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Fornitore
            </h4>
            <p className="text-sm font-medium">{ddt.supplier.name}</p>
            <p className="text-xs text-muted-foreground">
              P.IVA: {ddt.supplier.vat_number || '-'}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Destinatario
            </h4>
            <p className="text-sm font-medium">{ddt.recipient.name}</p>
            <p className="text-xs text-muted-foreground">
              P.IVA: {ddt.recipient.vat_number || '-'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Data</p>
            <p className="text-sm font-medium">{formatDate(ddt.document_date)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Righe</p>
            <p className="text-xl font-bold">{ddt.line_items.length}</p>
          </div>
        </div>

        <Button variant="ghost" className="w-full" onClick={() => setExpanded(!expanded)}>
          {expanded ? (
            <>
              <ChevronUp className="mr-2 h-4 w-4" />
              Nascondi dettagli
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-4 w-4" />
              Mostra dettagli
            </>
          )}
        </Button>

        <div
          className={cn(
            'overflow-hidden transition-all duration-300',
            expanded ? 'max-h-[1000px]' : 'max-h-0'
          )}
        >
          <div className="space-y-2 pt-4 border-t">
            {ddt.line_items.map((item) => (
              <div key={item.line_number} className="p-2 bg-gray-50 rounded text-sm">
                <p className="font-medium">{item.description}</p>
                <p className="text-gray-600">
                  {item.product_code && `${item.product_code} - `}
                  {item.quantity ?? '-'} {item.unit_of_measure || ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceDetails({ invoice }: { invoice: Invoice }) {
  return (
    <div className="space-y-6 pt-4 border-t">
      <LineItemsTable items={invoice.line_items} />

      {invoice.vat_summary && invoice.vat_summary.vat_rates.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Riepilogo IVA</h4>
          <div className="space-y-1">
            {invoice.vat_summary.vat_rates.map((rate, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>Aliquota {rate.rate}%</span>
                <span>
                  Imponibile: {formatCurrency(rate.taxable_amount)} | IVA:{' '}
                  {formatCurrency(rate.vat_amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold mb-2">Totali</h4>
          <div className="space-y-1 text-sm">
            {invoice.totals.subtotal && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotale</span>
                <span>{formatCurrency(invoice.totals.subtotal)}</span>
              </div>
            )}
            {invoice.totals.total_vat && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Totale IVA</span>
                <span>{formatCurrency(invoice.totals.total_vat)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1 border-t">
              <span>Totale</span>
              <span>{formatCurrency(invoice.totals.total_amount)}</span>
            </div>
          </div>
        </div>

        {invoice.payment_details && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Pagamento</h4>
            <div className="space-y-1 text-sm">
              {invoice.payment_details.payment_method && (
                <p>
                  <span className="text-muted-foreground">Metodo: </span>
                  {invoice.payment_details.payment_method}
                </p>
              )}
              {invoice.payment_details.due_date && (
                <p>
                  <span className="text-muted-foreground">Scadenza: </span>
                  {formatDate(invoice.payment_details.due_date)}
                </p>
              )}
              {invoice.payment_details.iban && (
                <p>
                  <span className="text-muted-foreground">IBAN: </span>
                  <span className="font-mono text-xs">
                    {invoice.payment_details.iban}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
