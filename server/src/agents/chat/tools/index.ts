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

// Tool DDT
export { ddtSearchTool } from "./ddt/ddt-search.tool.js";
export { ddtTopProductsTool } from "./ddt/ddt-top-products.tool.js";
export { ddtSupplierRankingTool } from "./ddt/ddt-supplier-ranking.tool.js";
export { ddtArticleHistoryTool } from "./ddt/ddt-article-history.tool.js";
export { ddtPeriodAnalysisTool } from "./ddt/ddt-period-analysis.tool.js";
export { ddtProductCatalogTool } from "./ddt/ddt-product-catalog.tool.js";

// Array di tutti i tool disponibili
import { overdueInvoicesTool } from "./overdue-invoices.tool.js";
import { supplierRankingTool } from "./supplier-ranking.tool.js";
import { monthlyForecastTool } from "./monthly-forecast.tool.js";
import { paymentReminderTool } from "./payment-reminder.tool.js";
import { customerAnalysisTool } from "./customer-analysis.tool.js";
import { vatSummaryTool } from "./vat-summary.tool.js";
import { expenseByCategoryTool } from "./expense-by-category.tool.js";
import { invoiceSearchTool } from "./invoice-search.tool.js";
import { ddtSearchTool } from "./ddt/ddt-search.tool.js";
import { ddtTopProductsTool } from "./ddt/ddt-top-products.tool.js";
import { ddtSupplierRankingTool } from "./ddt/ddt-supplier-ranking.tool.js";
import { ddtArticleHistoryTool } from "./ddt/ddt-article-history.tool.js";
import { ddtPeriodAnalysisTool } from "./ddt/ddt-period-analysis.tool.js";
import { ddtProductCatalogTool } from "./ddt/ddt-product-catalog.tool.js";

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

/**
 * Tool dedicati al branch DDT del grafo chat.
 * Vengono passati al nodo ddtToolCalling tramite llm.bindTools().
 */
export const ddtTools = [
  ddtSearchTool,
  ddtTopProductsTool,
  ddtSupplierRankingTool,
  ddtArticleHistoryTool,
  ddtPeriodAnalysisTool,
  ddtProductCatalogTool,
];
