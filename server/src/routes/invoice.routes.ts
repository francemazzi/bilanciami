import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { extractInvoice } from "../agents/invoice-graph.js";
import type { Invoice } from "../types/invoice.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { savePdf } from "../services/storage.service.js";
import { generateDocumentPath } from "../lib/document-path.js";
import { Prisma } from "../../generated/prisma/client.js";
import { getDecryptedOpenaiApiKey } from "../services/settings.service.js";

interface ExtractionResult {
  file_name: string;
  success: boolean;
  invoice?: Invoice;
  errors?: string[];
  confidence?: number;
  document_id?: string;
}

export async function invoiceRoutes(app: FastifyInstance) {
  /**
   * POST /invoices/extract
   * Upload one or more PDF files to extract structured invoice data
   */
  app.post(
    "/invoices/extract",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Extract invoice data from PDF files",
        description:
          "Upload one or more PDF files to extract structured invoice data using AI-powered text and vision extraction. Requires authentication and OpenAI API key configured in settings.",
        consumes: ["multipart/form-data"],
        tags: ["invoices"],
        security: [{ bearerAuth: [] }],
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
                    document_id: { type: "string" },
                  },
                },
              },
              total_processed: { type: "number" },
              successful: { type: "number" },
              failed: { type: "number" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      // Get user's OpenAI API key
      const userApiKey = await getDecryptedOpenaiApiKey(userId);

      if (!userApiKey) {
        return reply.status(400).send({
          results: [],
          total_processed: 0,
          successful: 0,
          failed: 0,
          error:
            "Chiave API OpenAI non configurata. Vai alle impostazioni per aggiungerla.",
        });
      }

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
            const fileName = part.filename || "unknown.pdf";

            try {
              app.log.info(`Processing file: ${fileName}`);

              const extractionResult = await extractInvoice(buffer, fileName, userApiKey);

              const result: ExtractionResult = {
                file_name: fileName,
                success: !!extractionResult.invoice,
                invoice: extractionResult.invoice || undefined,
                errors:
                  extractionResult.errors.length > 0
                    ? extractionResult.errors
                    : undefined,
                confidence: extractionResult.confidence,
              };

              // Save document to database if user is authenticated and extraction was successful
              if (userId && extractionResult.invoice) {
                try {
                  const invoice = extractionResult.invoice;
                  const supplierName = invoice.supplier?.name || "Unknown Supplier";
                  const customerName = invoice.customer?.name || "Unknown Customer";
                  const extractionDate = new Date();
                  const filePath = generateDocumentPath(extractionDate, customerName, supplierName);

                  // Parse dates from invoice
                  let documentDate: Date | null = null;
                  let dueDate: Date | null = null;

                  if (invoice.document_date) {
                    const parsed = new Date(invoice.document_date);
                    if (!isNaN(parsed.getTime())) {
                      documentDate = parsed;
                    }
                  }

                  if (invoice.payment_details?.due_date) {
                    const parsed = new Date(invoice.payment_details.due_date);
                    if (!isNaN(parsed.getTime())) {
                      dueDate = parsed;
                    }
                  }

                  // Create document in database
                  const document = await prisma.document.create({
                    data: {
                      extractionDate,
                      customerName,
                      supplierName,
                      filePath,
                      fileName,
                      mimeType: "application/pdf",
                      fileSize: buffer.length,
                      metadata: invoice as unknown as Prisma.InputJsonValue,
                      invoiceId: invoice.invoice_id || null,
                      documentDate,
                      dueDate,
                      totalAmount: invoice.totals?.total_amount
                        ? new Prisma.Decimal(invoice.totals.total_amount)
                        : null,
                    },
                  });

                  // Save PDF to disk
                  const pdfStoragePath = await savePdf(buffer, userId, document.id, fileName);

                  // Update document with PDF storage path
                  await prisma.document.update({
                    where: { id: document.id },
                    data: { pdfStoragePath },
                  });

                  // Associate document with user
                  await prisma.userOnDocument.create({
                    data: {
                      userId,
                      documentId: document.id,
                      role: "owner",
                    },
                  });

                  result.document_id = document.id;
                  app.log.info(`Document saved with ID: ${document.id}`);
                } catch (saveError) {
                  const errorMessage =
                    saveError instanceof Error ? saveError.message : String(saveError);
                  app.log.error(`Failed to save document: ${errorMessage}`);
                  // Don't fail the extraction if save fails
                  if (!result.errors) {
                    result.errors = [];
                  }
                  result.errors.push(`Document save failed: ${errorMessage}`);
                }
              }

              results.push(result);

              app.log.info(
                `Completed processing: ${fileName} (confidence: ${extractionResult.confidence})`
              );
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              app.log.error(`Failed to process ${fileName}: ${errorMessage}`);

              results.push({
                file_name: fileName,
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
