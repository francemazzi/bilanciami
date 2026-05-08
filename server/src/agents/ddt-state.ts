import { Annotation } from "@langchain/langgraph";
import type { LLMSettings } from "../types/llm-provider.js";
import type { DdtDocument } from "../types/ddt.js";

type ExtractionResult = Record<string, unknown>;

export const DdtExtractionState = Annotation.Root({
  pdfBuffer: Annotation<Buffer>,
  fileName: Annotation<string>,
  llmSettings: Annotation<LLMSettings | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

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

  reconciledDdt: Annotation<DdtDocument | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

  errors: Annotation<string[]>({
    default: () => [],
    reducer: (existing, newErrors) => [...existing, ...newErrors],
  }),
  confidence: Annotation<number>({
    default: () => 0,
    reducer: (_, newVal) => newVal,
  }),
});

export type DdtExtractionStateType = typeof DdtExtractionState.State;
