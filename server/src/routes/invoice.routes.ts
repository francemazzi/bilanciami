import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { getFullLLMSettings } from "../services/settings.service.js";
import { testOllamaConnection } from "../services/llm.service.js";
import { canUploadPdfs } from "../services/license.service.js";
import {
  enqueueExtraction,
  getExtractionQueue,
} from "../queues/extraction.queue.js";

export async function invoiceRoutes(app: FastifyInstance) {
  /**
   * POST /invoices/extract
   * Upload one or more PDF files and queue them for async extraction.
   * Returns immediately with a jobId for polling.
   */
  app.post(
    "/invoices/extract",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Upload PDFs for async invoice extraction",
        description:
          "Upload one or more PDF files to extract structured invoice data. Returns a jobId immediately. Use GET /invoices/jobs/:jobId to poll for results.",
        consumes: ["multipart/form-data"],
        tags: ["invoices"],
        security: [{ bearerAuth: [] }],
        response: {
          202: {
            description: "Job created",
            type: "object",
            properties: {
              jobId: { type: "string" },
              fileCount: { type: "number" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      // Get user's LLM settings
      const llmSettings = await getFullLLMSettings(userId);

      // Validate configuration based on provider
      if (llmSettings.provider === "openai" && !llmSettings.openaiApiKey) {
        return reply.status(400).send({
          error:
            "Chiave API OpenAI non configurata. Vai alle impostazioni per aggiungerla.",
        });
      }

      // For Ollama, check connectivity
      if (llmSettings.provider === "ollama") {
        const ollamaTest = await testOllamaConnection(
          llmSettings.ollamaBaseUrl
        );
        if (!ollamaTest.success) {
          return reply.status(400).send({
            error: `Impossibile connettersi a Ollama: ${ollamaTest.error}`,
          });
        }
      }

      // Buffer all PDF files first to count them
      const parts = request.parts();
      const pdfFiles: Array<{ buffer: Buffer; fileName: string }> = [];

      for await (const part of parts) {
        if (part.type === "file") {
          if (
            part.mimetype === "application/pdf" ||
            part.filename?.toLowerCase().endsWith(".pdf")
          ) {
            pdfFiles.push({
              buffer: await part.toBuffer(),
              fileName: part.filename || "unknown.pdf",
            });
          }
        }
      }

      if (pdfFiles.length === 0) {
        return reply.status(400).send({
          error: "Nessun file PDF valido trovato nella richiesta.",
        });
      }

      // Check license limit before processing
      const limitCheck = await canUploadPdfs(userId, pdfFiles.length);
      if (!limitCheck.allowed) {
        return reply.status(403).send({
          error: limitCheck.reason,
          remainingPdfs: limitCheck.remainingPdfs,
          licenseTier: limitCheck.licenseTier,
        });
      }

      // Enqueue extraction job (saves PDFs to temp dir, returns immediately)
      const jobId = await enqueueExtraction(userId, pdfFiles, llmSettings);

      app.log.info(
        `Extraction job ${jobId} created for ${pdfFiles.length} file(s)`
      );

      return reply.status(202).send({
        jobId,
        fileCount: pdfFiles.length,
      });
    }
  );

  /**
   * GET /invoices/jobs/:jobId
   * Poll the status of an extraction job.
   */
  app.get<{ Params: { jobId: string } }>(
    "/invoices/jobs/:jobId",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Poll extraction job status",
        description:
          "Returns the current status, progress, and results of an extraction job.",
        tags: ["invoices"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            jobId: { type: "string" },
          },
          required: ["jobId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              progress: {
                type: "object",
                properties: {
                  current: { type: "number" },
                  total: { type: "number" },
                  currentFile: { type: "string" },
                },
              },
              result: {
                type: "object",
                additionalProperties: true,
              },
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { jobId } = request.params;

      const queue = getExtractionQueue();
      const job = await queue.getJob(jobId);

      if (!job) {
        return reply.status(404).send({ error: "Job non trovato" });
      }

      // Verify the job belongs to the requesting user
      if (job.data.userId !== userId) {
        return reply.status(403).send({ error: "Accesso negato" });
      }

      const state = await job.getState();
      const progress = job.progress as
        | { current: number; total: number; currentFile?: string }
        | undefined;

      if (state === "completed") {
        return {
          status: "completed",
          progress: progress || undefined,
          result: job.returnvalue,
        };
      }

      if (state === "failed") {
        return {
          status: "failed",
          progress: progress || undefined,
          error: job.failedReason || "Errore sconosciuto durante l'estrazione",
        };
      }

      // pending, waiting, active, delayed
      return {
        status: state === "active" ? "processing" : "pending",
        progress: progress || undefined,
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
        description:
          "Returns information about the extracted invoice data structure",
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
          document_type:
            "Document type (Fattura, TD24, Nota Pro-forma, etc.)",
          document_date: "Invoice date in YYYY-MM-DD format",
          supplier:
            "Supplier/vendor information (vat_number, name, address, etc.)",
          customer:
            "Customer/buyer information (vat_number, name, address, etc.)",
          line_items:
            "Array of invoice line items with description, quantity, price, etc.",
          totals:
            "Invoice totals (total_taxable, total_vat, total_amount)",
          payment_details: "Payment method, bank info, due date",
          notes: "Additional notes from the invoice",
        },
      };
    }
  );
}
