import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma.js";
import { flattenLineItems } from "./_helpers.js";

/**
 * Tool per cronologia consegne di un articolo specifico.
 * Restituisce i line items che corrispondono a un codice o descrizione, ordinati per data desc.
 */
export const ddtArticleHistoryTool = new DynamicStructuredTool({
  name: "ddt_article_history",
  description:
    "Restituisce lo storico consegne di un articolo specifico (per codice prodotto o descrizione). " +
    "Usalo quando l'utente chiede 'storico/cronologia di un articolo', 'quando ho ricevuto X', 'dove ho ordinato Y'.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    productQuery: z
      .string()
      .describe(
        "Codice prodotto o descrizione (parziale, case-insensitive) dell'articolo da cercare"
      ),
    supplierName: z
      .string()
      .optional()
      .describe("Filtra solo le consegne di un fornitore specifico"),
    dateFrom: z.string().optional().describe("Data inizio (YYYY-MM-DD)"),
    dateTo: z.string().optional().describe("Data fine (YYYY-MM-DD)"),
    limit: z.number().optional().describe("Numero massimo righe (default: 50)"),
  }),
  func: async ({
    userId,
    productQuery,
    supplierName,
    dateFrom,
    dateTo,
    limit = 50,
  }) => {
    const where: Record<string, unknown> = {
      users: { some: { userId } },
      documentKind: "ddt",
    };
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: "insensitive" };
    }
    if (dateFrom || dateTo) {
      where.documentDate = {};
      if (dateFrom)
        (where.documentDate as Record<string, Date>).gte = new Date(dateFrom);
      if (dateTo)
        (where.documentDate as Record<string, Date>).lte = new Date(dateTo);
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
      orderBy: [{ documentDate: "desc" }, { extractionDate: "desc" }],
    });

    const allItems = flattenLineItems(documents);
    const needle = productQuery.toLowerCase();
    const matches = allItems.filter((it) => {
      const code = (it.productCode || "").toLowerCase();
      const desc = it.description.toLowerCase();
      return code.includes(needle) || desc.includes(needle);
    });

    const sorted = matches
      .sort((a, b) => {
        const da = a.documentDate || "";
        const db = b.documentDate || "";
        return db.localeCompare(da);
      })
      .slice(0, limit);

    const totalQuantity = sorted.reduce((s, it) => s + (it.quantity || 0), 0);
    const distinctSuppliers = new Set(sorted.map((it) => it.supplierName));

    return JSON.stringify({
      productQuery,
      filters: { supplierName, dateFrom, dateTo },
      matchCount: sorted.length,
      totalQuantity,
      distinctSuppliers: Array.from(distinctSuppliers),
      history: sorted,
    });
  },
});
