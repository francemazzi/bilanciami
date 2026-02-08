import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

/**
 * Tool per ricercare fatture
 * Permette ricerca per numero, cliente, fornitore, importo
 */
export const invoiceSearchTool = new DynamicStructuredTool({
  name: "invoice_search",
  description:
    "Cerca fatture per numero, cliente, fornitore o range di importo. " +
    "Utile per trovare fatture specifiche.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    query: z
      .string()
      .optional()
      .describe("Testo da cercare in numero fattura, cliente o fornitore"),
    minAmount: z.number().optional().describe("Importo minimo"),
    maxAmount: z.number().optional().describe("Importo massimo"),
    dateFrom: z
      .string()
      .optional()
      .describe("Data inizio (YYYY-MM-DD)"),
    dateTo: z
      .string()
      .optional()
      .describe("Data fine (YYYY-MM-DD)"),
    limit: z
      .number()
      .optional()
      .describe("Numero massimo risultati (default: 20)"),
  }),
  func: async ({
    userId,
    query,
    minAmount,
    maxAmount,
    dateFrom,
    dateTo,
    limit = 20,
  }) => {
    // Costruisci where clause
    const where: Record<string, unknown> = {
      users: { some: { userId } },
    };

    // Ricerca testuale
    if (query) {
      where.OR = [
        { invoiceId: { contains: query, mode: "insensitive" } },
        { customerName: { contains: query, mode: "insensitive" } },
        { supplierName: { contains: query, mode: "insensitive" } },
      ];
    }

    // Filtri importo
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.totalAmount = {};
      if (minAmount !== undefined) {
        (where.totalAmount as Record<string, number>).gte = minAmount;
      }
      if (maxAmount !== undefined) {
        (where.totalAmount as Record<string, number>).lte = maxAmount;
      }
    }

    // Filtri data
    if (dateFrom || dateTo) {
      where.documentDate = {};
      if (dateFrom) {
        (where.documentDate as Record<string, Date>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.documentDate as Record<string, Date>).lte = new Date(dateTo);
      }
    }

    const invoices = await prisma.document.findMany({
      where,
      select: {
        id: true,
        invoiceId: true,
        customerName: true,
        supplierName: true,
        documentDate: true,
        dueDate: true,
        totalAmount: true,
      },
      orderBy: { documentDate: "desc" },
      take: limit,
    });

    const totalAmount = invoices.reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0
    );

    return JSON.stringify({
      count: invoices.length,
      totalAmount,
      filters: {
        query,
        minAmount,
        maxAmount,
        dateFrom,
        dateTo,
      },
      invoices,
    });
  },
});
