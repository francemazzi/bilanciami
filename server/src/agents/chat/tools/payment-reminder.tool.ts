import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";

/**
 * Tool per generare testi di sollecito pagamento
 * Crea messaggi personalizzati per clienti con fatture scadute
 */
export const paymentReminderTool = new DynamicStructuredTool({
  name: "payment_reminder",
  description:
    "Genera un testo di sollecito pagamento per un cliente specifico. " +
    "Include dettagli fatture scadute e importo totale dovuto.",
  schema: z.object({
    userId: z.string().describe("ID dell'utente"),
    customerName: z.string().describe("Nome del cliente da sollecitare"),
    tone: z
      .enum(["cordiale", "formale", "urgente"])
      .optional()
      .describe("Tono del messaggio (default: formale)"),
  }),
  func: async ({ userId, customerName, tone = "formale" }) => {
    // Trova fatture scadute del cliente
    const overdueInvoices = await prisma.document.findMany({
      where: {
        users: { some: { userId } },
        customerName: {
          contains: customerName,
        },
        dueDate: {
          lt: new Date(),
        },
      },
      select: {
        invoiceId: true,
        documentDate: true,
        dueDate: true,
        totalAmount: true,
      },
      orderBy: { dueDate: "asc" },
    });

    if (overdueInvoices.length === 0) {
      return JSON.stringify({
        found: false,
        message: `Nessuna fattura scaduta trovata per il cliente "${customerName}"`,
      });
    }

    const totalDue = overdueInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0
    );

    // Calcola giorni massimi di ritardo
    const now = new Date();
    const maxDaysLate = Math.max(
      ...overdueInvoices.map((inv) =>
        Math.floor(
          (now.getTime() - (inv.dueDate as Date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    );

    // Genera testo sollecito basato sul tono
    let greeting: string;
    let closing: string;
    let urgencyText: string;

    switch (tone) {
      case "cordiale":
        greeting = `Gentile ${customerName},`;
        closing =
          "Rimaniamo a disposizione per qualsiasi chiarimento.\n\nCordiali saluti";
        urgencyText =
          "Le ricordiamo gentilmente che risultano in sospeso le seguenti fatture:";
        break;
      case "urgente":
        greeting = `Spett.le ${customerName},`;
        closing =
          "In assenza di riscontro entro 7 giorni, saremo costretti ad avviare le procedure di recupero crediti.\n\nDistinti saluti";
        urgencyText =
          "SOLLECITO URGENTE: Risultano inevase da oltre " +
          maxDaysLate +
          " giorni le seguenti fatture:";
        break;
      default: // formale
        greeting = `Spett.le ${customerName},`;
        closing =
          "La preghiamo di provvedere al pagamento entro e non oltre 15 giorni dalla presente.\n\nDistinti saluti";
        urgencyText =
          "Con la presente desideriamo ricordarLe che risultano non saldate le seguenti fatture:";
    }

    // Formatta lista fatture
    const invoiceList = overdueInvoices
      .map((inv) => {
        const dueDate = (inv.dueDate as Date).toLocaleDateString("it-IT");
        const amount = (inv.totalAmount || 0).toLocaleString("it-IT", {
          minimumFractionDigits: 2,
        });
        const daysLate = Math.floor(
          (now.getTime() - (inv.dueDate as Date).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return `- Fattura n. ${inv.invoiceId}: € ${amount} (scaduta il ${dueDate}, ${daysLate} giorni di ritardo)`;
      })
      .join("\n");

    const totalFormatted = totalDue.toLocaleString("it-IT", {
      minimumFractionDigits: 2,
    });

    const reminderText = `${greeting}

${urgencyText}

${invoiceList}

TOTALE DOVUTO: € ${totalFormatted}

${closing}`;

    return JSON.stringify({
      found: true,
      customerName,
      invoiceCount: overdueInvoices.length,
      totalDue,
      maxDaysLate,
      tone,
      reminderText,
    });
  },
});
