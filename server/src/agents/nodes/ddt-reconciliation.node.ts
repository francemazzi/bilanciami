import { createTextLLM } from "../../services/llm.service.js";
import type { DdtExtractionStateType } from "../ddt-state.js";
import type { DdtDocument } from "../../types/ddt.js";

const RECONCILIATION_PROMPT = `You are an expert at reconciling DDT data from multiple extraction sources.
You have two extractions of the same Italian DDT (Documento di Trasporto):
1. TEXT EXTRACTION: Extracted from the PDF text layer
2. VISION EXTRACTION: Extracted from rendered document images

Merge them into one accurate JSON result:
- The final result must have "document_kind": "ddt".
- Prefer values that appear in both sources.
- For line items and table data, prefer vision if text order is noisy.
- Preserve product codes, revisions, colors, order references, lots, destinations, quantities, and units.
- Do not add invoice-only fields such as VAT summaries, due dates, payment details, or totals.
- Ensure dates are in YYYY-MM-DD format and transport datetime is ISO-like when possible.

Return only the merged DDT JSON.`;

function withDefaults(data: Record<string, unknown>, fileName: string): DdtDocument {
  return {
    ...data,
    file_name: fileName,
    document_kind: "ddt",
    line_items: Array.isArray(data.line_items) ? data.line_items : [],
  } as DdtDocument;
}

export async function ddtReconciliationNode(
  state: DdtExtractionStateType
): Promise<Partial<DdtExtractionStateType>> {
  const { textExtraction, visionExtraction, fileName, llmSettings } = state;

  if (!textExtraction && visionExtraction) {
    return {
      reconciledDdt: withDefaults(visionExtraction, fileName),
      confidence: 0.75,
    };
  }

  if (textExtraction && !visionExtraction) {
    return {
      reconciledDdt: withDefaults(textExtraction, fileName),
      confidence: 0.65,
    };
  }

  if (!textExtraction && !visionExtraction) {
    return {
      errors: ["DDT reconciliation: Both extraction methods failed"],
    };
  }

  try {
    const settings = llmSettings || { provider: "openai" as const };
    const llm = createTextLLM(settings);
    const messages = [
      { role: "system" as const, content: RECONCILIATION_PROMPT },
      {
        role: "user" as const,
        content: `Reconcile these two DDT extractions into a single accurate JSON result:

=== TEXT EXTRACTION ===
${JSON.stringify(textExtraction, null, 2)}

=== VISION EXTRACTION ===
${JSON.stringify(visionExtraction, null, 2)}

Provide the merged DDT data as JSON.`,
      },
    ];

    const response =
      settings.provider === "openai"
        ? await llm.invoke(messages, { response_format: { type: "json_object" } })
        : await llm.invoke(messages);

    const result = JSON.parse(response.content as string);
    return {
      reconciledDdt: withDefaults(result, fileName),
      confidence: 0.9,
    };
  } catch (error) {
    const fallback = textExtraction || visionExtraction;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      reconciledDdt: fallback ? withDefaults(fallback, fileName) : null,
      confidence: 0.6,
      errors: [`DDT reconciliation LLM failed, using fallback: ${errorMessage}`],
    };
  }
}
