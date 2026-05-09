/**
 * Helper condivisi per i tool DDT
 */

export type Period = "month" | "quarter" | "year" | "all";

export interface PeriodRange {
  startDate: Date | null;
  endDate: Date | null;
  previousStart: Date | null;
  previousEnd: Date | null;
}

/**
 * Calcola il range di date per il periodo richiesto e il periodo precedente per confronti.
 * Se period === "all" tutti i campi sono null.
 */
export function getPeriodRange(period: Period): PeriodRange {
  const now = new Date();

  if (period === "all") {
    return { startDate: null, endDate: null, previousStart: null, previousEnd: null };
  }

  if (period === "month") {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
      previousStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      previousEnd: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    };
  }

  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return {
      startDate: new Date(now.getFullYear(), q * 3, 1),
      endDate: new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59),
      previousStart: new Date(now.getFullYear(), (q - 1) * 3, 1),
      previousEnd: new Date(now.getFullYear(), q * 3, 0, 23, 59, 59),
    };
  }

  // year
  return {
    startDate: new Date(now.getFullYear(), 0, 1),
    endDate: new Date(now.getFullYear(), 11, 31, 23, 59, 59),
    previousStart: new Date(now.getFullYear() - 1, 0, 1),
    previousEnd: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59),
  };
}

export interface FlatLineItem {
  documentId: string;
  documentNumber: string | null;
  documentDate: string | null;
  fileName: string;
  supplierName: string;
  recipientName: string;
  productCode: string | null;
  description: string;
  quantity: number | null;
  unitOfMeasure: string | null;
}

interface DocLike {
  id: string;
  documentNumber: string | null;
  documentDate: Date | null;
  fileName: string;
  supplierName: string;
  customerName: string;
  metadata: unknown;
}

/**
 * Appiattisce i line_items dei DDT in un array piatto.
 * Stessa logica di document.routes.ts:218-244.
 */
export function flattenLineItems(documents: DocLike[]): FlatLineItem[] {
  return documents.flatMap((document) => {
    const metadata = (document.metadata || {}) as Record<string, unknown>;
    const lineItems = Array.isArray(metadata.line_items) ? metadata.line_items : [];

    return lineItems.map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        documentId: document.id,
        documentNumber: document.documentNumber,
        documentDate: document.documentDate?.toISOString() || null,
        fileName: document.fileName,
        supplierName: document.supplierName,
        recipientName: document.customerName,
        productCode: typeof item.product_code === "string" ? item.product_code : null,
        description: typeof item.description === "string" ? item.description : "",
        quantity: typeof item.quantity === "number" ? item.quantity : null,
        unitOfMeasure: typeof item.unit_of_measure === "string" ? item.unit_of_measure : null,
      };
    });
  });
}

/**
 * Italian-friendly trend arrow.
 */
export function trendArrow(changePercent: number): "↑" | "↓" | "→" {
  if (changePercent > 5) return "↑";
  if (changePercent < -5) return "↓";
  return "→";
}
