import type { FastifyInstance, FastifyRequest } from "fastify";
import { extractInvoice } from "../agents/invoice-graph.js";
import type { Invoice } from "../types/invoice.js";

interface ExtractionResult {
  file_name: string;
  success: boolean;
  invoice?: Invoice;
  errors?: string[];
  confidence?: number;
}

export async function invoiceRoutes(app: FastifyInstance) {
  /**
   * POST /invoices/extract
   * Upload one or more PDF files to extract structured invoice data
   */
  app.post(
    "/invoices/extract",
    {
      schema: {
        summary: "Extract invoice data from PDF files",
        description:
          "Upload one or more PDF files to extract structured invoice data using AI-powered text and vision extraction",
        consumes: ["multipart/form-data"],
        response: {
          200: {
            description: "Successful extraction",
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    file_name: { type: "string" },
                    success: { type: "boolean" },
                    invoice: { type: "object", additionalProperties: true },
                    errors: {
                      type: "array",
                      items: { type: "string" },
                    },
                    confidence: { type: "number" },
                  },
                },
              },
              total_processed: { type: "number" },
              successful: { type: "number" },
              failed: { type: "number" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest) => {
      const parts = request.parts();
      const results: ExtractionResult[] = [];

      for await (const part of parts) {
        if (part.type === "file") {
          // Accept PDF files
          if (
            part.mimetype === "application/pdf" ||
            part.filename?.toLowerCase().endsWith(".pdf")
          ) {
            const buffer = await part.toBuffer();

            try {
              app.log.info(`Processing file: ${part.filename}`);

              const extractionResult = await extractInvoice(
                buffer,
                part.filename || "unknown.pdf"
              );

              results.push({
                file_name: part.filename || "unknown.pdf",
                success: !!extractionResult.invoice,
                invoice: extractionResult.invoice || undefined,
                errors:
                  extractionResult.errors.length > 0
                    ? extractionResult.errors
                    : undefined,
                confidence: extractionResult.confidence,
              });

              app.log.info(
                `Completed processing: ${part.filename} (confidence: ${extractionResult.confidence})`
              );
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              app.log.error(`Failed to process ${part.filename}: ${errorMessage}`);

              results.push({
                file_name: part.filename || "unknown.pdf",
                success: false,
                errors: [`Processing failed: ${errorMessage}`],
              });
            }
          } else {
            results.push({
              file_name: part.filename || "unknown",
              success: false,
              errors: [
                `Invalid file type: ${part.mimetype}. Only PDF files are accepted.`,
              ],
            });
          }
        }
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return {
        results,
        total_processed: results.length,
        successful,
        failed,
      };
    }
  );

  /**
   * GET /invoices/schema
   * Returns information about the invoice schema
   */
  app.get(
    "/invoices/schema",
    {
      schema: {
        summary: "Get the invoice schema description",
        description: "Returns information about the extracted invoice data structure",
        response: {
          200: {
            type: "object",
          },
        },
      },
    },
    async () => {
      return {
        description: "Invoice extraction schema",
        fields: {
          invoice_id: "Invoice number/identifier",
          document_type: "Document type (Fattura, TD24, Nota Pro-forma, etc.)",
          document_date: "Invoice date in YYYY-MM-DD format",
          supplier: "Supplier/vendor information (vat_number, name, address, etc.)",
          customer: "Customer/buyer information (vat_number, name, address, etc.)",
          line_items: "Array of invoice line items with description, quantity, price, etc.",
          totals: "Invoice totals (total_taxable, total_vat, total_amount)",
          payment_details: "Payment method, bank info, due date",
          notes: "Additional notes from the invoice",
        },
      };
    }
  );
}
