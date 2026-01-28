import { ChatOpenAI } from "@langchain/openai";
import { fromBuffer } from "pdf2pic";
import type { InvoiceExtractionStateType } from "../state.js";

const SYSTEM_PROMPT = `You are an expert at extracting structured data from Italian invoices (fatture) using OCR.
Carefully analyze the invoice images and extract all information as a JSON object.

Required JSON structure:
{
  "invoice_id": "string - Invoice number/identifier",
  "document_type": "string - Document type (Fattura, TD24, Nota Pro-forma, etc.)",
  "document_date": "string - Invoice date in YYYY-MM-DD format",
  "supplier": {
    "vat_number": "string - VAT number with IT prefix",
    "fiscal_code": "string or null",
    "name": "string - Company/person name",
    "tax_regime": "string or null",
    "address": {
      "street": "string",
      "city": "string",
      "province": "string or null",
      "postal_code": "string",
      "country": "string"
    },
    "phone": "string or null",
    "email": "string or null"
  },
  "customer": { same structure as supplier, plus "pec": "string or null" },
  "line_items": [
    {
      "line_number": number,
      "product_code": "string or null",
      "description": "string",
      "quantity": number,
      "unit_of_measure": "string or null",
      "unit_price": number,
      "discount": number or null,
      "vat_rate": number or null,
      "line_total": number
    }
  ],
  "totals": {
    "total_taxable": number or null,
    "total_vat": number or null,
    "total_amount": number
  },
  "payment_details": {
    "payment_method": "string or null",
    "iban": "string or null",
    "bank_name": "string or null",
    "due_date": "string or null",
    "amount": number or null
  },
  "notes": ["array of strings"] or null
}

Important:
- Read all text carefully, including small print
- Be precise with numbers and dates
- VAT numbers should include country prefix (e.g., IT01234567890)
- If a field is not clearly visible, use null
- Look for totals at the bottom of the invoice`;

export async function visionExtractionNode(
  state: InvoiceExtractionStateType
): Promise<Partial<InvoiceExtractionStateType>> {
  try {
    // Convert PDF to images using pdf2pic
    // Note: This requires GraphicsMagick or ImageMagick to be installed on the system
    const converter = fromBuffer(state.pdfBuffer, {
      density: 200,
      format: "png",
      width: 2000,
      height: 2800,
    });

    // Convert all pages to base64 images
    const pageImages: string[] = [];
    let pageNum = 1;
    const maxPages = 10;
    const MIN_VALID_BASE64_LENGTH = 1000; // Minimum size for a valid image

    while (pageNum <= maxPages) {
      try {
        const page = await converter(pageNum, { responseType: "base64" });
        if (page.base64 && page.base64.length > MIN_VALID_BASE64_LENGTH) {
          pageImages.push(page.base64);
        } else {
          // Small base64 means empty/invalid page - stop processing
          break;
        }
        pageNum++;
      } catch {
        // No more pages or error reading page
        break;
      }
    }

    if (pageImages.length === 0) {
      return {
        visionContent: "",
        errors: ["Vision extraction: Failed to convert PDF to images (GraphicsMagick/ImageMagick may not be installed)"],
      };
    }

    // Use GPT-4 Vision to extract invoice data
    const llm = new ChatOpenAI({
      model: "gpt-4o",
      temperature: 0,
    });

    // Build image messages for all pages
    const imageMessages = pageImages.map((base64) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:image/png;base64,${base64}`,
        detail: "high" as const,
      },
    }));

    const response = await llm.invoke(
      [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all invoice data from these ${pageImages.length} page(s) of an Italian invoice and return as JSON:`,
            },
            ...imageMessages,
          ],
        },
      ],
      {
        response_format: { type: "json_object" },
      }
    );

    const result = JSON.parse(response.content as string);

    return {
      visionContent: `Extracted from ${pageImages.length} page(s)`,
      visionExtraction: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      errors: [`Vision extraction failed: ${errorMessage}`],
    };
  }
}
