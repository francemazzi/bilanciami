import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { adminMiddleware } from "../middleware/auth.middleware.js";

interface AssignmentParams {
  id: string;
}

interface CreateAssignmentBody {
  userId: string;
  documentId: string;
  role?: string;
}

interface UpdateAssignmentBody {
  role: string;
}

interface AssignmentQuerystring {
  userId?: string;
  documentId?: string;
  role?: string;
}

export async function userDocumentRoutes(app: FastifyInstance) {
  // GET /user-documents - Lista tutte le assegnazioni (solo admin)
  app.get(
    "/user-documents",
    {
      preHandler: adminMiddleware,
      schema: {
        summary: "Lista tutte le assegnazioni utente-documento",
        description: "Restituisce la lista di tutte le assegnazioni con filtri opzionali. Solo admin.",
        tags: ["user-documents"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            userId: { type: "string" },
            documentId: { type: "string" },
            role: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                userId: { type: "string" },
                documentId: { type: "string" },
                role: { type: "string" },
                assignedAt: { type: "string" },
                user: { type: "object" },
                document: { type: "object" },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const { userId, documentId, role } = request.query as AssignmentQuerystring;

      const where: Record<string, unknown> = {};

      if (userId) where.userId = userId;
      if (documentId) where.documentId = documentId;
      if (role) where.role = role;

      return prisma.userOnDocument.findMany({
        where,
        include: {
          user: true,
          document: true,
        },
        orderBy: { assignedAt: "desc" },
      });
    }
  );

  // GET /user-documents/:id - Ottieni un'assegnazione specifica (solo admin)
  app.get(
    "/user-documents/:id",
    {
      preHandler: adminMiddleware,
      schema: {
        summary: "Ottieni un'assegnazione",
        description: "Restituisce i dettagli di un'assegnazione specifica. Solo admin.",
        tags: ["user-documents"],
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
              userId: { type: "string" },
              documentId: { type: "string" },
              role: { type: "string" },
              assignedAt: { type: "string" },
              user: { type: "object" },
              document: { type: "object" },
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
      const { id } = request.params as AssignmentParams;

      const assignment = await prisma.userOnDocument.findUnique({
        where: { id },
        include: {
          user: true,
          document: true,
        },
      });

      if (!assignment) {
        return reply.status(404).send({ error: "Assegnazione non trovata" });
      }

      return assignment;
    }
  );

  // POST /user-documents - Crea una nuova assegnazione (solo admin)
  app.post(
    "/user-documents",
    {
      preHandler: adminMiddleware,
      schema: {
        summary: "Assegna un documento a un utente",
        description: "Crea un'associazione tra un utente e un documento con un ruolo specifico. Solo admin.",
        tags: ["user-documents"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            userId: { type: "string" },
            documentId: { type: "string" },
            role: { type: "string", enum: ["viewer", "editor", "owner"] },
          },
          required: ["userId", "documentId"],
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              documentId: { type: "string" },
              role: { type: "string" },
              assignedAt: { type: "string" },
              user: { type: "object" },
              document: { type: "object" },
            },
          },
          400: {
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
        },
      },
    },
    async (request, reply) => {
      const { userId, documentId, role = "viewer" } = request.body as CreateAssignmentBody;

      // Verifica che l'utente esista
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return reply.status(404).send({ error: "Utente non trovato" });
      }

      // Verifica che il documento esista
      const document = await prisma.document.findUnique({ where: { id: documentId } });
      if (!document) {
        return reply.status(404).send({ error: "Documento non trovato" });
      }

      try {
        const assignment = await prisma.userOnDocument.create({
          data: {
            userId,
            documentId,
            role,
          },
          include: {
            user: true,
            document: true,
          },
        });

        return reply.status(201).send(assignment);
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2002"
        ) {
          return reply
            .status(400)
            .send({ error: "L'utente è già assegnato a questo documento" });
        }
        throw error;
      }
    }
  );

  // PUT /user-documents/:id - Aggiorna un'assegnazione (solo admin)
  app.put(
    "/user-documents/:id",
    {
      preHandler: adminMiddleware,
      schema: {
        summary: "Aggiorna un'assegnazione",
        description: "Modifica il ruolo di un'assegnazione esistente. Solo admin.",
        tags: ["user-documents"],
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
            role: { type: "string", enum: ["viewer", "editor", "owner"] },
          },
          required: ["role"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              documentId: { type: "string" },
              role: { type: "string" },
              assignedAt: { type: "string" },
              user: { type: "object" },
              document: { type: "object" },
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
      const { id } = request.params as AssignmentParams;
      const { role } = request.body as UpdateAssignmentBody;

      try {
        const assignment = await prisma.userOnDocument.update({
          where: { id },
          data: { role },
          include: {
            user: true,
            document: true,
          },
        });

        return assignment;
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return reply.status(404).send({ error: "Assegnazione non trovata" });
        }
        throw error;
      }
    }
  );

  // DELETE /user-documents/:id - Elimina un'assegnazione (solo admin)
  app.delete(
    "/user-documents/:id",
    {
      preHandler: adminMiddleware,
      schema: {
        summary: "Elimina un'assegnazione",
        description: "Rimuove l'associazione tra un utente e un documento. Solo admin.",
        tags: ["user-documents"],
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
      const { id } = request.params as AssignmentParams;

      try {
        await prisma.userOnDocument.delete({
          where: { id },
        });

        return { message: "Assegnazione eliminata con successo" };
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return reply.status(404).send({ error: "Assegnazione non trovata" });
        }
        throw error;
      }
    }
  );
}
