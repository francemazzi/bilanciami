import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

/**
 * Tool per trovare fatture scadute
 * Restituisce lista fatture con dueDate nel passato, con calcolo giorni ritardo
 */
export const overdueInvoicesTool = new DynamicStructuredTool({
  name: "overdue_invoices",
  description:
    "Trova le fatture scadute (con data scadenza nel passato) per un utente. " +
    "Utile per identificare clienti da sollecitare.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    daysOverdue: z
      .number()
      .optional()
      .describe("Filtro giorni minimi di ritardo (default: 0)"),
    limit: z
      .number()
      .optional()
      .describe("Numero massimo di risultati (default: 50)"),
  }),
  func: async ({ userId, daysOverdue = 0, limit = 50 }) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

    const overdueInvoices = await prisma.document.findMany({
      where: {
        users: {
          some: { userId },
        },
        dueDate: {
          lt: cutoffDate,
          not: null,
        },
      },
      select: {
        id: true,
        customerName: true,
        supplierName: true,
        invoiceId: true,
        dueDate: true,
        totalAmount: true,
        documentDate: true,
      },
      orderBy: { dueDate: "asc" },
      take: limit,
    });

    // Calcola giorni di ritardo per ogni fattura
    const now = new Date();
    const invoicesWithDelay = overdueInvoices.map((inv) => {
      const dueDate = inv.dueDate as Date;
      const daysLate = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...inv,
        daysLate,
      };
    });

    const totalOverdue = overdueInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0
    );

    return JSON.stringify({
      count: overdueInvoices.length,
      totalAmount: totalOverdue,
      invoices: invoicesWithDelay,
    });
  },
});
