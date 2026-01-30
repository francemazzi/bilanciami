import { prisma } from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/encryption.js";
import type {
  LLMProviderType,
  LLMSettings,
  LLMProviderSettings,
} from "../types/llm-provider.js";

export interface UserSettingsData {
  hasOpenaiApiKey: boolean;
  openaiApiKeyLastChars?: string;
  llmProvider: LLMProviderType;
  ollamaBaseUrl: string;
  ollamaTextModel: string;
  ollamaVisionModel: string;
  openaiTextModel: string;
  openaiVisionModel: string;
}

export async function getUserSettings(userId: string): Promise<UserSettingsData> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  const baseSettings: UserSettingsData = {
    hasOpenaiApiKey: false,
    llmProvider: (settings?.llmProvider as LLMProviderType) || "openai",
    ollamaBaseUrl: settings?.ollamaBaseUrl || "http://ollama:11434",
    ollamaTextModel: settings?.ollamaTextModel || "llama3.2:3b",
    ollamaVisionModel: settings?.ollamaVisionModel || "llava:7b-v1.6-mistral-q4_K_M",
    openaiTextModel: settings?.openaiTextModel || "gpt-4o",
    openaiVisionModel: settings?.openaiVisionModel || "gpt-4o",
  };

  if (!settings || !settings.openaiApiKeyEncrypted) {
    return baseSettings;
  }

  const decrypted = decrypt({
    encrypted: settings.openaiApiKeyEncrypted,
    iv: settings.openaiApiKeyIv!,
    tag: settings.openaiApiKeyTag!,
  });

  return {
    ...baseSettings,
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

export async function getLLMProviderSettings(
  userId: string
): Promise<LLMProviderSettings> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  return {
    llmProvider: (settings?.llmProvider as LLMProviderType) || "openai",
    ollamaBaseUrl: settings?.ollamaBaseUrl || "http://ollama:11434",
    ollamaTextModel: settings?.ollamaTextModel || "llama3.2:3b",
    ollamaVisionModel: settings?.ollamaVisionModel || "llava:7b-v1.6-mistral-q4_K_M",
    openaiTextModel: settings?.openaiTextModel || "gpt-4o",
    openaiVisionModel: settings?.openaiVisionModel || "gpt-4o",
  };
}

export async function updateLLMProviderSettings(
  userId: string,
  settings: Partial<LLMProviderSettings>
): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      llmProvider: settings.llmProvider,
      ollamaBaseUrl: settings.ollamaBaseUrl,
      ollamaTextModel: settings.ollamaTextModel,
      ollamaVisionModel: settings.ollamaVisionModel,
      openaiTextModel: settings.openaiTextModel,
      openaiVisionModel: settings.openaiVisionModel,
    },
    update: {
      ...(settings.llmProvider !== undefined && {
        llmProvider: settings.llmProvider,
      }),
      ...(settings.ollamaBaseUrl !== undefined && {
        ollamaBaseUrl: settings.ollamaBaseUrl,
      }),
      ...(settings.ollamaTextModel !== undefined && {
        ollamaTextModel: settings.ollamaTextModel,
      }),
      ...(settings.ollamaVisionModel !== undefined && {
        ollamaVisionModel: settings.ollamaVisionModel,
      }),
      ...(settings.openaiTextModel !== undefined && {
        openaiTextModel: settings.openaiTextModel,
      }),
      ...(settings.openaiVisionModel !== undefined && {
        openaiVisionModel: settings.openaiVisionModel,
      }),
    },
  });
}

export async function getFullLLMSettings(userId: string): Promise<LLMSettings> {
  const providerSettings = await getLLMProviderSettings(userId);
  const openaiApiKey = await getDecryptedOpenaiApiKey(userId);

  return {
    provider: providerSettings.llmProvider,
    openaiApiKey,
    openaiTextModel: providerSettings.openaiTextModel,
    openaiVisionModel: providerSettings.openaiVisionModel,
    ollamaBaseUrl: providerSettings.ollamaBaseUrl,
    ollamaTextModel: providerSettings.ollamaTextModel,
    ollamaVisionModel: providerSettings.ollamaVisionModel,
  };
}
