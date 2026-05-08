import { fromBuffer } from "pdf2pic";
import { createVisionLLM } from "../../services/llm.service.js";
import type { DdtExtractionStateType } from "../ddt-state.js";

const SYSTEM_PROMPT = `You are an expert OCR extractor for Italian DDT documents (Documenti di Trasporto).
Carefully analyze the document images and return a JSON object with transport-document data only.

Required JSON structure:
{
  "document_kind": "ddt",
  "ddt_id": "string - DDT number",
  "document_type": "string - e.g. DDT, Documento di Trasporto, DDT ORDINE C/LAVORO",
  "document_date": "string - DDT date in YYYY-MM-DD format",
  "supplier": {
    "vat_number": "string or null",
    "fiscal_code": "string or null",
    "name": "string",
    "address": { "street": "string", "city": "string", "province": "string or null", "postal_code": "string", "country": "IT" },
    "phone": "string or null",
    "email": "string or null",
    "pec": "string or null"
  },
  "recipient": { same structure as supplier },
  "delivery_destination": {
    "name": "string or null",
    "address": { same structure as supplier } or null
  },
  "transport_details": {
    "reason": "string or null",
    "goods_appearance": "string or null",
    "packages": number or null,
    "gross_weight": number or null,
    "net_weight": number or null,
    "volume": number or null,
    "transport_by": "string or null",
    "freight_terms": "string or null",
    "transport_datetime": "string or null",
    "carrier": "string or null"
  },
  "line_items": [
    {
      "line_number": number,
      "product_code": "string or null",
      "description": "string",
      "quantity": number or null,
      "unit_of_measure": "string or null",
      "order_reference": "string or null",
      "lot": "string or null",
      "destination": "string or null"
    }
  ],
  "notes": ["array of strings"] or null
}

Important:
- Treat this document as a DDT, never as an invoice.
- Read table rows, DDT number, date, causale, colli, porto, transport time, signatures area, and item rows.
- Do not invent invoice VAT, payment, or total fields.
- Use null for unreadable fields.`;

export async function ddtVisionExtractionNode(
  state: DdtExtractionStateType
): Promise<Partial<DdtExtractionStateType>> {
  try {
    const converter = fromBuffer(state.pdfBuffer, {
      density: 200,
      format: "png",
      width: 2000,
      height: 2800,
    });

    const pageImages: string[] = [];
    let pageNum = 1;
    const maxPages = 10;
    const minValidBase64Length = 1000;

    while (pageNum <= maxPages) {
      try {
        const page = await converter(pageNum, { responseType: "base64" });
        if (page.base64 && page.base64.length > minValidBase64Length) {
          pageImages.push(page.base64);
        } else {
          break;
        }
        pageNum++;
      } catch {
        break;
      }
    }

    if (pageImages.length === 0) {
      return {
        visionContent: "",
        errors: ["DDT vision extraction: Failed to convert PDF to images"],
      };
    }

    const llmSettings = state.llmSettings || { provider: "openai" as const };
    const llm = createVisionLLM(llmSettings);
    const imageMessages = pageImages.map((base64) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:image/png;base64,${base64}`,
        detail: "high" as const,
      },
    }));

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `Extract all DDT data from these ${pageImages.length} page(s) and return JSON:`,
          },
          ...imageMessages,
        ],
      },
    ];

    const response =
      llmSettings.provider === "openai"
        ? await llm.invoke(messages, { response_format: { type: "json_object" } })
        : await llm.invoke(messages);

    return {
      visionContent: `Extracted DDT from ${pageImages.length} page(s)`,
      visionExtraction: JSON.parse(response.content as string),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      errors: [`DDT vision extraction failed: ${errorMessage}`],
    };
  }
}
