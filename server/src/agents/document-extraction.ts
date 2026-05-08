import { classifyDocument } from "./document-classifier.js";
import { extractDdt } from "./ddt-graph.js";
import { extractInvoice } from "./invoice-graph.js";
import type { DdtDocument } from "../types/ddt.js";
import type { DocumentClassification, DocumentKind } from "../types/document.js";
import type { Invoice } from "../types/invoice.js";
import type { LLMSettings } from "../types/llm-provider.js";

export interface DocumentExtractionResult {
  documentKind: DocumentKind;
  classification: DocumentClassification;
  invoice?: Invoice | null;
  ddt?: DdtDocument | null;
  confidence: number;
  errors: string[];
}

export async function extractDocument(
  pdfBuffer: Buffer,
  fileName: string,
  llmSettings: LLMSettings
): Promise<DocumentExtractionResult> {
  const classification = await classifyDocument(pdfBuffer, llmSettings);

  if (classification.documentKind === "ddt") {
    const ddtResult = await extractDdt(pdfBuffer, fileName, llmSettings);
    return {
      documentKind: "ddt",
      classification,
      ddt: ddtResult.ddt,
      confidence: Math.min(ddtResult.confidence || 0, classification.confidence || 0),
      errors: ddtResult.errors,
    };
  }

  const invoiceResult = await extractInvoice(pdfBuffer, fileName, llmSettings);
  return {
    documentKind: "invoice",
    classification,
    invoice: invoiceResult.invoice,
    confidence: Math.min(invoiceResult.confidence || 0, classification.confidence || 0),
    errors: invoiceResult.errors,
  };
}
