import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LineItem } from '@/api/types';
import { formatCurrency, formatNumber } from '@/lib/formatters';

interface LineItemsTableProps {
  items: LineItem[];
}

export function LineItemsTable({ items }: LineItemsTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nessuna riga presente</p>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Righe fattura</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Descrizione</TableHead>
            <TableHead className="text-right w-20">Qtà</TableHead>
            <TableHead className="text-right w-24">Prezzo</TableHead>
            <TableHead className="text-right w-16">IVA</TableHead>
            <TableHead className="text-right w-28">Totale</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="text-muted-foreground">
                {item.line_number}
              </TableCell>
              <TableCell>
                <div className="max-w-xs">
                  {item.product_code && (
                    <span className="text-xs text-muted-foreground font-mono mr-2">
                      [{item.product_code}]
                    </span>
                  )}
                  <span className="text-sm">{item.description}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(item.quantity, 2)}
                {item.unit_of_measure && (
                  <span className="text-xs text-muted-foreground ml-1">
                    {item.unit_of_measure}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(item.unit_price)}
              </TableCell>
              <TableCell className="text-right">
                {item.vat_rate !== undefined ? `${item.vat_rate}%` : '-'}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(item.line_total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
