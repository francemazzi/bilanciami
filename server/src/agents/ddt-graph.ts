import { StateGraph, START, END } from "@langchain/langgraph";
import { DdtExtractionState } from "./ddt-state.js";
import { ddtTextExtractionNode } from "./nodes/ddt-text-extraction.node.js";
import { ddtVisionExtractionNode } from "./nodes/ddt-vision-extraction.node.js";
import { ddtReconciliationNode } from "./nodes/ddt-reconciliation.node.js";
import type { LLMSettings } from "../types/llm-provider.js";

export function createDdtExtractionGraph() {
  const graph = new StateGraph(DdtExtractionState)
    .addNode("extractText", ddtTextExtractionNode)
    .addNode("extractVision", ddtVisionExtractionNode)
    .addNode("reconcile", ddtReconciliationNode)
    .addEdge(START, "extractText")
    .addEdge(START, "extractVision")
    .addEdge("extractText", "reconcile")
    .addEdge("extractVision", "reconcile")
    .addEdge("reconcile", END);

  return graph.compile();
}

let graphInstance: ReturnType<typeof createDdtExtractionGraph> | null = null;

export function getDdtGraph() {
  if (!graphInstance) {
    graphInstance = createDdtExtractionGraph();
  }
  return graphInstance;
}

export async function extractDdt(
  pdfBuffer: Buffer,
  fileName: string,
  llmSettings: LLMSettings
) {
  const graph = getDdtGraph();
  const result = await graph.invoke({
    pdfBuffer,
    fileName,
    llmSettings,
  });

  return {
    ddt: result.reconciledDdt,
    confidence: result.confidence,
    errors: result.errors,
    textContent: result.textContent,
    visionContent: result.visionContent,
  };
}
