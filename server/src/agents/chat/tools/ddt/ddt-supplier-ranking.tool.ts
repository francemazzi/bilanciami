import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma.js";
import { flattenLineItems, getPeriodRange } from "./_helpers.js";

/**
 * Tool per classificare i fornitori per attività di consegna (numero DDT, articoli, quantità).
 * Diverso da supplier_ranking (fatture) perché qui contiamo consegne e articoli, non importi.
 */
export const ddtSupplierRankingTool = new DynamicStructuredTool({
  name: "ddt_supplier_ranking",
  description:
    "Classifica i fornitori per numero di DDT consegnati, articoli totali e quantità totale. " +
    "Usalo quando l'utente chiede 'chi mi consegna di più', 'top fornitori per DDT' o analoghe.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    period: z
      .enum(["month", "quarter", "year", "all"])
      .optional()
      .describe("Periodo di analisi (default: all)"),
    limit: z.number().optional().describe("Numero fornitori da restituire (default: 10)"),
  }),
  func: async ({ userId, period = "all", limit = 10 }) => {
    const { startDate, endDate } = getPeriodRange(period);

    const where: Record<string, unknown> = {
      users: { some: { userId } },
      documentKind: "ddt",
    };
    if (startDate && endDate) {
      where.documentDate = { gte: startDate, lte: endDate };
    }

    const documents = await prisma.document.findMany({
      where,
      select: {
        id: true,
        documentNumber: true,
        documentDate: true,
        fileName: true,
        supplierName: true,
        customerName: true,
        metadata: true,
      },
    });

    const items = flattenLineItems(documents);

    // Aggrega per supplier
    const map = new Map<
      string,
      {
        ddtIds: Set<string>;
        lineItemCount: number;
        totalQuantity: number;
        productCodes: Set<string>;
        lastDate: string | null;
      }
    >();

    for (const doc of documents) {
      if (!map.has(doc.supplierName)) {
        map.set(doc.supplierName, {
          ddtIds: new Set(),
          lineItemCount: 0,
          totalQuantity: 0,
          productCodes: new Set(),
          lastDate: null,
        });
      }
      const entry = map.get(doc.supplierName)!;
      entry.ddtIds.add(doc.id);
      const dateIso = doc.documentDate?.toISOString() || null;
      if (dateIso && (!entry.lastDate || dateIso > entry.lastDate)) {
        entry.lastDate = dateIso;
      }
    }

    for (const it of items) {
      const entry = map.get(it.supplierName);
      if (!entry) continue;
      entry.lineItemCount += 1;
      entry.totalQuantity += it.quantity || 0;
      const code = it.productCode?.trim() || it.description.trim().toLowerCase();
      if (code) entry.productCodes.add(code);
    }

    const totalDdt = documents.length;
    const ranking = Array.from(map.entries())
      .map(([supplierName, entry]) => ({
        supplierName,
        ddtCount: entry.ddtIds.size,
        lineItemCount: entry.lineItemCount,
        totalQuantity: entry.totalQuantity,
        distinctProducts: entry.productCodes.size,
        lastDeliveryDate: entry.lastDate,
        percentageOfDdt:
          totalDdt > 0
            ? ((entry.ddtIds.size / totalDdt) * 100).toFixed(1)
            : "0",
      }))
      .sort((a, b) => {
        if (b.ddtCount !== a.ddtCount) return b.ddtCount - a.ddtCount;
        return b.lineItemCount - a.lineItemCount;
      })
      .slice(0, limit)
      .map((entry, idx) => ({ rank: idx + 1, ...entry }));

    return JSON.stringify({
      period,
      totalDdt,
      totalLineItems: items.length,
      ranking,
    });
  },
});
