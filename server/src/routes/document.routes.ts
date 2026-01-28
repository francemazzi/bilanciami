import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { generateDocumentPath } from "../lib/document-path.js";

interface DocumentParams {
  id: string;
}

interface CreateDocumentBody {
  customerName: string;
  supplierName: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  metadata?: Record<string, unknown>;
  extractionDate?: string;
}

interface UpdateDocumentBody {
  customerName?: string;
  supplierName?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  metadata?: Record<string, unknown>;
}

interface DocumentQuerystring {
  customerName?: string;
  supplierName?: string;
  fromDate?: string;
  toDate?: string;
}

export async function documentRoutes(app: FastifyInstance) {
  // GET /documents - Lista tutti i documenti
  app.get(
    "/documents",
    {
      schema: {
        summary: "Lista tutti i documenti",
        description: "Restituisce la lista di tutti i documenti con filtri opzionali",
        tags: ["documents"],
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
                metadata: { type: "object" },
                createdAt: { type: "string" },
                updatedAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: DocumentQuerystring }>) => {
      const { customerName, supplierName, fromDate, toDate } = request.query;

      const where: Record<string, unknown> = {};

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

  // GET /documents/:id - Ottieni un documento specifico
  app.get(
    "/documents/:id",
    {
      schema: {
        summary: "Ottieni un documento",
        description: "Restituisce i dettagli di un documento specifico",
        tags: ["documents"],
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
              metadata: { type: "object" },
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
    async (request: FastifyRequest<{ Params: DocumentParams }>, reply: FastifyReply) => {
      const { id } = request.params;

      const document = await prisma.document.findUnique({
        where: { id },
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

  // POST /documents - Crea un nuovo documento
  app.post(
    "/documents",
    {
      schema: {
        summary: "Crea un nuovo documento",
        description: "Registra un nuovo documento nel sistema. Il path viene generato automaticamente nel formato: <data estrazione>/<customer>-<supplier>/",
        tags: ["documents"],
        body: {
          type: "object",
          properties: {
            customerName: { type: "string" },
            supplierName: { type: "string" },
            fileName: { type: "string" },
            mimeType: { type: "string" },
            fileSize: { type: "number" },
            metadata: { type: "object" },
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
              metadata: { type: "object" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateDocumentBody }>, reply: FastifyReply) => {
      const {
        customerName,
        supplierName,
        fileName,
        mimeType = "application/pdf",
        fileSize,
        metadata,
        extractionDate,
      } = request.body;

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
        },
      });

      return reply.status(201).send(document);
    }
  );

  // PUT /documents/:id - Aggiorna un documento
  app.put(
    "/documents/:id",
    {
      schema: {
        summary: "Aggiorna un documento",
        description: "Modifica i dati di un documento esistente. Il path viene rigenerato se customer o supplier cambiano",
        tags: ["documents"],
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
            metadata: { type: "object" },
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
              metadata: { type: "object" },
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
    async (
      request: FastifyRequest<{ Params: DocumentParams; Body: UpdateDocumentBody }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { customerName, supplierName, fileName, mimeType, fileSize, metadata } =
        request.body;

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

  // DELETE /documents/:id - Elimina un documento
  app.delete(
    "/documents/:id",
    {
      schema: {
        summary: "Elimina un documento",
        description: "Rimuove un documento dal sistema",
        tags: ["documents"],
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
    async (request: FastifyRequest<{ Params: DocumentParams }>, reply: FastifyReply) => {
      const { id } = request.params;

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
}
