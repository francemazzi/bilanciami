import { prisma } from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/encryption.js";

export interface UserSettingsData {
  hasOpenaiApiKey: boolean;
  openaiApiKeyLastChars?: string;
}

export async function getUserSettings(userId: string): Promise<UserSettingsData> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings || !settings.openaiApiKeyEncrypted) {
    return { hasOpenaiApiKey: false };
  }

  const decrypted = decrypt({
    encrypted: settings.openaiApiKeyEncrypted,
    iv: settings.openaiApiKeyIv!,
    tag: settings.openaiApiKeyTag!,
  });

  return {
    hasOpenaiApiKey: true,
    openaiApiKeyLastChars: decrypted.slice(-4),
  };
}

export async function setOpenaiApiKey(
  userId: string,
  apiKey: string
): Promise<void> {
  const encrypted = encrypt(apiKey);

  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      openaiApiKeyEncrypted: encrypted.encrypted,
      openaiApiKeyIv: encrypted.iv,
      openaiApiKeyTag: encrypted.tag,
    },
    update: {
      openaiApiKeyEncrypted: encrypted.encrypted,
      openaiApiKeyIv: encrypted.iv,
      openaiApiKeyTag: encrypted.tag,
    },
  });
}

export async function deleteOpenaiApiKey(userId: string): Promise<void> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (settings) {
    await prisma.userSettings.update({
      where: { userId },
      data: {
        openaiApiKeyEncrypted: null,
        openaiApiKeyIv: null,
        openaiApiKeyTag: null,
      },
    });
  }
}

export async function getDecryptedOpenaiApiKey(
  userId: string
): Promise<string | null> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (!settings || !settings.openaiApiKeyEncrypted) {
    return null;
  }

  return decrypt({
    encrypted: settings.openaiApiKeyEncrypted,
    iv: settings.openaiApiKeyIv!,
    tag: settings.openaiApiKeyTag!,
  });
}
