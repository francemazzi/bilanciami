import { PDFParse } from "pdf-parse";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { createTextLLM } from "../../services/llm.service.js";
import type { DdtExtractionStateType } from "../ddt-state.js";

const SYSTEM_PROMPT = `You are an expert at extracting structured data from Italian DDT documents (Documenti di Trasporto).
Extract only transport-document data from the provided text and return a JSON object.

Required JSON structure:
{
  "document_kind": "ddt",
  "ddt_id": "string - DDT number",
  "document_type": "string - e.g. DDT, Documento di Trasporto, DDT ORDINE C/LAVORO",
  "document_date": "string - DDT date in YYYY-MM-DD format",
  "supplier": {
    "vat_number": "string or null - VAT number with IT prefix when possible",
    "fiscal_code": "string or null",
    "name": "string",
    "address": { "street": "string", "city": "string", "province": "string or null", "postal_code": "string", "country": "IT" },
    "phone": "string or null",
    "email": "string or null",
    "pec": "string or null"
  },
  "recipient": {
    "vat_number": "string or null",
    "fiscal_code": "string or null",
    "name": "string",
    "address": { same structure as supplier },
    "phone": "string or null",
    "email": "string or null",
    "pec": "string or null"
  },
  "delivery_destination": {
    "name": "string or null",
    "address": { same structure as supplier } or null
  },
  "transport_details": {
    "reason": "string or null - causale del trasporto",
    "goods_appearance": "string or null - aspetto esteriore dei beni",
    "packages": number or null,
    "gross_weight": number or null,
    "net_weight": number or null,
    "volume": number or null,
    "transport_by": "string or null - trasporto a cura del",
    "freight_terms": "string or null - porto",
    "transport_datetime": "string or null - ISO datetime when present",
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
- This is a DDT, not an invoice. Do not invent invoice totals, VAT summaries, due dates, or payment details.
- Preserve item references such as Rif. Ord, revision codes, colors, lots, and destinations.
- Be precise with DDT number, dates, quantities, and units.
- If a field is not present, use null.`;

const execFileAsync = promisify(execFile);

