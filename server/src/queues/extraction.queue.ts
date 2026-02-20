import { Queue, Worker, type Job } from "bullmq";
import * as fs from "fs/promises";
import * as path from "path";
import { getRedisConnectionOptions } from "../lib/redis.js";
import { extractInvoice } from "../agents/invoice-graph.js";
import { prisma } from "../lib/prisma.js";
import { savePdf } from "../services/storage.service.js";
import { generateDocumentPath } from "../lib/document-path.js";
import { Prisma } from "../../generated/prisma/client";
import type { LLMSettings } from "../types/llm-provider.js";
import type { Invoice } from "../types/invoice.js";

const QUEUE_NAME = "invoice-extraction";
const TEMP_DIR = "/tmp/bilanciami-jobs";

// --- Types ---

interface ExtractionJobData {
  userId: string;
  fileNames: string[];
  llmSettings: LLMSettings;
  tempDir: string;
}

interface ExtractionResult {
  file_name: string;
  success: boolean;
  invoice?: Invoice;
  errors?: string[];
  confidence?: number;
  document_id?: string;
}

interface ExtractionJobResult {
  results: ExtractionResult[];
  total_processed: number;
  successful: number;
  failed: number;
}

// --- Queue ---

let queue: Queue | null = null;

export function getExtractionQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
    });
  }
  return queue;
}

// --- Enqueue helper ---

/**
 * Saves PDF buffers to temp directory and enqueues an extraction job.
 * Returns the jobId for polling.
 */
export async function enqueueExtraction(
  userId: string,
  files: Array<{ buffer: Buffer; fileName: string }>,
  llmSettings: LLMSettings
): Promise<string> {
  const q = getExtractionQueue();

  // Create a unique temp directory for this job
  const jobId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tempDir = path.join(TEMP_DIR, jobId);
  await fs.mkdir(tempDir, { recursive: true });

  // Save PDF buffers to temp files
  const fileNames: string[] = [];
  for (const { buffer, fileName } of files) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    await fs.writeFile(path.join(tempDir, safeName), buffer);
    fileNames.push(safeName);
  }

  const jobData: ExtractionJobData = {
    userId,
    fileNames,
    llmSettings,
    tempDir,
  };

  await q.add(QUEUE_NAME, jobData, {
    jobId,
    removeOnComplete: { age: 3600 }, // Keep completed jobs for 1 hour
    removeOnFail: { age: 3600 },
  });

  return jobId;
}

// --- Worker ---

let worker: Worker | null = null;

/**
 * Starts the BullMQ worker that processes extraction jobs.
 * Should be called once at server startup.
 */
export function startExtractionWorker(): Worker {
  if (worker) return worker;

  worker = new Worker<ExtractionJobData, ExtractionJobResult>(
    QUEUE_NAME,
    async (job: Job<ExtractionJobData, ExtractionJobResult>) => {
      const { userId, fileNames, llmSettings, tempDir } = job.data;
      const results: ExtractionResult[] = [];

      for (let i = 0; i < fileNames.length; i++) {
        const fileName = fileNames[i];
        await job.updateProgress({
          current: i,
          total: fileNames.length,
          currentFile: fileName,
        });

        try {
          // Read PDF from temp file
          const buffer = await fs.readFile(path.join(tempDir, fileName));

          console.log(`[Worker] Processing file: ${fileName} (${i + 1}/${fileNames.length})`);

          const extractionResult = await extractInvoice(buffer, fileName, llmSettings);

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

          // Save document to database
          if (extractionResult.invoice) {
            try {
              const invoice = extractionResult.invoice;
              const supplierName = invoice.supplier?.name || "Unknown Supplier";
              const customerName = invoice.customer?.name || "Unknown Customer";
              const extractionDate = new Date();
              const filePath = generateDocumentPath(extractionDate, customerName, supplierName);

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
                  totalAmount: invoice.totals?.total_amount ?? null,
                },
              });

              const pdfStoragePath = await savePdf(buffer, userId, document.id, fileName);

              await prisma.document.update({
                where: { id: document.id },
                data: { pdfStoragePath },
              });

              await prisma.userOnDocument.create({
                data: {
                  userId,
                  documentId: document.id,
                  role: "owner",
                },
              });

              result.document_id = document.id;
              console.log(`[Worker] Document saved with ID: ${document.id}`);
            } catch (saveError) {
              const errorMessage =
                saveError instanceof Error ? saveError.message : String(saveError);
              console.error(`[Worker] Failed to save document: ${errorMessage}`);
              if (!result.errors) result.errors = [];
              result.errors.push(`Document save failed: ${errorMessage}`);
            }
          }

          results.push(result);
          console.log(`[Worker] Completed: ${fileName} (confidence: ${extractionResult.confidence})`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`[Worker] Failed to process ${fileName}: ${errorMessage}`);
          results.push({
            file_name: fileName,
            success: false,
            errors: [`Processing failed: ${errorMessage}`],
          });
        }
      }

      // Update final progress
      await job.updateProgress({
        current: fileNames.length,
        total: fileNames.length,
      });

      // Cleanup temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        console.warn(`[Worker] Failed to cleanup temp dir: ${tempDir}`);
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return {
        results,
        total_processed: results.length,
        successful,
        failed,
      };
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 1, // Process one job at a time
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  return worker;
}

/**
 * Gracefully shuts down the worker.
 */
export async function stopExtractionWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}
