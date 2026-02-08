import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

/**
 * Tool per calcolare previsioni di incasso/pagamento per mese
 * Analizza fatture con scadenza nel periodo target
 */
export const monthlyForecastTool = new DynamicStructuredTool({
  name: "monthly_forecast",
  description:
    "Calcola le previsioni di incasso o pagamento per un mese specifico. " +
    "Mostra fatture in scadenza e totali attesi.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    month: z
      .number()
      .min(1)
      .max(12)
      .optional()
      .describe("Mese (1-12, default: mese corrente)"),
    year: z.number().optional().describe("Anno (default: anno corrente)"),
  }),
  func: async ({ userId, month, year }) => {
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    // Fatture con scadenza nel mese
    const invoicesDue = await prisma.document.findMany({
      where: {
        users: { some: { userId } },
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        customerName: true,
        supplierName: true,
        invoiceId: true,
        dueDate: true,
        totalAmount: true,
      },
      orderBy: { dueDate: "asc" },
    });

    // Raggruppa per settimana del mese
    const weeklyBreakdown: Record<string, { count: number; amount: number }> = {
      "Settimana 1": { count: 0, amount: 0 },
      "Settimana 2": { count: 0, amount: 0 },
      "Settimana 3": { count: 0, amount: 0 },
      "Settimana 4+": { count: 0, amount: 0 },
    };

    for (const inv of invoicesDue) {
      const day = (inv.dueDate as Date).getDate();
      let week: string;
      if (day <= 7) week = "Settimana 1";
      else if (day <= 14) week = "Settimana 2";
      else if (day <= 21) week = "Settimana 3";
      else week = "Settimana 4+";

      weeklyBreakdown[week].count++;
      weeklyBreakdown[week].amount += inv.totalAmount || 0;
    }

    const totalAmount = invoicesDue.reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0
    );

    // Formatta nome mese in italiano
    const monthNames = [
      "Gennaio",
      "Febbraio",
      "Marzo",
      "Aprile",
      "Maggio",
      "Giugno",
      "Luglio",
      "Agosto",
      "Settembre",
      "Ottobre",
      "Novembre",
      "Dicembre",
    ];

    return JSON.stringify({
      period: `${monthNames[targetMonth - 1]} ${targetYear}`,
      month: targetMonth,
      year: targetYear,
      invoiceCount: invoicesDue.length,
      totalAmount,
      weeklyBreakdown,
      invoices: invoicesDue,
    });
  },
});
