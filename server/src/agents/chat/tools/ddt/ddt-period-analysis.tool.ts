import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma.js";
import { flattenLineItems, getPeriodRange, trendArrow } from "./_helpers.js";

/**
 * Tool per analisi DDT in un periodo con confronto sul periodo precedente.
 */
export const ddtPeriodAnalysisTool = new DynamicStructuredTool({
  name: "ddt_period_analysis",
  description:
    "Analizza i DDT in un periodo (mese/trimestre/anno) con confronto sul periodo precedente: " +
    "numero DDT, articoli totali, fornitori distinti, prodotti distinti e variazione percentuale. " +
    "Usalo per domande come 'quanti DDT ho ricevuto questo mese?', 'trend consegne', 'confronto trimestrale'.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    period: z
      .enum(["month", "quarter", "year"])
      .optional()
      .describe("Periodo di analisi (default: month)"),
  }),
  func: async ({ userId, period = "month" }) => {
    const { startDate, endDate, previousStart, previousEnd } =
      getPeriodRange(period);

    const baseWhere = {
      users: { some: { userId } },
      documentKind: "ddt",
    };

    const [currentDocs, previousDocs] = await Promise.all([
      prisma.document.findMany({
        where: {
          ...baseWhere,
          documentDate: { gte: startDate!, lte: endDate! },
        },
        select: {
          id: true,
          documentNumber: true,
          documentDate: true,
          fileName: true,
          supplierName: true,
          customerName: true,
          metadata: true,
        },
      }),
      prisma.document.findMany({
        where: {
          ...baseWhere,
          documentDate: { gte: previousStart!, lte: previousEnd! },
        },
        select: {
          id: true,
          documentNumber: true,
          documentDate: true,
          fileName: true,
          supplierName: true,
          customerName: true,
          metadata: true,
        },
      }),
    ]);

    const summarize = (docs: typeof currentDocs) => {
      const items = flattenLineItems(docs);
      const suppliers = new Set(docs.map((d) => d.supplierName));
      const products = new Set<string>();
      let totalQuantity = 0;
      for (const it of items) {
        const key =
          it.productCode?.trim() || it.description.trim().toLowerCase();
        if (key) products.add(key);
        totalQuantity += it.quantity || 0;
      }
      return {
        ddtCount: docs.length,
        lineItemCount: items.length,
        totalQuantity,
        distinctSuppliers: suppliers.size,
        distinctProducts: products.size,
      };
    };

    const current = summarize(currentDocs);
    const previous = summarize(previousDocs);

    const pct = (curr: number, prev: number) =>
      prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;

    const ddtChange = pct(current.ddtCount, previous.ddtCount);
    const itemsChange = pct(current.lineItemCount, previous.lineItemCount);
    const qtyChange = pct(current.totalQuantity, previous.totalQuantity);

    return JSON.stringify({
      period,
      currentPeriod: {
        start: startDate?.toISOString(),
        end: endDate?.toISOString(),
        ...current,
      },
      previousPeriod: {
        start: previousStart?.toISOString(),
        end: previousEnd?.toISOString(),
        ...previous,
      },
      comparison: {
        ddtCount: {
          delta: current.ddtCount - previous.ddtCount,
          changePercent: ddtChange.toFixed(1),
          trend: trendArrow(ddtChange),
        },
        lineItems: {
          delta: current.lineItemCount - previous.lineItemCount,
          changePercent: itemsChange.toFixed(1),
          trend: trendArrow(itemsChange),
        },
        totalQuantity: {
          delta: current.totalQuantity - previous.totalQuantity,
          changePercent: qtyChange.toFixed(1),
          trend: trendArrow(qtyChange),
        },
      },
    });
  },
});
