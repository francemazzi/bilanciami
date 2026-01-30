import { StateGraph, START, END } from "@langchain/langgraph";
import { InvoiceExtractionState } from "./state.js";
import { textExtractionNode } from "./nodes/text-extraction.node.js";
import { visionExtractionNode } from "./nodes/vision-extraction.node.js";
import { reconciliationNode } from "./nodes/reconciliation.node.js";
import type { LLMSettings } from "../types/llm-provider.js";

/**
 * Creates the invoice extraction LangGraph workflow.
 *
 * The workflow executes text and vision extraction in parallel,
 * then reconciles the results into a single invoice output.
 *
 * Graph structure:
 *
 *                  START
 *                    │
 *         ┌─────────┴─────────┐
 *         │                   │
 *         ▼                   ▼
 *     extractText       extractVision
 *         │                   │
 *         └─────────┬─────────┘
 *                   │
 *                   ▼
 *              reconcile
 *                   │
 *                   ▼
 *                  END
 */
export function createInvoiceExtractionGraph() {
  const graph = new StateGraph(InvoiceExtractionState)
    // Add nodes (names must differ from state attributes)
    .addNode("extractText", textExtractionNode)
    .addNode("extractVision", visionExtractionNode)
    .addNode("reconcile", reconciliationNode)

    // Parallel extraction: START fans out to both extraction nodes
    .addEdge(START, "extractText")
    .addEdge(START, "extractVision")

    // Both extraction nodes converge to reconciliation
    .addEdge("extractText", "reconcile")
    .addEdge("extractVision", "reconcile")

    // Reconciliation outputs the final result
    .addEdge("reconcile", END);

  return graph.compile();
}

// Singleton instance for reuse
let graphInstance: ReturnType<typeof createInvoiceExtractionGraph> | null =
  null;

/**
 * Returns a singleton instance of the invoice extraction graph.
 * The graph is created once and reused for all extraction requests.
 */
export function getInvoiceGraph() {
  if (!graphInstance) {
    graphInstance = createInvoiceExtractionGraph();
  }
  return graphInstance;
}

/**
 * Extract invoice data from a PDF buffer.
 *
 * @param pdfBuffer - The PDF file as a Buffer
 * @param fileName - The original filename of the PDF
 * @param llmSettings - LLM settings including provider and model configuration
 * @returns The extracted invoice data and metadata
 */
export async function extractInvoice(
  pdfBuffer: Buffer,
  fileName: string,
  llmSettings: LLMSettings
) {
  const graph = getInvoiceGraph();

  const result = await graph.invoke({
    pdfBuffer,
    fileName,
    llmSettings,
  });

  return {
    invoice: result.reconciledInvoice,
    confidence: result.confidence,
    errors: result.errors,
    textContent: result.textContent,
    visionContent: result.visionContent,
  };
}
