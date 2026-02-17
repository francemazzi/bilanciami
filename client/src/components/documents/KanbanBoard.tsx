import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Calendar, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { buildKanbanColumns, type KanbanColumn } from '@/lib/kanban-utils';
import {
  updateFollowUpStatus,
  type Document,
  type FollowUpStatus,
} from '@/api/documents';
import { toast } from 'sonner';

const FOLLOW_UP_OPTIONS: { value: FollowUpStatus; label: string; badgeClass: string; dotClass: string }[] = [
  { value: 'da_gestire',      label: 'Da gestire',      badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',     dotClass: 'bg-gray-400' },
  { value: 'sollecitata',     label: 'Sollecitata',     badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',   dotClass: 'bg-amber-400' },
  { value: 'richiesta_saldo', label: 'Richiesta saldo', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',      dotClass: 'bg-blue-400' },
  { value: 'gestita',         label: 'Gestita',          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotClass: 'bg-emerald-400' },
];

function getFollowUpLabel(status: FollowUpStatus | null): string {
  if (!status) return 'Nessuna azione';
  return FOLLOW_UP_OPTIONS.find(o => o.value === status)?.label ?? status;
}

function getFollowUpBadgeClass(status: FollowUpStatus | null): string {
  if (!status) return 'bg-gray-50 text-gray-500 border-gray-200';
  return FOLLOW_UP_OPTIONS.find(o => o.value === status)?.badgeClass ?? 'bg-gray-100 text-gray-700 border-gray-200';
}

function getDueDate(doc: Document): string | null {
  if (doc.dueDate) return doc.dueDate;
  const metadata = doc.metadata as Record<string, unknown> | null;
  const paymentDetails = metadata?.payment_details as Record<string, unknown> | undefined;
  if (paymentDetails?.due_date && typeof paymentDetails.due_date === 'string') {
    return paymentDetails.due_date;
  }
  return null;
}

function getTotalAmount(doc: Document): number | null {
  if (doc.totalAmount) return parseFloat(doc.totalAmount);
  const metadata = doc.metadata as Record<string, unknown> | null;
  const totals = metadata?.totals as Record<string, unknown> | undefined;
  if (totals?.total_amount && typeof totals.total_amount === 'number') {
    return totals.total_amount;
  }
  return null;
}

// --- KanbanCard ---

interface KanbanCardProps {
  doc: Document;
  onStatusChange: (docId: string, status: FollowUpStatus) => void;
  onClick: (doc: Document) => void;
}

function KanbanCard({ doc, onStatusChange, onClick }: KanbanCardProps) {
  const amount = getTotalAmount(doc);
  const dueDate = getDueDate(doc);

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow active:shadow-sm"
      onClick={() => onClick(doc)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold truncate flex-1">
            {doc.supplierName}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Stato follow-up</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {FOLLOW_UP_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(doc.id, opt.value);
                  }}
                  className="text-sm"
                >
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 shrink-0 ${opt.dotClass}`} />
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-xs text-muted-foreground truncate">
          {doc.customerName}
        </p>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold">
            {amount !== null ? formatCurrency(amount) : '-'}
          </span>
          {dueDate && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
              <Calendar className="h-3 w-3" />
              {formatDate(dueDate)}
            </span>
          )}
        </div>

        <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${getFollowUpBadgeClass(doc.followUpStatus)}`}>
          {getFollowUpLabel(doc.followUpStatus)}
        </Badge>
      </CardContent>
    </Card>
  );
}

// --- Desktop Column ---

interface ColumnProps {
  column: KanbanColumn;
  onStatusChange: (docId: string, status: FollowUpStatus) => void;
  onDocumentClick: (doc: Document) => void;
}

function KanbanColumnDesktop({ column, onStatusChange, onDocumentClick }: ColumnProps) {
  return (
    <div className="flex-shrink-0 w-64 lg:w-72">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-3 h-3 rounded-full shrink-0 ${column.colorClass}`} />
        <h3 className="text-sm font-semibold truncate">{column.title}</h3>
        <Badge variant="secondary" className={`text-xs ml-auto shrink-0 ${column.badgeColorClass}`}>
          {column.documents.length}
        </Badge>
      </div>

      <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 pb-2">
        {column.documents.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg">
            Nessun documento
          </div>
        ) : (
          column.documents.map((doc) => (
            <KanbanCard
              key={doc.id}
              doc={doc}
              onStatusChange={onStatusChange}
              onClick={onDocumentClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

// --- Mobile Column (collapsible) ---

function KanbanColumnMobile({ column, onStatusChange, onDocumentClick }: ColumnProps & { defaultExpanded?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(
    column.id === 'overdue' || column.id === 'due_soon'
  );

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left py-2 px-1"
      >
        <div className={`w-3 h-3 rounded-full shrink-0 ${column.colorClass}`} />
        <h3 className="text-sm font-semibold flex-1">{column.title}</h3>
        <Badge variant="secondary" className={`text-xs ${column.badgeColorClass}`}>
          {column.documents.length}
        </Badge>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-2 pl-5 pb-2">
          {column.documents.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded-lg">
              Nessun documento
            </div>
          ) : (
            column.documents.map((doc) => (
              <KanbanCard
                key={doc.id}
                doc={doc}
                onStatusChange={onStatusChange}
                onClick={onDocumentClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- Main KanbanBoard ---

interface KanbanBoardProps {
  documents: Document[];
  onDocumentsChange: (documents: Document[]) => void;
}

export function KanbanBoard({ documents, onDocumentsChange }: KanbanBoardProps) {
  const navigate = useNavigate();
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(new Date());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const columns = useMemo(() => buildKanbanColumns(documents, nowTick), [documents, nowTick]);

  const handleDocumentClick = useCallback((doc: Document) => {
    navigate(`/documents/${doc.id}`);
  }, [navigate]);

  const handleStatusChange = useCallback(async (docId: string, status: FollowUpStatus) => {
    const prev = documents;
    const updatedDocs = documents.map(d =>
      d.id === docId ? { ...d, followUpStatus: status } : d
    );
    onDocumentsChange(updatedDocs);

    try {
      await updateFollowUpStatus(docId, status);
      toast.success(`Stato aggiornato: ${FOLLOW_UP_OPTIONS.find(o => o.value === status)?.label}`);
    } catch {
      onDocumentsChange(prev);
      toast.error('Errore nell\'aggiornamento dello stato');
    }
  }, [documents, onDocumentsChange]);

  const overdueCount = columns.find(c => c.id === 'overdue')?.documents.length ?? 0;
  const dueSoonCount = columns.find(c => c.id === 'due_soon')?.documents.length ?? 0;

  return (
    <div className="space-y-4">
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>
            {overdueCount > 0 && (
              <span className="font-semibold text-red-700">
                {overdueCount} scadut{overdueCount === 1 ? 'a' : 'e'}
              </span>
            )}
            {overdueCount > 0 && dueSoonCount > 0 && ' · '}
            {dueSoonCount > 0 && (
              <span className="font-semibold text-orange-700">
                {dueSoonCount} in scadenza entro 7 giorni
              </span>
            )}
          </span>
        </div>
      )}

      {/* Desktop */}
      <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <KanbanColumnDesktop
            key={col.id}
            column={col}
            onStatusChange={handleStatusChange}
            onDocumentClick={handleDocumentClick}
          />
        ))}
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-1">
        {columns.map((col) => (
          <KanbanColumnMobile
            key={col.id}
            column={col}
            onStatusChange={handleStatusChange}
            onDocumentClick={handleDocumentClick}
          />
        ))}
      </div>
    </div>
  );
}
