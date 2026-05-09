import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma.js";

/**
 * Tool per ricercare DDT (Documenti di Trasporto).
 * Permette ricerca per numero, fornitore, codice prodotto e range di date.
 */
export const ddtSearchTool = new DynamicStructuredTool({
  name: "ddt_search",
  description:
    "Cerca DDT (Documenti di Trasporto) per fornitore, numero documento, codice prodotto o range di date. " +
    "Usa questo tool quando l'utente chiede di trovare/elencare DDT specifici.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    supplierName: z
      .string()
      .optional()
      .describe("Nome fornitore (match case-insensitive parziale)"),
    productCode: z
      .string()
      .optional()
      .describe("Filtra DDT che contengono un codice prodotto o descrizione (parziale)"),
    documentNumber: z
      .string()
      .optional()
      .describe("Numero DDT (parziale)"),
    dateFrom: z.string().optional().describe("Data inizio (YYYY-MM-DD)"),
    dateTo: z.string().optional().describe("Data fine (YYYY-MM-DD)"),
    limit: z.number().optional().describe("Numero massimo risultati (default: 20)"),
  }),
  func: async ({
    userId,
    supplierName,
    productCode,
    documentNumber,
    dateFrom,
    dateTo,
    limit = 20,
  }) => {
    const where: Record<string, unknown> = {
      users: { some: { userId } },
      documentKind: "ddt",
    };

    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: "insensitive" };
    }
    if (documentNumber) {
      where.documentNumber = { contains: documentNumber, mode: "insensitive" };
    }
    if (dateFrom || dateTo) {
      where.documentDate = {};
      if (dateFrom)
        (where.documentDate as Record<string, Date>).gte = new Date(dateFrom);
      if (dateTo)
        (where.documentDate as Record<string, Date>).lte = new Date(dateTo);
    }

    let documents = await prisma.document.findMany({
      where,
      select: {
        id: true,
        documentNumber: true,
        documentDate: true,
        supplierName: true,
        customerName: true,
        fileName: true,
        metadata: true,
      },
      orderBy: [{ documentDate: "desc" }, { extractionDate: "desc" }],
      take: limit * 3,
    });

    // Filtra per codice/descrizione prodotto se richiesto (su line_items JSONB)
    if (productCode) {
      const needle = productCode.toLowerCase();
      documents = documents.filter((doc) => {
        const meta = (doc.metadata || {}) as Record<string, unknown>;
        const items = Array.isArray(meta.line_items) ? meta.line_items : [];
        return items.some((raw) => {
          const item = raw as Record<string, unknown>;
          const code = typeof item.product_code === "string" ? item.product_code : "";
          const desc = typeof item.description === "string" ? item.description : "";
          return (
            code.toLowerCase().includes(needle) ||
            desc.toLowerCase().includes(needle)
          );
        });
      });
    }

    documents = documents.slice(0, limit);

    const results = documents.map((doc) => {
      const meta = (doc.metadata || {}) as Record<string, unknown>;
      const items = Array.isArray(meta.line_items) ? meta.line_items : [];
      return {
        id: doc.id,
        ddtNumber: doc.documentNumber,
        date: doc.documentDate?.toISOString() || null,
        supplier: doc.supplierName,
        recipient: doc.customerName,
        fileName: doc.fileName,
        lineItemCount: items.length,
      };
    });

    return JSON.stringify({
      count: results.length,
      filters: { supplierName, productCode, documentNumber, dateFrom, dateTo },
      results,
    });
  },
});
