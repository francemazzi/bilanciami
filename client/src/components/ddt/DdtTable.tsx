import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { Document } from '@/api/documents';
import { formatDate } from '@/lib/formatters';

interface DdtLineItem {
  product_code?: string | null;
  description?: string;
  quantity?: number | null;
  unit_of_measure?: string | null;
}

interface DdtTableProps {
  documents: Document[];
  onDocumentClick: (doc: Document) => void;
}

function getDdtNumber(doc: Document): string {
  const metadata = doc.metadata || {};
  return doc.documentNumber || (metadata.ddt_id as string | undefined) || '-';
}

function getLineItems(doc: Document): DdtLineItem[] {
  const metadata = doc.metadata || {};
  return Array.isArray(metadata.line_items) ? (metadata.line_items as DdtLineItem[]) : [];
}

function summarizeItems(doc: Document): string {
  const items = getLineItems(doc);
  if (items.length === 0) return '-';

  return items
    .slice(0, 2)
    .map((item) => {
      const code = item.product_code ? `${item.product_code} - ` : '';
      const quantity =
        typeof item.quantity === 'number'
          ? ` (${item.quantity}${item.unit_of_measure ? ` ${item.unit_of_measure}` : ''})`
          : '';
      return `${code}${item.description || 'Articolo'}${quantity}`;
    })
    .join('; ');
}

export function DdtTable({ documents, onDocumentClick }: DdtTableProps) {
  const [filters, setFilters] = useState({
    supplier: '',
    product: '',
  });

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (
        filters.supplier &&
        !doc.supplierName.toLowerCase().includes(filters.supplier.toLowerCase())
      ) {
        return false;
      }

      if (filters.product) {
        const needle = filters.product.toLowerCase();
        const matchesProduct = getLineItems(doc).some((item) => {
          const code = item.product_code?.toLowerCase() || '';
          const description = item.description?.toLowerCase() || '';
          return code.includes(needle) || description.includes(needle);
        });
        if (!matchesProduct) return false;
      }

      return true;
    });
  }, [documents, filters]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <input
          type="text"
          placeholder="Filtra per fornitore..."
          value={filters.supplier}
          onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
        />
        <input
          type="text"
          placeholder="Filtra per prodotto o codice..."
          value={filters.product}
          onChange={(e) => setFilters((f) => ({ ...f, product: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
        />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DDT</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Fornitore</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead>Prodotti</TableHead>
              <TableHead className="text-right">Righe</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                  Nessun DDT trovato
                </TableCell>
              </TableRow>
            ) : (
              filteredDocuments.map((doc) => (
                <TableRow
                  key={doc.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onDocumentClick(doc)}
                >
                  <TableCell className="font-medium">{getDdtNumber(doc)}</TableCell>
                  <TableCell>{doc.documentDate ? formatDate(doc.documentDate) : '-'}</TableCell>
                  <TableCell>{doc.supplierName}</TableCell>
                  <TableCell>{doc.customerName}</TableCell>
                  <TableCell className="max-w-md truncate" title={summarizeItems(doc)}>
                    {summarizeItems(doc)}
                  </TableCell>
                  <TableCell className="text-right">{getLineItems(doc).length}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="gap-1">
                      <ExternalLink className="h-4 w-4" />
                      Apri
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
