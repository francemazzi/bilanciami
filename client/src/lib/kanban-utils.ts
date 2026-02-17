import type { Document } from '@/api/documents';

export type KanbanColumnId = 'overdue' | 'due_soon' | 'upcoming' | 'later' | 'no_date';

export interface KanbanColumn {
  id: KanbanColumnId;
  title: string;
  colorClass: string;
  badgeColorClass: string;
  documents: Document[];
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

export function classifyDocument(doc: Document, now: Date = new Date()): KanbanColumnId {
  const dueDateStr = getDueDate(doc);
  if (!dueDateStr) return 'no_date';

  const dueDate = new Date(dueDateStr);
  if (isNaN(dueDate.getTime())) return 'no_date';

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'due_soon';
  if (diffDays <= 30) return 'upcoming';
  return 'later';
}

export function buildKanbanColumns(documents: Document[], now: Date = new Date()): KanbanColumn[] {
  const columns: KanbanColumn[] = [
    { id: 'overdue',  title: 'Scadute',        colorClass: 'bg-red-500',    badgeColorClass: 'bg-red-100 text-red-800',       documents: [] },
    { id: 'due_soon', title: 'In Scadenza',    colorClass: 'bg-orange-500', badgeColorClass: 'bg-orange-100 text-orange-800',  documents: [] },
    { id: 'upcoming', title: 'Prossime',       colorClass: 'bg-yellow-500', badgeColorClass: 'bg-yellow-100 text-yellow-800',  documents: [] },
    { id: 'later',    title: 'Lontane',        colorClass: 'bg-green-500',  badgeColorClass: 'bg-green-100 text-green-800',    documents: [] },
    { id: 'no_date',  title: 'Senza Scadenza', colorClass: 'bg-gray-400',   badgeColorClass: 'bg-gray-100 text-gray-800',     documents: [] },
  ];

  const columnMap = new Map(columns.map(c => [c.id, c]));

  for (const doc of documents) {
    const colId = classifyDocument(doc, now);
    columnMap.get(colId)!.documents.push(doc);
  }

  for (const col of columns) {
    if (col.id === 'no_date') {
      col.documents.sort((a, b) => a.supplierName.localeCompare(b.supplierName));
    } else {
      col.documents.sort((a, b) => {
        const aDate = getDueDate(a) || '';
        const bDate = getDueDate(b) || '';
        return aDate.localeCompare(bDate);
      });
    }
  }

  return columns;
}
