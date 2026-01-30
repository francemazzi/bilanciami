import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getUserById,
  updateUserProfile,
  type UpdateProfileInput,
} from "../services/auth.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const REFRESH_TOKEN_COOKIE = "refreshToken";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post(
    "/auth/register",
    {
      schema: {
        tags: ["auth"],
        summary: "Register a new user",
        body: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            name: { type: "string", minLength: 2 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string" },
                  createdAt: { type: "string" },
                },
              },
              accessToken: { type: "string" },
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
    async (
      request: FastifyRequest<{
        Body: { email: string; password: string; name: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const validatedInput = registerSchema.parse(request.body);

        const result = await registerUser(
          validatedInput,
          request.headers["user-agent"],
          request.ip,
        );

        // Set refresh token as httpOnly cookie
        reply.setCookie(
          REFRESH_TOKEN_COOKIE,
          result.tokens.refreshToken,
          COOKIE_OPTIONS,
        );

        return reply.status(201).send({
          user: result.user,
          accessToken: result.tokens.accessToken,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Errore durante la registrazione";
        return reply.status(400).send({
          error: "Bad Request",
          message,
        });
      }
    },
  );

  // Login
  app.post(
    "/auth/login",
    {
      schema: {
        tags: ["auth"],
        summary: "Login user",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string" },
                  createdAt: { type: "string" },
                },
              },
              accessToken: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: { email: string; password: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const validatedInput = loginSchema.parse(request.body);

        const result = await loginUser(
          validatedInput,
          request.headers["user-agent"],
          request.ip,
        );

        // Set refresh token as httpOnly cookie
        reply.setCookie(
          REFRESH_TOKEN_COOKIE,
          result.tokens.refreshToken,
          COOKIE_OPTIONS,
        );

        return reply.send({
          user: result.user,
          accessToken: result.tokens.accessToken,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Errore durante il login";
        return reply.status(401).send({
          error: "Unauthorized",
          message,
        });
      }
    },
  );

  // Refresh token
  app.post(
    "/auth/refresh",
    {
      schema: {
        tags: ["auth"],
        summary: "Refresh access token using refresh token from cookie",
        response: {
          200: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
            },
          },
          401: {
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
      try {
        const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE];

        if (!refreshToken) {
          return reply.status(401).send({
            error: "Unauthorized",
            message: "Refresh token mancante",
          });
        }

        const result = await refreshAccessToken(refreshToken);

        return reply.send(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Errore durante il refresh";
        return reply.status(401).send({
          error: "Unauthorized",
          message,
        });
      }
    },
  );

  // Logout
  app.post(
    "/auth/logout",
    {
      schema: {
        tags: ["auth"],
        summary: "Logout user and invalidate refresh token",
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
      const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE];

      if (refreshToken) {
        await logoutUser(refreshToken);
      }

      // Clear cookie
      reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });

      return reply.send({ success: true });
    },
  );

  // Get current user
  app.get(
    "/auth/me",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["auth"],
        summary: "Get current authenticated user",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string" },
                  createdAt: { type: "string" },
                },
              },
            },
          },
          401: {
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
      if (!request.user) {
        return reply.status(401).send({
          error: "Unauthorized",
          message: "Non autenticato",
        });
      }

      const user = await getUserById(request.user.id);

      if (!user) {
        return reply.status(401).send({
          error: "Unauthorized",
          message: "Utente non trovato",
        });
      }

      return reply.send({ user });
    },
  );

  // Update profile
  app.put(
    "/auth/profile",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["auth"],
        summary: "Update user profile",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 2 },
            email: { type: "string", format: "email" },
            currentPassword: { type: "string" },
            newPassword: { type: "string", minLength: 8 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string" },
                  createdAt: { type: "string" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
          401: {
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
      if (!request.user) {
        return reply.status(401).send({
          error: "Unauthorized",
          message: "Non autenticato",
        });
      }

      try {
        const user = await updateUserProfile(
          request.user.id,
          request.body as UpdateProfileInput,
        );
        return reply.send({ user });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Errore durante l'aggiornamento";
        return reply.status(400).send({
          error: "Bad Request",
          message,
        });
      }
    },
  );
}
