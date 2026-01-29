import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
  type JwtPayload,
} from "../lib/jwt.js";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema.js";

const SALT_ROUNDS = 10;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export async function registerUser(
  input: RegisterInput,
  userAgent?: string,
  ipAddress?: string
): Promise<AuthResult> {
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new Error("Email già registrata");
  }

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  // Generate tokens
  const payload: JwtPayload = { userId: user.id, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Save session
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      userAgent,
      ipAddress,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return {
    user,
    tokens: { accessToken, refreshToken },
  };
}

export async function loginUser(
  input: LoginInput,
  userAgent?: string,
  ipAddress?: string
): Promise<AuthResult> {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new Error("Credenziali non valide");
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

  if (!isValidPassword) {
    throw new Error("Credenziali non valide");
  }

  // Generate tokens
  const payload: JwtPayload = { userId: user.id, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Save session
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      userAgent,
      ipAddress,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    tokens: { accessToken, refreshToken },
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string }> {
  // Verify token signature
  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new Error("Refresh token non valido");
  }

  // Find session in database
  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: { user: true },
  });

  if (!session) {
    throw new Error("Sessione non trovata");
  }

  if (session.expiresAt < new Date()) {
    // Delete expired session
    await prisma.session.delete({ where: { id: session.id } });
    throw new Error("Sessione scaduta");
  }

  // Generate new access token
  const newPayload: JwtPayload = {
    userId: session.user.id,
    email: session.user.email,
  };
  const accessToken = signAccessToken(newPayload);

  return { accessToken };
}

export async function logoutUser(refreshToken: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { refreshToken },
  });
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  return user;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Utente non trovato");
  }

  // Check if email is being changed and if it's already taken
  if (input.email && input.email !== user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser) {
      throw new Error("Email già in uso");
    }
  }

  // If changing password, verify current password
  if (input.newPassword) {
    if (!input.currentPassword) {
      throw new Error("Password attuale richiesta per cambiare la password");
    }
    const isValidPassword = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("Password attuale non corretta");
    }
  }

  // Prepare update data
  const updateData: { name?: string; email?: string; passwordHash?: string } = {};

  if (input.name) {
    updateData.name = input.name;
  }
  if (input.email) {
    updateData.email = input.email;
  }
  if (input.newPassword) {
    updateData.passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  return updatedUser;
}
