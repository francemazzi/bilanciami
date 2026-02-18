import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { chat, continueWithApproval } from "../agents/chat/chat-graph.js";
import { getFullLLMSettings } from "../services/settings.service.js";
import { z } from "zod";

// Schema validazione
const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  threadId: z.string().uuid().optional(),
});

const approvalRequestSchema = z.object({
  threadId: z.string().uuid(),
  approved: z.boolean(),
  feedback: z.string().max(500).optional(),
});

export async function chatRoutes(app: FastifyInstance) {
  /**
   * POST /chat
   * Invia un messaggio all'assistente contabile
   */
  app.post(
    "/chat",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Invia un messaggio all'assistente contabile",
        description:
          "Avvia o continua una conversazione con l'assistente AI per query su fatture",
        tags: ["chat"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["message"],
          properties: {
            message: {
              type: "string",
              minLength: 1,
              maxLength: 2000,
              description: "Messaggio o domanda per l'assistente",
            },
            threadId: {
              type: "string",
              format: "uuid",
              description: "ID thread per continuare una conversazione esistente",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              response: { type: "string", description: "Risposta dell'assistente" },
              threadId: { type: "string", description: "ID della conversazione" },
              needsApproval: {
                type: "boolean",
                description: "Se true, richiede approvazione per operazione sensibile",
              },
              pendingQuery: {
                type: "object",
                nullable: true,
                description: "Dettagli query in attesa di approvazione",
                properties: {
                  sql: { type: "string" },
                  description: { type: "string" },
                  sensitiveReason: { type: "string" },
                },
              },
              errors: {
                type: "array",
                items: { type: "string" },
                description: "Eventuali errori",
              },
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      // Valida body
      const parseResult = chatRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: parseResult.error.errors[0].message,
        });
      }

      const { message, threadId } = parseResult.data;

      // Ottieni settings LLM utente
      const llmSettings = await getFullLLMSettings(userId);

      // Verifica configurazione
      if (llmSettings.provider === "openai" && !llmSettings.openaiApiKey) {
        return reply.status(400).send({
          error: "Chiave API OpenAI non configurata. Vai nelle impostazioni per configurarla.",
        });
      }

      try {
        const userName = request.user!.name;
        const result = await chat(message, userId, userName, llmSettings, threadId);

        return {
          response: result.response,
          threadId: result.threadId,
          needsApproval: result.needsApproval,
          pendingQuery:
            result.needsApproval && result.sqlQuery
              ? {
                  sql: result.sqlQuery.sql,
                  description: result.sqlQuery.description,
                  sensitiveReason: result.sqlQuery.sensitiveReason,
                }
              : null,
          errors: result.errors.length > 0 ? result.errors : undefined,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        app.log.error(`Chat error: ${errorMessage}`);
        return reply.status(500).send({
          error: "Errore durante l'elaborazione del messaggio",
        });
      }
    }
  );

  /**
   * POST /chat/approve
   * Approva o rifiuta un'operazione sensibile in attesa
   */
  app.post(
    "/chat/approve",
    {
      preHandler: authMiddleware,
      schema: {
        summary: "Approva o rifiuta un'operazione sensibile",
        description:
          "Continua una conversazione dopo aver approvato o rifiutato una query sensibile",
        tags: ["chat"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["threadId", "approved"],
          properties: {
            threadId: {
              type: "string",
              format: "uuid",
              description: "ID della conversazione",
            },
            approved: {
              type: "boolean",
              description: "true per approvare, false per rifiutare",
            },
            feedback: {
              type: "string",
              maxLength: 500,
              description: "Feedback opzionale per modificare la richiesta",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              response: { type: "string" },
              threadId: { type: "string" },
              errors: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = approvalRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: parseResult.error.errors[0].message,
        });
      }

      const { threadId, approved, feedback } = parseResult.data;

      try {
        const result = await continueWithApproval(threadId, approved, feedback);

        return {
          response: result.response,
          threadId: result.threadId,
          errors: result.errors.length > 0 ? result.errors : undefined,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        app.log.error(`Approval error: ${errorMessage}`);
        return reply.status(500).send({
          error: "Errore durante l'elaborazione dell'approvazione",
        });
      }
    }
  );
}
