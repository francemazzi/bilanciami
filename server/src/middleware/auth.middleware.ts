import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

const ACCESS_TOKEN_COOKIE = "accessToken";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = request.cookies[ACCESS_TOKEN_COOKIE];

  if (!token) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Token mancante",
    });
  }

  try {
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Utente non trovato",
      });
    }

    request.user = user;
  } catch (error) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Token non valido o scaduto",
    });
  }
}

// Admin email - only this user can access admin routes
const ADMIN_EMAIL = "francemazzi@gmail.com";

export function isAdmin(email: string): boolean {
  return email === ADMIN_EMAIL;
}

export async function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = request.cookies[ACCESS_TOKEN_COOKIE];

  if (!token) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Token mancante",
    });
  }

  try {
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Utente non trovato",
      });
    }

    // Check if user is admin
    if (!isAdmin(user.email)) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accesso riservato agli amministratori",
      });
    }

    request.user = user;
  } catch (error) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Token non valido o scaduto",
    });
  }
}

export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = request.cookies[ACCESS_TOKEN_COOKIE];

  if (!token) {
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (user) {
      request.user = user;
    }
  } catch {
    // Token invalid, but auth is optional so continue
  }
}
