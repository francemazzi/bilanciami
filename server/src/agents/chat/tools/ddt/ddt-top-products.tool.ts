import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma.js";
import { flattenLineItems, getPeriodRange } from "./_helpers.js";

/**
 * Tool per identificare i prodotti più ricevuti via DDT.
 * Aggrega line_items per codice prodotto (o descrizione se mancante) sommando le quantità.
 */
export const ddtTopProductsTool = new DynamicStructuredTool({
  name: "ddt_top_products",
  description:
    "Classifica i prodotti più ricevuti/ordinati nei DDT per quantità totale e numero di consegne. " +
    "Usalo quando l'utente chiede 'quali prodotti/articoli ho ordinato di più' o analisi sugli ordinati.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    period: z
      .enum(["month", "quarter", "year", "all"])
      .optional()
      .describe("Periodo di analisi (default: all)"),
    supplierName: z
      .string()
      .optional()
      .describe("Filtra solo i DDT di un fornitore specifico (match case-insensitive parziale)"),
    limit: z.number().optional().describe("Numero prodotti da restituire (default: 10)"),
  }),
  func: async ({ userId, period = "all", supplierName, limit = 10 }) => {
    const { startDate, endDate } = getPeriodRange(period);

    const where: Record<string, unknown> = {
      users: { some: { userId } },
      documentKind: "ddt",
    };
    if (startDate && endDate) {
      where.documentDate = { gte: startDate, lte: endDate };
    }
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: "insensitive" };
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

    // Aggrega per codice (o descrizione se codice assente)
    const map = new Map<
      string,
      {
        productCode: string | null;
        description: string;
        totalQuantity: number;
        deliveryCount: number;
        ddtIds: Set<string>;
        suppliers: Set<string>;
        unitOfMeasure: string | null;
        lastDate: string | null;
      }
    >();

    for (const it of items) {
      const key = it.productCode?.trim() || it.description.trim().toLowerCase();
      if (!key) continue;

      const entry = map.get(key);
      if (entry) {
        entry.totalQuantity += it.quantity || 0;
        entry.deliveryCount += 1;
        entry.ddtIds.add(it.documentId);
        entry.suppliers.add(it.supplierName);
        if (
          it.documentDate &&
          (!entry.lastDate || it.documentDate > entry.lastDate)
        ) {
          entry.lastDate = it.documentDate;
        }
      } else {
        map.set(key, {
          productCode: it.productCode,
          description: it.description,
          totalQuantity: it.quantity || 0,
          deliveryCount: 1,
          ddtIds: new Set([it.documentId]),
          suppliers: new Set([it.supplierName]),
          unitOfMeasure: it.unitOfMeasure,
          lastDate: it.documentDate,
        });
      }
    }

    const ranking = Array.from(map.values())
      .sort((a, b) => {
        if (b.totalQuantity !== a.totalQuantity)
          return b.totalQuantity - a.totalQuantity;
        return b.deliveryCount - a.deliveryCount;
      })
      .slice(0, limit)
      .map((entry, idx) => ({
        rank: idx + 1,
        productCode: entry.productCode,
        description: entry.description,
        totalQuantity: entry.totalQuantity,
        unitOfMeasure: entry.unitOfMeasure,
        deliveryCount: entry.deliveryCount,
        ddtCount: entry.ddtIds.size,
        suppliers: Array.from(entry.suppliers),
        lastDeliveryDate: entry.lastDate,
      }));

    return JSON.stringify({
      period,
      supplierFilter: supplierName || null,
      ddtCount: documents.length,
      lineItemCount: items.length,
      ranking,
    });
  },
});
