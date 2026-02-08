import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { adminMiddleware } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import {
  setUserLicense,
  LICENSE_TIERS,
  LICENSE_LIMITS,
  type LicenseTier,
} from "../services/license.service.js";

export async function adminRoutes(app: FastifyInstance) {
  // Get all users with license info
  app.get(
    "/admin/users",
    {
      preHandler: adminMiddleware,
      schema: {
        tags: ["admin"],
        summary: "Get all users with license info (admin only)",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              users: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    name: { type: "string" },
                    licenseTier: { type: "string" },
                    licenseExpiresAt: { type: "string", nullable: true },
                    pdfCount: { type: "number" },
                    pdfLimit: { type: "number" },
                    createdAt: { type: "string" },
                  },
                },
              },
              totalUsers: { type: "number" },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          licenseTier: true,
          licenseExpiresAt: true,
          createdAt: true,
          _count: {
            select: {
              documents: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const usersWithInfo = users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        licenseTier: user.licenseTier,
        licenseExpiresAt: user.licenseExpiresAt?.toISOString() ?? null,
        pdfCount: user._count.documents,
        pdfLimit: LICENSE_LIMITS[user.licenseTier as LicenseTier] ?? 20,
        createdAt: user.createdAt.toISOString(),
      }));

      return reply.send({
        users: usersWithInfo,
        totalUsers: users.length,
      });
    }
  );

  // Update user license
  app.put(
    "/admin/users/:userId/license",
    {
      preHandler: adminMiddleware,
      schema: {
        tags: ["admin"],
        summary: "Update user license tier (admin only)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["licenseTier"],
          properties: {
            licenseTier: { type: "string", enum: [...LICENSE_TIERS] },
            expiresAt: { type: "string", nullable: true },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  licenseTier: { type: "string" },
                  licenseExpiresAt: { type: "string", nullable: true },
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const { licenseTier, expiresAt } = request.body as {
        licenseTier: LicenseTier;
        expiresAt?: string | null;
      };

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return reply.status(404).send({ error: "Utente non trovato" });
      }

      await setUserLicense(
        userId,
        licenseTier,
        expiresAt ? new Date(expiresAt) : null
      );

      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          licenseTier: true,
          licenseExpiresAt: true,
        },
      });

      return reply.send({
        success: true,
        user: {
          ...updatedUser,
          licenseExpiresAt: updatedUser?.licenseExpiresAt?.toISOString() ?? null,
        },
      });
    }
  );

  // Get license tiers info
  app.get(
    "/admin/license-tiers",
    {
      preHandler: adminMiddleware,
      schema: {
        tags: ["admin"],
        summary: "Get available license tiers (admin only)",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              tiers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    limit: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const tiers = LICENSE_TIERS.map((tier) => ({
        id: tier,
        name: tier.charAt(0).toUpperCase() + tier.slice(1),
        limit: LICENSE_LIMITS[tier],
      }));

      return reply.send({ tiers });
    }
  );
}
