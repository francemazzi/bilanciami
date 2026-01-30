import { useMemo, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { exportDocuments, type ExportFormat } from '@/lib/export';
import { ExportDropdown } from './ExportDropdown';
import type { Document } from '@/api/documents';

// Helper per estrarre dueDate da metadata se non presente a livello root
function getDueDate(doc: Document): string | null {
  if (doc.dueDate) return doc.dueDate;
  const metadata = doc.metadata as Record<string, unknown> | null;
  const paymentDetails = metadata?.payment_details as Record<string, unknown> | undefined;
  if (paymentDetails?.due_date && typeof paymentDetails.due_date === 'string') {
    return paymentDetails.due_date;
  }
  return null;
}

// Helper per estrarre totalAmount da metadata se non presente a livello root
function getTotalAmount(doc: Document): number | null {
  if (doc.totalAmount) return parseFloat(doc.totalAmount);
  const metadata = doc.metadata as Record<string, unknown> | null;
  const totals = metadata?.totals as Record<string, unknown> | undefined;
  if (totals?.total_amount && typeof totals.total_amount === 'number') {
    return totals.total_amount;
  }
  return null;
}

interface DocumentsTableProps {
  documents: Document[];
  onDocumentClick: (doc: Document) => void;
}

type SortField = 'fileName' | 'supplierName' | 'customerName' | 'dueDate' | 'totalAmount';
type SortOrder = 'asc' | 'desc';

export function DocumentsTable({ documents, onDocumentClick }: DocumentsTableProps) {
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filters, setFilters] = useState({
    supplier: '',
    customer: '',
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-4 w-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4" />
    );
  };

  const handleExportAll = (format: ExportFormat) => {
    exportDocuments(documents, format, 'tutti-i-documenti');
  };

  const handleExportFiltered = (format: ExportFormat) => {
    exportDocuments(filteredAndSortedDocs, format, 'documenti-filtrati');
  };

  const filteredAndSortedDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        if (
          filters.supplier &&
          !doc.supplierName.toLowerCase().includes(filters.supplier.toLowerCase())
        ) {
          return false;
        }
        if (
          filters.customer &&
          !doc.customerName.toLowerCase().includes(filters.customer.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        let aVal: string | number | null = null;
        let bVal: string | number | null = null;

        switch (sortField) {
          case 'fileName':
            aVal = a.fileName;
            bVal = b.fileName;
            break;
          case 'supplierName':
            aVal = a.supplierName;
            bVal = b.supplierName;
            break;
          case 'customerName':
            aVal = a.customerName;
            bVal = b.customerName;
            break;
          case 'dueDate':
            aVal = getDueDate(a) || '';
            bVal = getDueDate(b) || '';
            break;
          case 'totalAmount':
            aVal = getTotalAmount(a) ?? 0;
            bVal = getTotalAmount(b) ?? 0;
            break;
        }

        if (aVal === null || aVal === '') aVal = sortOrder === 'asc' ? 'zzz' : '';
        if (bVal === null || bVal === '') bVal = sortOrder === 'asc' ? 'zzz' : '';

        const modifier = sortOrder === 'asc' ? 1 : -1;
        if (aVal < bVal) return -1 * modifier;
        if (aVal > bVal) return 1 * modifier;
        return 0;
      });
  }, [documents, filters, sortField, sortOrder]);

  return (
    <div className="space-y-4">
      {/* Filtri + Export */}
      <div className="flex justify-between items-center gap-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Filtra per fornitore..."
            value={filters.supplier}
            onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Filtra per cliente..."
            value={filters.customer}
            onChange={(e) => setFilters((f) => ({ ...f, customer: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <ExportDropdown
          showBulkOptions
          onExport={() => {}}
          onExportAll={handleExportAll}
          onExportFiltered={handleExportFiltered}
          totalCount={documents.length}
          filteredCount={filteredAndSortedDocs.length}
          disabled={documents.length === 0}
        />
      </div>

      {/* Tabella */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('fileName')}
              >
                <div className="flex items-center">
                  Nome File
                  <SortIcon field="fileName" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('supplierName')}
              >
                <div className="flex items-center">
                  Fornitore
                  <SortIcon field="supplierName" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('customerName')}
              >
                <div className="flex items-center">
                  Cliente
                  <SortIcon field="customerName" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('dueDate')}
              >
                <div className="flex items-center">
                  Scadenza
                  <SortIcon field="dueDate" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50 text-right"
                onClick={() => handleSort('totalAmount')}
              >
                <div className="flex items-center justify-end">
                  Totale
                  <SortIcon field="totalAmount" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedDocs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  Nessun documento trovato
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedDocs.map((doc) => (
                <TableRow
                  key={doc.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onDocumentClick(doc)}
                >
                  <TableCell className="font-medium">{doc.fileName}</TableCell>
                  <TableCell>{doc.supplierName}</TableCell>
                  <TableCell>{doc.customerName}</TableCell>
                  <TableCell>
                    {getDueDate(doc) ? formatDate(getDueDate(doc)!) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {getTotalAmount(doc) !== null ? formatCurrency(getTotalAmount(doc)!) : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-gray-500">
        {filteredAndSortedDocs.length} di {documents.length} documenti
      </p>
    </div>
  );
}
