/**
 * Export di tutti i tool per l'agente chat contabile
 */

export { overdueInvoicesTool } from "./overdue-invoices.tool.js";
export { supplierRankingTool } from "./supplier-ranking.tool.js";
export { monthlyForecastTool } from "./monthly-forecast.tool.js";
export { paymentReminderTool } from "./payment-reminder.tool.js";
export { customerAnalysisTool } from "./customer-analysis.tool.js";
export { vatSummaryTool } from "./vat-summary.tool.js";
export { expenseByCategoryTool } from "./expense-by-category.tool.js";
export { invoiceSearchTool } from "./invoice-search.tool.js";

// Array di tutti i tool disponibili
import { overdueInvoicesTool } from "./overdue-invoices.tool.js";
import { supplierRankingTool } from "./supplier-ranking.tool.js";
import { monthlyForecastTool } from "./monthly-forecast.tool.js";
import { paymentReminderTool } from "./payment-reminder.tool.js";
import { customerAnalysisTool } from "./customer-analysis.tool.js";
import { vatSummaryTool } from "./vat-summary.tool.js";
import { expenseByCategoryTool } from "./expense-by-category.tool.js";
import { invoiceSearchTool } from "./invoice-search.tool.js";

export const allChatTools = [
  overdueInvoicesTool,
  supplierRankingTool,
  monthlyForecastTool,
  paymentReminderTool,
  customerAnalysisTool,
  vatSummaryTool,
  expenseByCategoryTool,
  invoiceSearchTool,
];
