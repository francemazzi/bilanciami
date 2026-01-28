import "dotenv/config";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load OpenAI API key from root .env if not already set
if (!process.env.OPENAI_API_KEY) {
  const rootEnvPath = path.resolve(__dirname, "..", "..", ".env");
  if (fs.existsSync(rootEnvPath)) {
    const envContent = fs.readFileSync(rootEnvPath, "utf-8");
    const match = envContent.match(/OPENAI_API_KEY=(.+)/);
    if (match) {
      process.env.OPENAI_API_KEY = match[1].trim();
    }
  }
}

// Ensure OPENAI_API_KEY is available
if (!process.env.OPENAI_API_KEY) {
  console.error(
    "ERROR: OPENAI_API_KEY must be set in environment or in ../.env file"
  );
  process.exit(1);
}

console.log("Test setup complete. OpenAI API key loaded.");
