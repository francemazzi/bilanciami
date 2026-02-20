import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../lib/prisma.js";
import { generateDocumentPath } from "../lib/document-path.js";
import { getPdf, pdfExists } from "../services/storage.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { getFullLLMSettings } from "../services/settings.service.js";
import { createTextLLM } from "../services/llm.service.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

interface DocumentParams {
  id: string;
}

interface CreateDocumentBody {
  customerName: string;
  supplierName: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  metadata?: Prisma.InputJsonValue;
  extractionDate?: string;
}

interface UpdateDocumentBody {
  customerName?: string;
  supplierName?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  metadata?: Prisma.InputJsonValue;
}

interface DocumentQuerystring {
  customerName?: string;
  supplierName?: string;
  fromDate?: string;
  toDate?: string;
}

export async function documentRoutes(app: FastifyInstance) {
  // GET /documents - Lista documenti dell'utente autenticato
  app.get(
    "/documents",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Lista documenti utente",
        description: "Restituisce la lista dei documenti accessibili dall'utente autenticato",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            customerName: { type: "string" },
            supplierName: { type: "string" },
            fromDate: { type: "string", format: "date" },
            toDate: { type: "string", format: "date" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                extractionDate: { type: "string" },
                customerName: { type: "string" },
                supplierName: { type: "string" },
                filePath: { type: "string" },
                fileName: { type: "string" },
                mimeType: { type: "string" },
                fileSize: { type: "number" },
                metadata: { type: "object", additionalProperties: true },
                invoiceId: { type: "string", nullable: true },
                documentDate: { type: "string", nullable: true },
                dueDate: { type: "string", nullable: true },
                totalAmount: { type: "string", nullable: true },
                pdfStoragePath: { type: "string", nullable: true },
                followUpStatus: { type: "string", nullable: true },
                done: { type: "boolean" },
                userNotes: { type: "string", nullable: true },
                createdAt: { type: "string" },
                updatedAt: { type: "string" },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: "Non autenticato" });
      }

      const { customerName, supplierName, fromDate, toDate } = request.query as DocumentQuerystring;

      const where: Record<string, unknown> = {
        users: { some: { userId } },
      };

      if (customerName) {
        where.customerName = { contains: customerName, mode: "insensitive" };
      }
      if (supplierName) {
        where.supplierName = { contains: supplierName, mode: "insensitive" };
      }
      if (fromDate || toDate) {
        where.extractionDate = {
          ...(fromDate && { gte: new Date(fromDate) }),
          ...(toDate && { lte: new Date(toDate) }),
        };
      }

      return prisma.document.findMany({
        where,
        orderBy: { extractionDate: "desc" },
      });
    }
  );

  // GET /documents/:id - Ottieni un documento specifico (solo se l'utente ha accesso)
  app.get(
    "/documents/:id",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Ottieni un documento",
        description: "Restituisce i dettagli di un documento specifico accessibile dall'utente",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              extractionDate: { type: "string" },
              customerName: { type: "string" },
              supplierName: { type: "string" },
              filePath: { type: "string" },
              fileName: { type: "string" },
              mimeType: { type: "string" },
              fileSize: { type: "number" },
              metadata: { type: "object", additionalProperties: true },
              invoiceId: { type: "string", nullable: true },
              documentDate: { type: "string", nullable: true },
              dueDate: { type: "string", nullable: true },
              totalAmount: { type: "string", nullable: true },
              pdfStoragePath: { type: "string", nullable: true },
              followUpStatus: { type: "string", nullable: true },
              done: { type: "boolean" },
              userNotes: { type: "string", nullable: true },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
              users: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    role: { type: "string" },
                    assignedAt: { type: "string" },
                    user: { type: "object" },
                  },
                },
              },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as DocumentParams;
      const userId = request.user?.id;

      const document = await prisma.document.findFirst({
        where: {
          id,
          users: userId ? { some: { userId } } : undefined,
        },
        include: {
          users: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!document) {
        return reply.status(404).send({ error: "Documento non trovato" });
      }

      return document;
    }
  );

  // POST /documents - Crea un nuovo documento (assegna l'utente come owner)
  app.post(
    "/documents",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Crea un nuovo documento",
        description: "Registra un nuovo documento nel sistema e assegna l'utente come owner",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            customerName: { type: "string" },
            supplierName: { type: "string" },
            fileName: { type: "string" },
            mimeType: { type: "string" },
            fileSize: { type: "number" },
            metadata: { type: "object", additionalProperties: true },
            extractionDate: { type: "string", format: "date-time" },
          },
          required: ["customerName", "supplierName", "fileName"],
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              extractionDate: { type: "string" },
              customerName: { type: "string" },
              supplierName: { type: "string" },
              filePath: { type: "string" },
              fileName: { type: "string" },
              mimeType: { type: "string" },
              fileSize: { type: "number" },
              metadata: { type: "object", additionalProperties: true },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: "Non autenticato" });
      }

      const {
        customerName,
        supplierName,
        fileName,
        mimeType = "application/pdf",
        fileSize,
        metadata,
        extractionDate,
      } = request.body as CreateDocumentBody;

      const date = extractionDate ? new Date(extractionDate) : new Date();
      const filePath = generateDocumentPath(date, customerName, supplierName);

      const document = await prisma.document.create({
        data: {
          extractionDate: date,
          customerName,
          supplierName,
          filePath,
          fileName,
          mimeType,
          fileSize,
          metadata,
          users: {
            create: {
              userId,
              role: "owner",
            },
          },
        },
      });

      return reply.status(201).send(document);
    }
  );

  // PUT /documents/:id - Aggiorna un documento (solo se l'utente ha accesso editor/owner)
  app.put(
    "/documents/:id",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Aggiorna un documento",
        description: "Modifica i dati di un documento esistente. Richiede ruolo editor o owner",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            customerName: { type: "string" },
            supplierName: { type: "string" },
            fileName: { type: "string" },
            mimeType: { type: "string" },
            fileSize: { type: "number" },
            metadata: { type: "object", additionalProperties: true },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              extractionDate: { type: "string" },
              customerName: { type: "string" },
              supplierName: { type: "string" },
              filePath: { type: "string" },
              fileName: { type: "string" },
              mimeType: { type: "string" },
              fileSize: { type: "number" },
              metadata: { type: "object", additionalProperties: true },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as DocumentParams;
      const userId = request.user?.id;
      const { customerName, supplierName, fileName, mimeType, fileSize, metadata } =
        request.body as UpdateDocumentBody;

      // Verifica che l'utente abbia accesso editor/owner
      const assignment = await prisma.userOnDocument.findFirst({
        where: {
          documentId: id,
          userId,
          role: { in: ["editor", "owner"] },
        },
      });

      if (!assignment) {
        return reply.status(404).send({ error: "Documento non trovato o accesso negato" });
      }

      try {
        // Se customer o supplier cambiano, rigenera il path
        let filePath: string | undefined;
        if (customerName || supplierName) {
          const existing = await prisma.document.findUnique({
            where: { id },
            select: { extractionDate: true, customerName: true, supplierName: true },
          });

          if (existing) {
            filePath = generateDocumentPath(
              existing.extractionDate,
              customerName || existing.customerName,
              supplierName || existing.supplierName
            );
          }
        }

        const document = await prisma.document.update({
          where: { id },
          data: {
            ...(customerName && { customerName }),
            ...(supplierName && { supplierName }),
            ...(fileName && { fileName }),
            ...(mimeType && { mimeType }),
            ...(fileSize !== undefined && { fileSize }),
            ...(metadata !== undefined && { metadata }),
            ...(filePath && { filePath }),
          },
        });

        return document;
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return reply.status(404).send({ error: "Documento non trovato" });
        }
        throw error;
      }
    }
  );

  // DELETE /documents/:id - Elimina un documento (solo owner)
  app.delete(
    "/documents/:id",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Elimina un documento",
        description: "Rimuove un documento dal sistema. Richiede ruolo owner",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as DocumentParams;
      const userId = request.user?.id;

      // Solo l'owner può eliminare un documento
      const assignment = await prisma.userOnDocument.findFirst({
        where: {
          documentId: id,
          userId,
          role: "owner",
        },
      });

      if (!assignment) {
        return reply.status(404).send({ error: "Documento non trovato o accesso negato" });
      }

      try {
        await prisma.document.delete({
          where: { id },
        });

        return { message: "Documento eliminato con successo" };
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return reply.status(404).send({ error: "Documento non trovato" });
        }
        throw error;
      }
    }
  );

  // GET /documents/:id/pdf - Serve il PDF originale
  app.get(
    "/documents/:id/pdf",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Ottieni il PDF originale",
        description: "Restituisce il file PDF originale del documento",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        response: {
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as DocumentParams;
      const userId = request.user?.id;

      // Find document and verify user has access
      const document = await prisma.document.findFirst({
        where: {
          id,
          users: userId ? { some: { userId } } : undefined,
        },
      });

      if (!document) {
        return reply.status(404).send({ error: "Documento non trovato" });
      }

      if (!document.pdfStoragePath) {
        return reply.status(404).send({ error: "PDF non disponibile" });
      }

      const exists = await pdfExists(document.pdfStoragePath);
      if (!exists) {
        return reply.status(404).send({ error: "File PDF non trovato" });
      }

      const pdfBuffer = await getPdf(document.pdfStoragePath);

      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `inline; filename="${document.fileName}"`)
        .send(pdfBuffer);
    }
  );

  // GET /documents/tree - Struttura gerarchica per file explorer
  app.get(
    "/documents/tree",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Ottieni struttura documenti",
        description: "Restituisce la struttura gerarchica dei documenti per il file explorer",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              type: { type: "string" },
              name: { type: "string" },
              path: { type: "string" },
              children: { type: "array" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: "Non autenticato" });
      }

      // Get all documents for user
      const documents = await prisma.document.findMany({
        where: {
          users: { some: { userId } },
        },
        orderBy: [
          { supplierName: "asc" },
          { customerName: "asc" },
          { extractionDate: "desc" },
        ],
      });

      // Build tree structure
      interface TreeNode {
        type: "folder" | "file";
        name: string;
        path: string;
        children?: TreeNode[];
        document?: typeof documents[0];
      }

      const root: TreeNode = {
        type: "folder",
        name: "Documenti",
        path: "/",
        children: [],
      };

      // Group by supplier-customer
      const supplierCustomerMap = new Map<string, typeof documents>();

      for (const doc of documents) {
        const key = `${doc.supplierName} - ${doc.customerName}`;
        if (!supplierCustomerMap.has(key)) {
          supplierCustomerMap.set(key, []);
        }
        supplierCustomerMap.get(key)!.push(doc);
      }

      // Build tree
      for (const [supplierCustomer, docs] of supplierCustomerMap) {
        const supplierFolder: TreeNode = {
          type: "folder",
          name: supplierCustomer,
          path: `/${supplierCustomer}`,
          children: [],
        };

        // Group by extraction date
        const dateMap = new Map<string, typeof documents>();

        for (const doc of docs) {
          const dateKey = doc.extractionDate.toISOString().split("T")[0];
          if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, []);
          }
          dateMap.get(dateKey)!.push(doc);
        }

        // Sort dates descending
        const sortedDates = Array.from(dateMap.keys()).sort().reverse();

        for (const dateKey of sortedDates) {
          const dateDocs = dateMap.get(dateKey)!;
          const dateFolder: TreeNode = {
            type: "folder",
            name: dateKey,
            path: `/${supplierCustomer}/${dateKey}`,
            children: dateDocs.map((doc) => ({
              type: "file" as const,
              name: doc.fileName,
              path: `/${supplierCustomer}/${dateKey}/${doc.fileName}`,
              document: doc,
            })),
          };

          supplierFolder.children!.push(dateFolder);
        }

        root.children!.push(supplierFolder);
      }

      return root;
    }
  );

  // PATCH /documents/:id/metadata - Aggiorna solo i metadata (dati estratti)
  app.patch(
    "/documents/:id/metadata",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Aggiorna metadata documento",
        description: "Modifica i dati estratti di un documento",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            metadata: { type: "object", additionalProperties: true },
          },
          required: ["metadata"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              metadata: { type: "object", additionalProperties: true },
              updatedAt: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as DocumentParams;
      const { metadata } = request.body as { metadata: Prisma.InputJsonValue };
      const userId = request.user?.id;

      // Verify user has editor/owner access
      const assignment = await prisma.userOnDocument.findFirst({
        where: {
          documentId: id,
          userId,
          role: { in: ["editor", "owner"] },
        },
      });

      if (!assignment) {
        return reply.status(404).send({ error: "Documento non trovato o accesso negato" });
      }

      // Extract denormalized fields from metadata
      const invoice = metadata as Record<string, unknown>;
      let documentDate: Date | null = null;
      let dueDate: Date | null = null;
      let totalAmount: number | null = null;
      let invoiceId: string | null = null;
      let supplierName: string | undefined;
      let customerName: string | undefined;

      if (typeof invoice.document_date === "string") {
        const parsed = new Date(invoice.document_date);
        if (!isNaN(parsed.getTime())) {
          documentDate = parsed;
        }
      }

      const paymentDetails = invoice.payment_details as Record<string, unknown> | undefined;
      if (paymentDetails && typeof paymentDetails.due_date === "string") {
        const parsed = new Date(paymentDetails.due_date);
        if (!isNaN(parsed.getTime())) {
          dueDate = parsed;
        }
      }

      const totals = invoice.totals as Record<string, unknown> | undefined;
      if (totals && typeof totals.total_amount === "number") {
        totalAmount = totals.total_amount;
      }

      if (typeof invoice.invoice_id === "string") {
        invoiceId = invoice.invoice_id;
      }

      const supplier = invoice.supplier as Record<string, unknown> | undefined;
      if (supplier && typeof supplier.name === "string") {
        supplierName = supplier.name;
      }

      const customer = invoice.customer as Record<string, unknown> | undefined;
      if (customer && typeof customer.name === "string") {
        customerName = customer.name;
      }

      // Update document
      const existing = await prisma.document.findUnique({
        where: { id },
        select: { extractionDate: true, customerName: true, supplierName: true },
      });

      let filePath: string | undefined;
      if (existing && (supplierName || customerName)) {
        filePath = generateDocumentPath(
          existing.extractionDate,
          customerName || existing.customerName,
          supplierName || existing.supplierName
        );
      }

      const document = await prisma.document.update({
        where: { id },
        data: {
          metadata,
          documentDate,
          dueDate,
          totalAmount,
          invoiceId,
          ...(supplierName && { supplierName }),
          ...(customerName && { customerName }),
          ...(filePath && { filePath }),
        },
        select: {
          id: true,
          metadata: true,
          updatedAt: true,
        },
      });

      return document;
    }
  );

  // PATCH /documents/:id/follow-up - Aggiorna lo stato follow-up
  app.patch(
    "/documents/:id/follow-up",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Aggiorna stato follow-up documento",
        description: "Modifica lo stato di follow-up di un documento",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            followUpStatus: {
              type: "string",
              enum: ["gestita", "richiesta_saldo", "sollecitata", "da_gestire"],
              nullable: true,
            },
          },
          required: ["followUpStatus"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              followUpStatus: { type: "string", nullable: true },
              updatedAt: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as DocumentParams;
      const { followUpStatus } = request.body as { followUpStatus: string | null };
      const userId = request.user?.id;

      const assignment = await prisma.userOnDocument.findFirst({
        where: {
          documentId: id,
          userId,
          role: { in: ["editor", "owner"] },
        },
      });

      if (!assignment) {
        return reply.status(404).send({ error: "Documento non trovato o accesso negato" });
      }

      const document = await prisma.document.update({
        where: { id },
        data: { followUpStatus },
        select: {
          id: true,
          followUpStatus: true,
          updatedAt: true,
        },
      });

      return document;
    }
  );

  // PATCH /documents/:id/done - Aggiorna lo stato "fatto"
  app.patch(
    "/documents/:id/done",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Aggiorna stato fatto documento",
        description: "Segna un documento come fatto/non fatto",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            done: { type: "boolean" },
          },
          required: ["done"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              done: { type: "boolean" },
              updatedAt: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as DocumentParams;
      const { done } = request.body as { done: boolean };
      const userId = request.user?.id;

      const assignment = await prisma.userOnDocument.findFirst({
        where: {
          documentId: id,
          userId,
          role: { in: ["editor", "owner"] },
        },
      });

      if (!assignment) {
        return reply.status(404).send({ error: "Documento non trovato o accesso negato" });
      }

      const document = await prisma.document.update({
        where: { id },
        data: { done },
        select: {
          id: true,
          done: true,
          updatedAt: true,
        },
      });

      return document;
    }
  );

  // PATCH /documents/:id/user-notes - Aggiorna le note utente
  app.patch(
    "/documents/:id/user-notes",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Aggiorna note utente documento",
        description: "Modifica le note personali dell'utente su un documento",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            userNotes: { type: "string", nullable: true },
          },
          required: ["userNotes"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              userNotes: { type: "string", nullable: true },
              updatedAt: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as DocumentParams;
      const { userNotes } = request.body as { userNotes: string | null };
      const userId = request.user?.id;

      const assignment = await prisma.userOnDocument.findFirst({
        where: {
          documentId: id,
          userId,
          role: { in: ["editor", "owner"] },
        },
      });

      if (!assignment) {
        return reply.status(404).send({ error: "Documento non trovato o accesso negato" });
      }

      const document = await prisma.document.update({
        where: { id },
        data: { userNotes },
        select: {
          id: true,
          userNotes: true,
          updatedAt: true,
        },
      });

      return document;
    }
  );

  // POST /documents/:id/sollecito - Genera email sollecito pagamento con LLM
  app.post(
    "/documents/:id/sollecito",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Genera sollecito pagamento",
        description:
          "Genera un'email di sollecito pagamento professionale usando l'LLM configurato dall'utente",
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              emailTo: { type: "string" },
              subject: { type: "string" },
              body: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as DocumentParams;
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: "Non autenticato" });
      }

      const document = await prisma.document.findFirst({
        where: {
          id,
          users: { some: { userId } },
        },
      });

      if (!document) {
        return reply.status(404).send({ error: "Documento non trovato" });
      }

      const metadata = document.metadata as Record<string, unknown> | null;
      if (!metadata) {
        return reply
          .status(400)
          .send({ error: "Metadata del documento non disponibili" });
      }

      const customer = metadata.customer as
        | Record<string, unknown>
        | undefined;
      const supplier = metadata.supplier as
        | Record<string, unknown>
        | undefined;

      // Try to find email: customer PEC > supplier email > extract from notes/userNotes
      const emailRegex = /[\w.+-]+@[\w.-]+\.\w{2,}/;
      let emailTo =
        (customer?.pec as string) || (supplier?.email as string) || "";

      if (!emailTo) {
        const notes = metadata.notes as string[] | undefined;
        const notesText = [
          ...(notes || []),
          (document as Record<string, unknown>).userNotes as string || "",
        ].join(" ");
        const match = notesText.match(emailRegex);
        if (match) {
          emailTo = match[0];
        }
      }

      const llmSettings = await getFullLLMSettings(userId);

      if (llmSettings.provider === "openai" && !llmSettings.openaiApiKey) {
        return reply.status(400).send({
          error:
            "Chiave API OpenAI non configurata. Vai nelle impostazioni per configurarla.",
        });
      }

      try {
        const llm = createTextLLM(llmSettings);

        const invoiceId = metadata.invoice_id || document.invoiceId || "N/A";
        const documentDate = metadata.document_date || "";
        const customerName =
          (customer?.name as string) || document.customerName;
        const supplierName =
          (supplier?.name as string) || document.supplierName;
        const totals = metadata.totals as
          | Record<string, unknown>
          | undefined;
        const totalAmount = totals?.total_amount ?? "";
        const paymentDetails = metadata.payment_details as
          | Record<string, unknown>
          | undefined;
        const dueDate = paymentDetails?.due_date || "";
        const iban = paymentDetails?.iban || "";
        const paymentMethod = paymentDetails?.payment_method || "";

        const systemPrompt = `Sei un assistente specializzato nella generazione di comunicazioni professionali in italiano per la gestione contabile.
Genera SEMPRE la risposta in formato JSON con esattamente questi campi:
{
  "subject": "oggetto dell'email",
  "body": "corpo dell'email"
}
Il tono deve essere formale e professionale. L'email deve essere un sollecito di pagamento cortese ma fermo.
Non includere markup HTML nel body, solo testo semplice con a capo (\\n).`;

        const humanPrompt = `Genera un'email di sollecito pagamento con i seguenti dati della fattura:

- Numero fattura: ${invoiceId}
- Data documento: ${documentDate}
- Fornitore (chi invia il sollecito): ${supplierName}
- Cliente (destinatario del sollecito): ${customerName}
- Importo totale: ${totalAmount} EUR
- Data scadenza: ${dueDate}
- Metodo pagamento: ${paymentMethod}
- IBAN: ${iban}

L'email deve:
1. Essere indirizzata a "${customerName}"
2. Ricordare cortesemente l'importo dovuto e la data di scadenza
3. Includere i riferimenti della fattura
4. Se disponibile, indicare l'IBAN per il pagamento
5. Chiudere con un tono professionale e cordiale
6. Essere firmata da "${supplierName}"

Rispondi SOLO con il JSON, senza altro testo.`;

        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(humanPrompt),
        ];

        const response =
          llmSettings.provider === "openai"
            ? await llm.invoke(messages, {
                response_format: { type: "json_object" },
              })
            : await llm.invoke(messages);

        const parsed = JSON.parse(response.content as string);

        return {
          emailTo,
          subject: parsed.subject,
          body: parsed.body,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        request.log.error(`Sollecito generation error: ${errorMessage}`);
        return reply.status(500).send({
          error: "Errore nella generazione del sollecito",
        });
      }
    }
  );
}
