import { PDFParse } from "pdf-parse";
import { fromBuffer } from "pdf2pic";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { createVisionLLM } from "../services/llm.service.js";
import type { DocumentClassification, DocumentKind } from "../types/document.js";
import type { LLMSettings } from "../types/llm-provider.js";

const DDT_PATTERNS = [
  /\bddt\b/i,
  /d\.?\s*d\.?\s*t\.?/i,
  /documento\s+di\s+trasporto/i,
  /causale\s+del\s+trasporto/i,
  /aspetto\s+esteriore\s+dei\s+beni/i,
  /trasporto\s+a\s+cura/i,
];

const INVOICE_PATTERNS = [
  /\bfattura\b/i,
  /\btd\d{2}\b/i,
  /riepilogo\s+iva/i,
  /imponibile/i,
  /scadenza\s+pagamento/i,
  /modalit[aà]\s+di\s+pagamento/i,
];

const CLASSIFIER_PROMPT = `You classify Italian business PDFs.
Return JSON only with this structure:
{
  "document_kind": "invoice" | "ddt",
  "confidence": number between 0 and 1,
  "reason": "short reason"
}

Rules:
- DDT means Documento di Trasporto, D.D.T., DDT ORDINE C/LAVORO, transport document.
- Invoice means fattura, nota di credito, pro-forma invoice, electronic invoice, TDxx fiscal document.
- If the image clearly says DDT or Documento di Trasporto, classify as "ddt" immediately even if parties and line items look similar to invoices.
- If uncertain, choose "invoice" for backwards compatibility.`;

const execFileAsync = promisify(execFile);

function heuristicClassify(text: string): DocumentClassification | null {
  const ddtScore = DDT_PATTERNS.filter((pattern) => pattern.test(text)).length;
  const invoiceScore = INVOICE_PATTERNS.filter((pattern) => pattern.test(text)).length;

  if (ddtScore > 0 && ddtScore >= invoiceScore) {
    return {
      documentKind: "ddt",
      confidence: Math.min(0.95, 0.75 + ddtScore * 0.05),
      reason: "DDT keywords found in text layer",
    };
  }

  if (invoiceScore > 0 && invoiceScore > ddtScore) {
    return {
      documentKind: "invoice",
      confidence: Math.min(0.95, 0.75 + invoiceScore * 0.05),
      reason: "Invoice keywords found in text layer",
    };
  }

  return null;
}

async function extractText(pdfBuffer: Buffer): Promise<string> {
  const pdfParser = new PDFParse({
    data: new Uint8Array(pdfBuffer),
  });
  try {
    const textResult = await pdfParser.getText();
    return textResult.pages.map((p) => p.text).join("\n");
  } finally {
    await pdfParser.destroy();
  }
}

async function classifyWithLocalOcr(pdfBuffer: Buffer): Promise<DocumentClassification | null> {
  const tempRoot = await fs.realpath(os.tmpdir());
  const tempDir = await fs.mkdtemp(path.join(tempRoot, "bilanciami-ddt-classify-"));

  try {
    const inputPath = path.join(tempDir, "input.pdf");
    const outputBase = path.join(tempDir, "page");
    const imagePath = `${outputBase}.png`;

    await fs.writeFile(inputPath, pdfBuffer);
    await execFileAsync("pdftoppm", ["-r", "220", "-png", "-f", "1", "-singlefile", inputPath, outputBase]);
    const { stdout } = await execFileAsync("tesseract", [imagePath, "stdout", "-l", "eng", "--psm", "6"], {
      maxBuffer: 1024 * 1024 * 5,
    });

    return heuristicClassify(stdout);
  } catch {
    return null;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function classifyWithVision(
  pdfBuffer: Buffer,
  llmSettings: LLMSettings
): Promise<DocumentClassification> {
  const converter = fromBuffer(pdfBuffer, {
    density: 160,
    format: "png",
    width: 1600,
    height: 2200,
  });
  const firstPage = await converter(1, { responseType: "base64" });

  if (!firstPage.base64) {
    return {
      documentKind: "invoice",
      confidence: 0.4,
      reason: "Unable to render first page for classification",
    };
  }

  const llm = createVisionLLM(llmSettings);
  const messages = [
    { role: "system" as const, content: CLASSIFIER_PROMPT },
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: "Classify this first page as invoice or ddt.",
        },
        {
          type: "image_url" as const,
          image_url: {
            url: `data:image/png;base64,${firstPage.base64}`,
            detail: "high" as const,
          },
        },
      ],
    },
  ];

  const response =
    llmSettings.provider === "openai"
      ? await llm.invoke(messages, { response_format: { type: "json_object" } })
      : await llm.invoke(messages);

  const parsed = JSON.parse(response.content as string) as {
    document_kind?: string;
    confidence?: number;
    reason?: string;
  };
  const documentKind: DocumentKind = parsed.document_kind === "ddt" ? "ddt" : "invoice";

  return {
    documentKind,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
    reason: parsed.reason,
  };
}

export async function classifyDocument(
  pdfBuffer: Buffer,
  llmSettings: LLMSettings
): Promise<DocumentClassification> {
  try {
    const text = await extractText(pdfBuffer);
    const heuristic = heuristicClassify(text);
    if (heuristic) return heuristic;
  } catch {
    // Scanned PDFs often have no text layer; fall through to visual classification.
  }

  const ocrClassification = await classifyWithLocalOcr(pdfBuffer);
  if (ocrClassification) return ocrClassification;

  try {
    return await classifyWithVision(pdfBuffer, llmSettings);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      documentKind: "invoice",
      confidence: 0.3,
      reason: `Classification fallback to invoice: ${reason}`,
    };
  }
}
