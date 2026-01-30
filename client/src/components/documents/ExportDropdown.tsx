import { Download, FileSpreadsheet, FileText, FileType } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ExportFormat } from '@/lib/export';

interface ExportOption {
  format: ExportFormat;
  label: string;
  icon: React.ReactNode;
}

const EXPORT_OPTIONS: ExportOption[] = [
  { format: 'csv', label: 'CSV', icon: <FileText className="h-4 w-4 mr-2" /> },
  { format: 'xlsx', label: 'Excel (.xlsx)', icon: <FileSpreadsheet className="h-4 w-4 mr-2" /> },
  { format: 'docx', label: 'Word (.docx)', icon: <FileType className="h-4 w-4 mr-2" /> },
];

interface ExportDropdownProps {
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
  showBulkOptions?: boolean;
  onExportAll?: (format: ExportFormat) => void;
  onExportFiltered?: (format: ExportFormat) => void;
  filteredCount?: number;
  totalCount?: number;
}

export function ExportDropdown({
  onExport,
  disabled = false,
  showBulkOptions = false,
  onExportAll,
  onExportFiltered,
  filteredCount,
  totalCount,
}: ExportDropdownProps) {
  if (showBulkOptions && onExportAll && onExportFiltered) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={disabled}>
            <Download className="h-4 w-4 mr-2" />
            Esporta
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Esporta tutti ({totalCount})</DropdownMenuLabel>
          {EXPORT_OPTIONS.map((opt) => (
            <DropdownMenuItem key={`all-${opt.format}`} onClick={() => onExportAll(opt.format)}>
              {opt.icon}
              {opt.label}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuLabel>Esporta filtrati ({filteredCount})</DropdownMenuLabel>
          {EXPORT_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={`filtered-${opt.format}`}
              onClick={() => onExportFiltered(opt.format)}
              disabled={filteredCount === 0}
            >
              {opt.icon}
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          Esporta
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {EXPORT_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.format} onClick={() => onExport(opt.format)}>
            {opt.icon}
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
