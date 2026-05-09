import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma.js";
import { flattenLineItems, getPeriodRange } from "./_helpers.js";

/**
 * Tool per il catalogo dei prodotti consegnati da un fornitore specifico.
 * Restituisce prodotti distinti con quantità totale e ultima data di ricezione.
 */
export const ddtProductCatalogTool = new DynamicStructuredTool({
  name: "ddt_product_catalog",
  description:
    "Restituisce il catalogo dei prodotti distinti consegnati da un fornitore (via DDT), " +
    "con quantità totale e data ultima ricezione. " +
    "Usalo quando l'utente chiede 'che prodotti mi consegna X', 'catalogo fornitore', 'cosa ho ricevuto da Y'.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    supplierName: z
      .string()
      .describe("Nome fornitore (match parziale, case-insensitive)"),
    period: z
      .enum(["month", "quarter", "year", "all"])
      .optional()
      .describe("Periodo di analisi (default: all)"),
    limit: z.number().optional().describe("Numero prodotti da restituire (default: 50)"),
  }),
  func: async ({ userId, supplierName, period = "all", limit = 50 }) => {
    const { startDate, endDate } = getPeriodRange(period);

    const where: Record<string, unknown> = {
      users: { some: { userId } },
      documentKind: "ddt",
      supplierName: { contains: supplierName, mode: "insensitive" },
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
      orderBy: { documentDate: "desc" },
    });

    if (documents.length === 0) {
      return JSON.stringify({
        supplierFilter: supplierName,
        period,
        ddtCount: 0,
        catalog: [],
      });
    }

    const items = flattenLineItems(documents);

    const map = new Map<
      string,
      {
        productCode: string | null;
        description: string;
        unitOfMeasure: string | null;
        totalQuantity: number;
        deliveryCount: number;
        ddtIds: Set<string>;
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
          unitOfMeasure: it.unitOfMeasure,
          totalQuantity: it.quantity || 0,
          deliveryCount: 1,
          ddtIds: new Set([it.documentId]),
          lastDate: it.documentDate,
        });
      }
    }

    const catalog = Array.from(map.values())
      .sort((a, b) => {
        const dateA = a.lastDate || "";
        const dateB = b.lastDate || "";
        return dateB.localeCompare(dateA);
      })
      .slice(0, limit)
      .map((entry) => ({
        productCode: entry.productCode,
        description: entry.description,
        unitOfMeasure: entry.unitOfMeasure,
        totalQuantity: entry.totalQuantity,
        deliveryCount: entry.deliveryCount,
        ddtCount: entry.ddtIds.size,
        lastDeliveryDate: entry.lastDate,
      }));

    const distinctSuppliers = Array.from(
      new Set(documents.map((d) => d.supplierName))
    );

    return JSON.stringify({
      supplierFilter: supplierName,
      matchedSuppliers: distinctSuppliers,
      period,
      ddtCount: documents.length,
      distinctProducts: map.size,
      catalog,
    });
  },
});
