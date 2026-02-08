import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

/**
 * Tool per analizzare spese raggruppate per fornitore/categoria
 * Utile per capire dove vanno i soldi
 */
export const expenseByCategoryTool = new DynamicStructuredTool({
  name: "expense_by_category",
  description:
    "Analizza le spese raggruppate per fornitore. " +
    "Mostra distribuzione spese e confronto con periodo precedente.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    period: z
      .enum(["month", "quarter", "year"])
      .optional()
      .describe("Periodo di analisi (default: month)"),
    limit: z
      .number()
      .optional()
      .describe("Numero categorie da mostrare (default: 10)"),
  }),
  func: async ({ userId, period = "month", limit = 10 }) => {
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    // Calcola periodi corrente e precedente
    if (period === "month") {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === "quarter") {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      currentStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
      currentEnd = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0);
      previousStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
      previousEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);
    } else {
      currentStart = new Date(now.getFullYear(), 0, 1);
      currentEnd = new Date(now.getFullYear(), 11, 31);
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(now.getFullYear() - 1, 11, 31);
    }

    // Spese periodo corrente per fornitore
    const currentExpenses = await prisma.document.groupBy({
      by: ["supplierName"],
      where: {
        users: { some: { userId } },
        documentDate: {
          gte: currentStart,
          lte: currentEnd,
        },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: limit,
    });

    // Spese periodo precedente per confronto
    const previousExpenses = await prisma.document.groupBy({
      by: ["supplierName"],
      where: {
        users: { some: { userId } },
        documentDate: {
          gte: previousStart,
          lte: previousEnd,
        },
      },
      _sum: { totalAmount: true },
    });

    // Mappa precedente per lookup veloce
    const previousMap = new Map(
      previousExpenses.map((e) => [e.supplierName, e._sum.totalAmount || 0])
    );

    // Calcola totali
    const currentTotal = currentExpenses.reduce(
      (sum, e) => sum + (e._sum.totalAmount || 0),
      0
    );
    const previousTotal = previousExpenses.reduce(
      (sum, e) => sum + (e._sum.totalAmount || 0),
      0
    );

    // Costruisci breakdown con confronto
    const breakdown = currentExpenses.map((e) => {
      const currentAmount = e._sum.totalAmount || 0;
      const previousAmount = previousMap.get(e.supplierName) || 0;
      const change = previousAmount > 0
        ? ((currentAmount - previousAmount) / previousAmount) * 100
        : 100;

      return {
        supplier: e.supplierName,
        currentAmount,
        previousAmount,
        invoiceCount: e._count.id,
        percentageOfTotal:
          currentTotal > 0
            ? ((currentAmount / currentTotal) * 100).toFixed(1)
            : "0",
        changePercent: change.toFixed(1),
        trend: change > 5 ? "↑" : change < -5 ? "↓" : "→",
      };
    });

    // Calcola variazione totale
    const totalChange =
      previousTotal > 0
        ? ((currentTotal - previousTotal) / previousTotal) * 100
        : 0;

    return JSON.stringify({
      period,
      currentPeriod: {
        start: currentStart,
        end: currentEnd,
        total: currentTotal,
      },
      previousPeriod: {
        start: previousStart,
        end: previousEnd,
        total: previousTotal,
      },
      totalChange: {
        amount: currentTotal - previousTotal,
        percent: totalChange.toFixed(1),
        trend: totalChange > 5 ? "↑" : totalChange < -5 ? "↓" : "→",
      },
      breakdown,
    });
  },
});
