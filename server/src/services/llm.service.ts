import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import type { LLMSettings } from "../types/llm-provider.js";

const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_OLLAMA_TEXT_MODEL = "llama3.2:3b";
const DEFAULT_OLLAMA_VISION_MODEL = "llava:7b-v1.6-mistral-q4_K_M";
const DEFAULT_OLLAMA_BASE_URL = "http://ollama:11434";

export function createTextLLM(settings: LLMSettings): ChatOpenAI | ChatOllama {
  if (settings.provider === "ollama") {
    return new ChatOllama({
      baseUrl: settings.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL,
      model: settings.ollamaTextModel || DEFAULT_OLLAMA_TEXT_MODEL,
      temperature: 0,
      format: "json",
    });
  }

  // Default to OpenAI
  return new ChatOpenAI({
    model: settings.openaiTextModel || DEFAULT_OPENAI_MODEL,
    temperature: 0,
    apiKey: settings.openaiApiKey || undefined,
  });
}

export function createVisionLLM(settings: LLMSettings): ChatOpenAI | ChatOllama {
  if (settings.provider === "ollama") {
    return new ChatOllama({
      baseUrl: settings.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL,
      model: settings.ollamaVisionModel || DEFAULT_OLLAMA_VISION_MODEL,
      temperature: 0,
      format: "json",
    });
  }

  // Default to OpenAI
  return new ChatOpenAI({
    model: settings.openaiVisionModel || DEFAULT_OPENAI_MODEL,
    temperature: 0,
    apiKey: settings.openaiApiKey || undefined,
  });
}

export async function testOllamaConnection(
  baseUrl: string = DEFAULT_OLLAMA_BASE_URL
): Promise<{ success: boolean; models?: string[]; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (response.ok) {
      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      return {
        success: true,
        models: data.models?.map((m) => m.name) || [],
      };
    }
    return { success: false, error: "Risposta non valida da Ollama" };
  } catch (e) {
    return {
      success: false,
      error: `Connessione fallita: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function getOllamaModels(
  baseUrl: string = DEFAULT_OLLAMA_BASE_URL
): Promise<Array<{ name: string; size: number; modified_at: string }>> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (response.ok) {
      const data = (await response.json()) as {
        models?: Array<{ name: string; size: number; modified_at: string }>;
      };
      return data.models || [];
    }
    return [];
  } catch {
    return [];
  }
}
