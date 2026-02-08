import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

/**
 * Tool per classificare fornitori per volume di fatturato
 * Utile per identificare i fornitori principali
 */
export const supplierRankingTool = new DynamicStructuredTool({
  name: "supplier_ranking",
  description:
    "Classifica i fornitori per volume di fatturato. " +
    "Utile per identificare i fornitori principali e analizzare le spese.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    limit: z
      .number()
      .optional()
      .describe("Numero di fornitori da restituire (default: 10)"),
    period: z
      .enum(["month", "quarter", "year", "all"])
      .optional()
      .describe("Periodo di analisi (default: all)"),
  }),
  func: async ({ userId, limit = 10, period = "all" }) => {
    // Calcola data inizio periodo
    const now = new Date();
    let startDate: Date | null = null;

    if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "quarter") {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStart, 1);
    } else if (period === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    // Query per aggregare per fornitore
    const whereClause: Record<string, unknown> = {
      users: { some: { userId } },
    };

    if (startDate) {
      whereClause.documentDate = { gte: startDate };
    }

    const suppliers = await prisma.document.groupBy({
      by: ["supplierName"],
      where: whereClause,
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: limit,
    });

    // Calcola percentuale sul totale
    const totalSpending = suppliers.reduce(
      (sum, s) => sum + (s._sum.totalAmount || 0),
      0
    );

    const ranking = suppliers.map((s, idx) => ({
      rank: idx + 1,
      supplierName: s.supplierName,
      totalAmount: s._sum.totalAmount || 0,
      invoiceCount: s._count.id,
      percentage:
        totalSpending > 0
          ? (((s._sum.totalAmount || 0) / totalSpending) * 100).toFixed(1)
          : "0",
    }));

    return JSON.stringify({
      period,
      totalSpending,
      ranking,
    });
  },
});
