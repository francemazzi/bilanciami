export type LLMProviderType = "openai" | "ollama";

export interface LLMSettings {
  provider: LLMProviderType;

  // OpenAI specific
  openaiApiKey?: string | null;
  openaiTextModel?: string;
  openaiVisionModel?: string;

  // Ollama specific
  ollamaBaseUrl?: string;
  ollamaTextModel?: string;
  ollamaVisionModel?: string;
}

export interface LLMProviderSettings {
  llmProvider: LLMProviderType;
  ollamaBaseUrl: string;
  ollamaTextModel: string;
  ollamaVisionModel: string;
  openaiTextModel: string;
  openaiVisionModel: string;
}
