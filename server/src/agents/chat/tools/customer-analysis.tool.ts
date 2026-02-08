import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

/**
 * Tool per analizzare lo storico di un cliente
 * Fornisce statistiche su fatture, pagamenti e affidabilita
 */
export const customerAnalysisTool = new DynamicStructuredTool({
  name: "customer_analysis",
  description:
    "Analizza lo storico di un cliente: fatture totali, importi, " +
    "pagamenti in ritardo, affidabilità. Utile per valutare clienti.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    customerName: z.string().describe("Nome del cliente da analizzare"),
  }),
  func: async ({ userId, customerName }) => {
    const now = new Date();

    // Trova tutte le fatture del cliente
    const invoices = await prisma.document.findMany({
      where: {
        users: { some: { userId } },
        customerName: {
          contains: customerName,
        },
      },
      select: {
        id: true,
        invoiceId: true,
        documentDate: true,
        dueDate: true,
        totalAmount: true,
        createdAt: true,
      },
      orderBy: { documentDate: "desc" },
    });

    if (invoices.length === 0) {
      return JSON.stringify({
        found: false,
        message: `Nessuna fattura trovata per il cliente "${customerName}"`,
      });
    }

    // Calcola statistiche
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0
    );
    const avgInvoiceAmount = totalAmount / totalInvoices;

    // Fatture scadute
    const overdueInvoices = invoices.filter(
      (inv) => inv.dueDate && (inv.dueDate as Date) < now
    );
    const overdueCount = overdueInvoices.length;
    const overdueAmount = overdueInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0
    );

    // Prima e ultima fattura
    const firstInvoice = invoices[invoices.length - 1];
    const lastInvoice = invoices[0];

    // Calcola mesi di collaborazione
    const firstDate = firstInvoice.documentDate || firstInvoice.createdAt;
    const monthsActive = Math.floor(
      (now.getTime() - (firstDate as Date).getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    // Indice di affidabilità (0-100)
    // Basato su % fatture scadute e giorni medi di ritardo
    let reliabilityScore = 100;
    if (totalInvoices > 0) {
      const overdueRatio = overdueCount / totalInvoices;
      reliabilityScore = Math.max(0, Math.round((1 - overdueRatio) * 100));
    }

    let reliabilityLabel: string;
    if (reliabilityScore >= 90) reliabilityLabel = "Eccellente";
    else if (reliabilityScore >= 70) reliabilityLabel = "Buona";
    else if (reliabilityScore >= 50) reliabilityLabel = "Media";
    else reliabilityLabel = "Critica";

    // Trend (ultimi 6 mesi vs precedenti)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentInvoices = invoices.filter(
      (inv) => (inv.documentDate as Date) >= sixMonthsAgo
    );
    const olderInvoices = invoices.filter(
      (inv) => (inv.documentDate as Date) < sixMonthsAgo
    );

    const recentTotal = recentInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0
    );
    const olderAvgMonthly =
      olderInvoices.length > 0 && monthsActive > 6
        ? olderInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0) /
          (monthsActive - 6)
        : 0;
    const recentAvgMonthly = recentTotal / 6;

    let trend: string;
    if (olderAvgMonthly === 0) trend = "Nuovo cliente";
    else if (recentAvgMonthly > olderAvgMonthly * 1.1) trend = "In crescita ↑";
    else if (recentAvgMonthly < olderAvgMonthly * 0.9) trend = "In calo ↓";
    else trend = "Stabile →";

    return JSON.stringify({
      found: true,
      customerName,
      summary: {
        totalInvoices,
        totalAmount,
        avgInvoiceAmount: Math.round(avgInvoiceAmount * 100) / 100,
        monthsActive,
        firstInvoiceDate: firstDate,
        lastInvoiceDate: lastInvoice.documentDate,
      },
      overdue: {
        count: overdueCount,
        amount: overdueAmount,
        percentage:
          totalInvoices > 0
            ? ((overdueCount / totalInvoices) * 100).toFixed(1)
            : "0",
      },
      reliability: {
        score: reliabilityScore,
        label: reliabilityLabel,
      },
      trend,
      recentInvoices: recentInvoices.slice(0, 5).map((inv) => ({
        invoiceId: inv.invoiceId,
        date: inv.documentDate,
        amount: inv.totalAmount,
      })),
    });
  },
});
