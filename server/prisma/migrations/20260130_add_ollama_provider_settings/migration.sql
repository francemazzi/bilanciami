-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN "llmProvider" TEXT NOT NULL DEFAULT 'openai';
ALTER TABLE "user_settings" ADD COLUMN "ollamaBaseUrl" TEXT NOT NULL DEFAULT 'http://ollama:11434';
ALTER TABLE "user_settings" ADD COLUMN "ollamaTextModel" TEXT NOT NULL DEFAULT 'llama3.2:3b';
ALTER TABLE "user_settings" ADD COLUMN "ollamaVisionModel" TEXT NOT NULL DEFAULT 'llava:7b-v1.6-mistral-q4_K_M';
ALTER TABLE "user_settings" ADD COLUMN "openaiTextModel" TEXT NOT NULL DEFAULT 'gpt-4o';
ALTER TABLE "user_settings" ADD COLUMN "openaiVisionModel" TEXT NOT NULL DEFAULT 'gpt-4o';
