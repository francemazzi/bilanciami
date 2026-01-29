import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  getUserSettings,
  setOpenaiApiKey,
  deleteOpenaiApiKey,
} from "../services/settings.service.js";

export async function settingsRoutes(app: FastifyInstance) {
  // Get user settings
  app.get(
    "/settings",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["settings"],
        summary: "Get current user settings",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              hasOpenaiApiKey: { type: "boolean" },
              openaiApiKeyLastChars: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const settings = await getUserSettings(request.user!.id);
      return reply.send(settings);
    }
  );

  // Set OpenAI API key
  app.put(
    "/settings/openai-api-key",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["settings"],
        summary: "Set OpenAI API key",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["apiKey"],
          properties: {
            apiKey: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { apiKey } = request.body as { apiKey: string };

      if (!apiKey || !apiKey.startsWith("sk-")) {
        return reply.status(400).send({
          error: "Bad Request",
          message: "La chiave API deve iniziare con 'sk-'",
        });
      }

      try {
        await setOpenaiApiKey(request.user!.id, apiKey);
        return reply.send({
          success: true,
          message: "API key salvata con successo",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Errore durante il salvataggio";
        return reply.status(400).send({
          error: "Bad Request",
          message,
        });
      }
    }
  );

  // Delete OpenAI API key
  app.delete(
    "/settings/openai-api-key",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["settings"],
        summary: "Delete OpenAI API key",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await deleteOpenaiApiKey(request.user!.id);
      return reply.send({ success: true });
    }
  );
}
