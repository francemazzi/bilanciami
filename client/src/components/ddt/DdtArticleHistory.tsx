import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getDdtArticleHistory,
  type DdtArticleHistoryItem,
} from '@/api/documents';
import { formatDate } from '@/lib/formatters';

export function DdtArticleHistory() {
  const navigate = useNavigate();
  const [items, setItems] = useState<DdtArticleHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productFilter, setProductFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  useEffect(() => {
    async function loadHistory() {
      try {
        setIsLoading(true);
        const data = await getDdtArticleHistory();
        setItems(data);
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (
        supplierFilter &&
        !item.supplierName.toLowerCase().includes(supplierFilter.toLowerCase())
      ) {
        return false;
      }

      if (productFilter) {
        const needle = productFilter.toLowerCase();
        const code = item.productCode?.toLowerCase() || '';
        const description = item.description.toLowerCase();
        if (!code.includes(needle) && !description.includes(needle)) {
          return false;
        }
      }

      return true;
    });
  }, [items, productFilter, supplierFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <input
          type="text"
          placeholder="Filtra cronologia per fornitore..."
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
        />
        <input
          type="text"
          placeholder="Filtra cronologia per prodotto..."
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
        />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prodotto</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead>Quantita</TableHead>
              <TableHead>Fornitore</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead>DDT</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                  Nessuna riga articolo trovata
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item, index) => (
                <TableRow
                  key={`${item.documentId}-${index}`}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/documents/${item.documentId}`)}
                >
                  <TableCell className="font-medium">{item.productCode || '-'}</TableCell>
                  <TableCell className="max-w-md">{item.description}</TableCell>
                  <TableCell>
                    {item.quantity !== null
                      ? `${item.quantity}${item.unitOfMeasure ? ` ${item.unitOfMeasure}` : ''}`
                      : '-'}
                  </TableCell>
                  <TableCell>{item.supplierName}</TableCell>
                  <TableCell>{item.recipientName}</TableCell>
                  <TableCell>{item.documentNumber || item.fileName}</TableCell>
                  <TableCell>{item.documentDate ? formatDate(item.documentDate) : '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
