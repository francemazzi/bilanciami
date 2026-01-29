import { PDFParse } from "pdf-parse";
import { ChatOpenAI } from "@langchain/openai";
import type { InvoiceExtractionStateType } from "../state.js";

const SYSTEM_PROMPT = `You are an expert at extracting structured data from Italian invoices (fatture).
Extract all invoice information from the provided text and return it as a JSON object.

Required JSON structure:
{
  "invoice_id": "string - Invoice number/identifier",
  "document_type": "string - Document type (Fattura, TD24, Nota Pro-forma, etc.)",
  "document_date": "string - Invoice date in YYYY-MM-DD format",
  "supplier": {
    "vat_number": "string - VAT number with IT prefix",
    "fiscal_code": "string or null",
    "name": "string - Company/person name",
    "tax_regime": "string or null - e.g., RF01",
    "address": {
      "street": "string",
      "city": "string",
      "province": "string or null - 2 letter code",
      "postal_code": "string",
      "country": "string - IT"
    },
    "phone": "string or null",
    "email": "string or null"
  },
  "customer": {
    "vat_number": "string",
    "fiscal_code": "string or null",
    "name": "string",
    "address": { same structure as supplier },
    "pec": "string or null"
  },
  "line_items": [
    {
      "line_number": number,
      "product_code": "string or null",
      "description": "string",
      "quantity": number,
      "unit_of_measure": "string or null - KG, LT, NR, etc.",
      "unit_price": number,
      "discount": number or null,
      "vat_rate": number or null - percentage like 10 or 22,
      "line_total": number
    }
  ],
  "vat_summary": {
    "vat_exigibility": "string or null - I or D",
    "vat_rates": [
      { "rate": number, "taxable_amount": number, "vat_amount": number }
    ]
  },
  "totals": {
    "total_taxable": number or null,
    "total_vat": number or null,
    "total_amount": number
  },
  "payment_details": {
    "payment_method": "string or null",
    "payment_method_code": "string or null - MP01, MP05, etc.",
    "iban": "string or null",
    "bank_name": "string or null",
    "due_date": "string or null - YYYY-MM-DD",
    "amount": number or null
  },
  "notes": ["array of strings"] or null
}

Important:
- Be precise with numbers and dates
- VAT numbers should include country prefix (e.g., IT01234567890)
- If a field is not present, use null
- Pay attention to Italian invoice terminology:
  - Fattura = Invoice, IVA = VAT, Imponibile = Taxable amount
  - P.IVA = VAT number, C.F. = Fiscal code, Totale = Total`;

export async function textExtractionNode(
  state: InvoiceExtractionStateType
): Promise<Partial<InvoiceExtractionStateType>> {
  try {
    // Extract raw text from PDF using pdf-parse
    const pdfParser = new PDFParse({
      data: new Uint8Array(state.pdfBuffer),
    });
    const textResult = await pdfParser.getText();
    const textContent = textResult.pages.map((p) => p.text).join("\n");

    // Clean up resources
    await pdfParser.destroy();

    if (!textContent || textContent.trim().length === 0) {
      return {
        textContent: "",
        errors: ["Text extraction: PDF contains no extractable text"],
      };
    }

    // Use OpenAI with JSON mode to extract invoice data
    const llm = new ChatOpenAI({
      model: "gpt-4o",
      temperature: 0,
      apiKey: state.openaiApiKey || undefined,
    });

    const response = await llm.invoke(
      [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Extract invoice data from this text and return as JSON:\n\n${textContent}`,
        },
      ],
      {
        response_format: { type: "json_object" },
      }
    );

    const result = JSON.parse(response.content as string);

    return {
      textContent,
      textExtraction: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      errors: [`Text extraction failed: ${errorMessage}`],
    };
  }
}