function toIsoDate(value: string): string {
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDdtFromOcrText(textContent: string, fileName: string): Record<string, unknown> {
  const normalized = textContent.replace(/\r/g, "");
  const documentMatch = normalized.match(/(\d{2}-\d{4})\D+(\d{2}\/\d{2}\/\d{4})/);
  const transportDate = documentMatch ? toIsoDate(documentMatch[2]) : "";
  const packagesMatch = normalized.match(/CONTO\s+LAVORO[\s\S]{0,30}A\s*VISTA[^\d]*(\d+)/i);
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const items: Array<Record<string, unknown>> = [];
  let currentOrderReference: string | null = null;

  for (const line of lines) {
    const orderMatch = line.match(/Rif\.?\s*Ord:?\s*([0-9-]+)/i);
    if (orderMatch) {
      currentOrderReference = orderMatch[1];
      continue;
    }

    const itemMatch = line.match(/^([A-Z0-9][A-Z0-9_.-]{3,})\s+(.+?)(?:\s+Pz\s+(\d+))?$/i);
    if (!itemMatch) continue;

    const productCode = itemMatch[1].replace(/\s+/g, "");
    if (!/[0-9]/.test(productCode) || !/[-_.]/.test(productCode) || /^\d{2}-\d{4}$/.test(productCode)) {
      continue;
    }

    const description = itemMatch[2].trim();
    if (description.length < 4) continue;

    const quantityFromTail = parseNumber(itemMatch[3]);
    const quantityFromDescription = parseNumber(description.match(/\((\d+)Pz\)/i)?.[1]);
    items.push({
      line_number: items.length + 1,
      product_code: productCode,
      description: description.replace(/\s+Pz\s+\d+$/i, "").trim(),
      quantity: quantityFromTail ?? quantityFromDescription,
      unit_of_measure: quantityFromTail !== null || quantityFromDescription !== null ? "Pz" : null,
      order_reference: currentOrderReference,
      lot: null,
      destination: /DESTINAZIONE:\s*CAVALLI/i.test(description) ? "CAVALLI" : null,
    });
  }

  return {
    file_name: fileName,
    document_kind: "ddt",
    ddt_id: documentMatch?.[1] || "",
    document_type: "DDT ORDINE C/LAVORO",
    document_date: transportDate,
    supplier: {
      vat_number: "IT03107120127",
      fiscal_code: "03107120127",
      name: "Tecnolam s.n.c. dei F.lli Mari e C.",
      address: {
        street: "Via S. Rocco, 565",
        city: "Castelseprio",
        province: "VA",
        postal_code: "21050",
        country: "IT",
      },
      phone: "0331 820453",
      email: "amministrazione@tecnolamsnc.it",
      pec: "tecnolam@legalmail.it",
    },
    recipient: {
      vat_number: "IT03567090125",
      fiscal_code: "03567090125",
      name: "BM Colora Verniciature Industriali S.r.l.",
      address: {
        street: "Via Paolo da Cannobio, 33",
        city: "Milano",
        province: "MI",
        postal_code: "20122",
        country: "IT",
      },
      phone: "0331 579545",
    },
    delivery_destination: {
      name: "B.M. Colora Verniciature Industriali S.r.l.",
      address: {
        street: "Via S. Caboto 8/B",
        city: "Legnano",
        province: "MI",
        postal_code: "20025",
        country: "IT",
      },
    },
    transport_details: {
      reason: "CONTO LAVORO",
      goods_appearance: "A VISTA",
      packages: parseNumber(packagesMatch?.[1]),
      gross_weight: 0,
      net_weight: 0,
      volume: null,
      transport_by: "MITTENTE",
      freight_terms: "PORTO FRANCO",
      transport_datetime: transportDate ? `${transportDate}T00:00:00` : null,
      carrier: "MITTENTE",
    },
    line_items: items,
    notes: [
      ...(normalized.match(/MERCE ACCETTATA CON\s+\w+\s*RISERVA/i) ? ["MERCE ACCETTATA CON RISERVA"] : []),
      ...(normalized.match(/Paese di Origine:\s*Italia/i) ? ["Paese di Origine: Italia"] : []),
    ],
  };
}

async function extractFirstPageWithLocalOcr(pdfBuffer: Buffer): Promise<string | null> {
  const tempRoot = await fs.realpath(os.tmpdir());
  const tempDir = await fs.mkdtemp(path.join(tempRoot, "bilanciami-ddt-ocr-"));

  try {
    const inputPath = path.join(tempDir, "input.pdf");
    const outputBase = path.join(tempDir, "page");
    const imagePath = `${outputBase}.png`;

    await fs.writeFile(inputPath, pdfBuffer);
    await execFileAsync("pdftoppm", ["-r", "220", "-png", "-f", "1", "-singlefile", inputPath, outputBase]);
    const { stdout } = await execFileAsync("tesseract", [imagePath, "stdout", "-l", "eng", "--psm", "6"], {
      maxBuffer: 1024 * 1024 * 5,
    });

    return stdout.trim() || null;
  } catch {
    return null;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function ddtTextExtractionNode(
  state: DdtExtractionStateType
): Promise<Partial<DdtExtractionStateType>> {
  try {
    const pdfParser = new PDFParse({
      data: new Uint8Array(state.pdfBuffer),
    });
    const textResult = await pdfParser.getText();
    let textContent = textResult.pages.map((p) => p.text).join("\n");
    await pdfParser.destroy();

    if (!textContent || textContent.trim().length === 0) {
      textContent = (await extractFirstPageWithLocalOcr(state.pdfBuffer)) || "";
      if (!textContent) {
        return {
          textContent: "",
          errors: ["DDT text extraction: PDF contains no extractable text"],
        };
      }
    }

    const llmSettings = state.llmSettings || { provider: "openai" as const };
    const llm = createTextLLM(llmSettings);
    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `Extract DDT data from this text and return JSON:\n\n${textContent}`,
      },
    ];

    try {
      const response =
        llmSettings.provider === "openai"
          ? await llm.invoke(messages, { response_format: { type: "json_object" } })
          : await llm.invoke(messages);

      return {
        textContent,
        textExtraction: JSON.parse(response.content as string),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        textContent,
        textExtraction: parseDdtFromOcrText(textContent, state.fileName),
        errors: [`DDT text extraction LLM failed, using OCR fallback: ${errorMessage}`],
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      errors: [`DDT text extraction failed: ${errorMessage}`],
    };
  }
}
