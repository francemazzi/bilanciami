import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  getUserSettings,
  setOpenaiApiKey,
  deleteOpenaiApiKey,
  updateLLMProviderSettings,
} from "../services/settings.service.js";
import {
  testOllamaConnection,
  getOllamaModels,
} from "../services/llm.service.js";
import type { LLMProviderSettings } from "../types/llm-provider.js";
import {
  getUserLicenseInfo,
  setUserLicense,
  LICENSE_TIERS,
  type LicenseTier,
} from "../services/license.service.js";

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
              llmProvider: { type: "string" },
              ollamaBaseUrl: { type: "string" },
              ollamaTextModel: { type: "string" },
              ollamaVisionModel: { type: "string" },
              openaiTextModel: { type: "string" },
              openaiVisionModel: { type: "string" },
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

  // Update LLM provider settings
  app.put(
    "/settings/llm-provider",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["settings"],
        summary: "Update LLM provider settings",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            llmProvider: { type: "string", enum: ["openai", "ollama"] },
            ollamaBaseUrl: { type: "string" },
            ollamaTextModel: { type: "string" },
            ollamaVisionModel: { type: "string" },
            openaiTextModel: { type: "string" },
            openaiVisionModel: { type: "string" },
          },
        },
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
      const body = request.body as Partial<LLMProviderSettings>;
      await updateLLMProviderSettings(request.user!.id, body);
      return reply.send({ success: true });
    }
  );

  // Get available Ollama models
  app.get(
    "/settings/ollama/models",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["settings"],
        summary: "Get available Ollama models",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              models: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    size: { type: "number" },
                    modified_at: { type: "string" },
                  },
                },
              },
            },
          },
          503: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const settings = await getUserSettings(request.user!.id);
      try {
        const models = await getOllamaModels(settings.ollamaBaseUrl);
        return reply.send({ models });
      } catch {
        return reply.status(503).send({ error: "Ollama non raggiungibile" });
      }
    }
  );

  // Test Ollama connection
  app.post(
    "/settings/ollama/test",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["settings"],
        summary: "Test Ollama connection",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            baseUrl: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              models: {
                type: "array",
                items: { type: "string" },
              },
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { baseUrl } = request.body as { baseUrl?: string };
      const url = baseUrl || "http://ollama:11434";
      const result = await testOllamaConnection(url);
      return reply.send(result);
    }
  );

  // Get user license info
  app.get(
    "/settings/license",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["settings"],
        summary: "Get user license and PDF limit info",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              licenseTier: { type: "string" },
              pdfLimit: { type: "number" },
              pdfCount: { type: "number" },
              remainingPdfs: { type: "number" },
              isLimitReached: { type: "boolean" },
              licenseExpiresAt: { type: "string", nullable: true },
              isLicenseActive: { type: "boolean" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const licenseInfo = await getUserLicenseInfo(request.user!.id);
      return reply.send({
        ...licenseInfo,
        licenseExpiresAt: licenseInfo.licenseExpiresAt?.toISOString() ?? null,
      });
    }
  );

  // Update user license (admin endpoint)
  app.put(
    "/settings/license",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["settings"],
        summary: "Update user license tier (admin)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["userId", "licenseTier"],
          properties: {
            userId: { type: "string" },
            licenseTier: { type: "string", enum: [...LICENSE_TIERS] },
            expiresAt: { type: "string", nullable: true },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
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
      const { userId, licenseTier, expiresAt } = request.body as {
        userId: string;
        licenseTier: LicenseTier;
        expiresAt?: string | null;
      };

      try {
        await setUserLicense(
          userId,
          licenseTier,
          expiresAt ? new Date(expiresAt) : null
        );
        return reply.send({ success: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Errore durante l'aggiornamento";
        return reply.status(400).send({ error: message });
      }
    }
  );
}
