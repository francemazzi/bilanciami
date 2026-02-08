import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

interface VatSummaryItem {
  rate: number;
  taxableAmount: number;
  vatAmount: number;
}

type JsonObject = Record<string, unknown>;

/**
 * Tool per riepilogo IVA per periodo
 * Calcola totali imponibile e IVA raggruppati per aliquota
 */
export const vatSummaryTool = new DynamicStructuredTool({
  name: "vat_summary",
  description:
    "Calcola il riepilogo IVA per un periodo (mese, trimestre, anno). " +
    "Mostra totali imponibile e IVA per aliquota. Utile per liquidazioni IVA.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    period: z
      .enum(["month", "quarter", "year"])
      .describe("Periodo: month, quarter, year"),
    offset: z
      .number()
      .optional()
      .describe("Offset dal periodo corrente (0=corrente, -1=precedente)"),
  }),
  func: async ({ userId, period, offset = 0 }) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    // Calcola date periodo
    if (period === "month") {
      const targetMonth = now.getMonth() + offset;
      const targetYear =
        now.getFullYear() + Math.floor((now.getMonth() + offset) / 12);
      const adjustedMonth = ((targetMonth % 12) + 12) % 12;

      startDate = new Date(targetYear, adjustedMonth, 1);
      endDate = new Date(targetYear, adjustedMonth + 1, 0, 23, 59, 59);

      const monthNames = [
        "Gennaio",
        "Febbraio",
        "Marzo",
        "Aprile",
        "Maggio",
        "Giugno",
        "Luglio",
        "Agosto",
        "Settembre",
        "Ottobre",
        "Novembre",
        "Dicembre",
      ];
      periodLabel = `${monthNames[adjustedMonth]} ${targetYear}`;
    } else if (period === "quarter") {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const targetQuarter = currentQuarter + offset;
      const targetYear =
        now.getFullYear() + Math.floor((currentQuarter + offset) / 4);
      const adjustedQuarter = ((targetQuarter % 4) + 4) % 4;

      startDate = new Date(targetYear, adjustedQuarter * 3, 1);
      endDate = new Date(targetYear, adjustedQuarter * 3 + 3, 0, 23, 59, 59);

      periodLabel = `Q${adjustedQuarter + 1} ${targetYear}`;
    } else {
      // year
      const targetYear = now.getFullYear() + offset;
      startDate = new Date(targetYear, 0, 1);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59);
      periodLabel = `Anno ${targetYear}`;
    }

    // Trova fatture nel periodo
    const invoices = await prisma.document.findMany({
      where: {
        users: { some: { userId } },
        documentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        invoiceId: true,
        totalAmount: true,
        metadata: true,
      },
    });

    // Aggrega per aliquota IVA
    const vatByRate: Record<number, { taxable: number; vat: number }> = {};
    let totalTaxable = 0;
    let totalVat = 0;
    let totalAmount = 0;

    for (const inv of invoices) {
      const metadata = inv.metadata as JsonObject | null;
      totalAmount += inv.totalAmount || 0;

      if (metadata && typeof metadata === "object") {
        // Estrai vat_summary o totals dal metadata
        const vatSummary = metadata.vat_summary as JsonObject | undefined;
        const totals = metadata.totals as JsonObject | undefined;

        if (vatSummary && Array.isArray(vatSummary.vat_rates)) {
          for (const rate of vatSummary.vat_rates as VatSummaryItem[]) {
            const vatRate = rate.rate || 0;
            if (!vatByRate[vatRate]) {
              vatByRate[vatRate] = { taxable: 0, vat: 0 };
            }
            vatByRate[vatRate].taxable += rate.taxableAmount || 0;
            vatByRate[vatRate].vat += rate.vatAmount || 0;
            totalTaxable += rate.taxableAmount || 0;
            totalVat += rate.vatAmount || 0;
          }
        } else if (totals) {
          // Fallback: usa totals se vat_summary non disponibile
          const taxable = (totals.total_taxable as number) || 0;
          const vat = (totals.total_vat as number) || 0;
          // Assume aliquota 22% se non specificata
          const rate = taxable > 0 ? Math.round((vat / taxable) * 100) : 22;

          if (!vatByRate[rate]) {
            vatByRate[rate] = { taxable: 0, vat: 0 };
          }
          vatByRate[rate].taxable += taxable;
          vatByRate[rate].vat += vat;
          totalTaxable += taxable;
          totalVat += vat;
        }
      }
    }

    // Formatta risultati
    const vatBreakdown = Object.entries(vatByRate)
      .map(([rate, data]) => ({
        rate: Number(rate),
        taxableAmount: Math.round(data.taxable * 100) / 100,
        vatAmount: Math.round(data.vat * 100) / 100,
      }))
      .sort((a, b) => b.rate - a.rate);

    return JSON.stringify({
      period: periodLabel,
      startDate,
      endDate,
      invoiceCount: invoices.length,
      totals: {
        taxable: Math.round(totalTaxable * 100) / 100,
        vat: Math.round(totalVat * 100) / 100,
        total: Math.round(totalAmount * 100) / 100,
      },
      vatBreakdown,
    });
  },
});
