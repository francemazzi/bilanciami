import { Annotation } from "@langchain/langgraph";
import type { Invoice } from "../types/invoice.js";

// Using Record<string, unknown> for intermediate extraction results
// since the Zod schema outputs nullable fields
type ExtractionResult = Record<string, unknown>;

export const InvoiceExtractionState = Annotation.Root({
  // Input
  pdfBuffer: Annotation<Buffer>,
  fileName: Annotation<string>,

  // Intermediate results from parallel extraction
  textContent: Annotation<string | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),
  visionContent: Annotation<string | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),
  textExtraction: Annotation<ExtractionResult | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),
  visionExtraction: Annotation<ExtractionResult | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

  // Final result
  reconciledInvoice: Annotation<Invoice | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

  // Metadata
  errors: Annotation<string[]>({
    default: () => [],
    reducer: (existing, newErrors) => [...existing, ...newErrors],
  }),
  confidence: Annotation<number>({
    default: () => 0,
    reducer: (_, newVal) => newVal,
  }),
});

export type InvoiceExtractionStateType = typeof InvoiceExtractionState.State;
