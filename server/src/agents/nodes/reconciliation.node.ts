import { createTextLLM } from "../../services/llm.service.js";
import type { InvoiceExtractionStateType } from "../state.js";
import type { Invoice } from "../../types/invoice.js";

const RECONCILIATION_PROMPT = `You are an expert at reconciling invoice data from multiple extraction sources.
You have two extractions of the same invoice:
1. TEXT EXTRACTION: Extracted from PDF text layer
2. VISION EXTRACTION: Extracted from PDF images using OCR

Your task is to merge them into a single, accurate JSON result following these rules:
- Prefer values that appear in both extractions (they are more reliable)
- For conflicts in visual elements (logos, handwriting, stamps), prefer vision extraction
- For conflicts in precise text data (numbers, codes, IDs), prefer text extraction
- Include all unique fields from both sources
- Ensure dates are in YYYY-MM-DD format
- Ensure VAT numbers include country prefix (e.g., IT01234567890)
- For line items, merge carefully and avoid duplicates
- If totals conflict, recalculate if possible or prefer text extraction

Return the merged invoice data as JSON.`;

export async function reconciliationNode(
  state: InvoiceExtractionStateType
): Promise<Partial<InvoiceExtractionStateType>> {
  const { textExtraction, visionExtraction, fileName, llmSettings } = state;

  // If only one extraction succeeded, use that
  if (!textExtraction && visionExtraction) {
    return {
      reconciledInvoice: {
        ...visionExtraction,
        file_name: fileName,
      } as Invoice,
      confidence: 0.7,
    };
  }

  if (textExtraction && !visionExtraction) {
    return {
      reconciledInvoice: {
        ...textExtraction,
        file_name: fileName,
      } as Invoice,
      confidence: 0.7,
    };
  }

  if (!textExtraction && !visionExtraction) {
    return {
      errors: ["Reconciliation: Both extraction methods failed"],
    };
  }

  try {
    // Both extractions available - use LLM to reconcile
    const settings = llmSettings || { provider: "openai" as const };
    const llm = createTextLLM(settings);

    const messages = [
      {
        role: "system" as const,
        content: RECONCILIATION_PROMPT,
      },
      {
        role: "user" as const,
        content: `Reconcile these two invoice extractions into a single accurate JSON result:

=== TEXT EXTRACTION ===
${JSON.stringify(textExtraction, null, 2)}

=== VISION EXTRACTION ===
${JSON.stringify(visionExtraction, null, 2)}

Provide the merged, most accurate invoice data as JSON.`,
      },
    ];

    // For OpenAI, pass response_format; Ollama already has format set
    const response =
      settings.provider === "openai"
        ? await llm.invoke(messages, {
            response_format: { type: "json_object" },
          })
        : await llm.invoke(messages);

    const result = JSON.parse(response.content as string);

    return {
      reconciledInvoice: {
        ...result,
        file_name: fileName,
      } as Invoice,
      confidence: 0.9,
    };
  } catch (error) {
    // If reconciliation fails, fall back to text extraction (more reliable for data)
    const fallback = textExtraction || visionExtraction;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      reconciledInvoice: fallback
        ? ({
            ...fallback,
            file_name: fileName,
          } as Invoice)
        : null,
      confidence: 0.6,
      errors: [`Reconciliation LLM failed, using fallback: ${errorMessage}`],
    };
  }
}
