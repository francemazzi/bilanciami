import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";

interface UserParams {
  id: string;
}

interface CreateUserBody {
  email: string;
  name: string;
}

interface UpdateUserBody {
  email?: string;
  name?: string;
}

export async function userRoutes(app: FastifyInstance) {
  // GET /users - Lista tutti gli utenti
  app.get(
    "/users",
    {
      schema: {
        summary: "Lista tutti gli utenti",
        description: "Restituisce la lista di tutti gli utenti registrati",
        tags: ["users"],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                name: { type: "string" },
                createdAt: { type: "string" },
                updatedAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async () => {
      return prisma.user.findMany({
        orderBy: { createdAt: "desc" },
      });
    }
  );

  // GET /users/:id - Ottieni un utente specifico
  app.get(
    "/users/:id",
    {
      schema: {
        summary: "Ottieni un utente",
        description: "Restituisce i dettagli di un utente specifico",
        tags: ["users"],
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
              email: { type: "string" },
              name: { type: "string" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
              documents: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    role: { type: "string" },
                    assignedAt: { type: "string" },
                    document: { type: "object" },
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
    async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
      const { id } = request.params;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          documents: {
            include: {
              document: true,
            },
          },
        },
      });

      if (!user) {
        return reply.status(404).send({ error: "Utente non trovato" });
      }

      return user;
    }
  );

  // POST /users - Crea un nuovo utente
  app.post(
    "/users",
    {
      schema: {
        summary: "Crea un nuovo utente",
        description: "Registra un nuovo utente nel sistema",
        tags: ["users"],
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            name: { type: "string" },
          },
          required: ["email", "name"],
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              name: { type: "string" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) => {
      const { email, name } = request.body;

      try {
        const user = await prisma.user.create({
          data: { email, name },
        });

        return reply.status(201).send(user);
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2002"
        ) {
          return reply.status(400).send({ error: "Email già registrata" });
        }
        throw error;
      }
    }
  );

  // PUT /users/:id - Aggiorna un utente
  app.put(
    "/users/:id",
    {
      schema: {
        summary: "Aggiorna un utente",
        description: "Modifica i dati di un utente esistente",
        tags: ["users"],
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
            email: { type: "string", format: "email" },
            name: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              name: { type: "string" },
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
      request: FastifyRequest<{ Params: UserParams; Body: UpdateUserBody }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { email, name } = request.body;

      try {
        const user = await prisma.user.update({
          where: { id },
          data: {
            ...(email && { email }),
            ...(name && { name }),
          },
        });

        return user;
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return reply.status(404).send({ error: "Utente non trovato" });
        }
        throw error;
      }
    }
  );

  // DELETE /users/:id - Elimina un utente
  app.delete(
    "/users/:id",
    {
      schema: {
        summary: "Elimina un utente",
        description: "Rimuove un utente dal sistema",
        tags: ["users"],
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
    async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
      const { id } = request.params;

      try {
        await prisma.user.delete({
          where: { id },
        });

        return { message: "Utente eliminato con successo" };
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2025"
        ) {
          return reply.status(404).send({ error: "Utente non trovato" });
        }
        throw error;
      }
    }
  );
}
