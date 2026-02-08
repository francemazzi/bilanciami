import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createTextLLM } from "../../../services/llm.service.js";
import type { ChatAgentStateType, ChatIntent } from "../state.js";

const SYSTEM_PROMPT = `Sei un assistente AI per contabili italiani.
Analizza la richiesta dell'utente e classifica l'intento.

Classifica come:
- "query_data": L'utente vuole dati specifici dal database fatture
  Esempi: "quali fatture sono scadute?", "quanto devo incassare?", "mostrami le fatture di Mario Rossi"

- "analyze_data": L'utente vuole un'analisi complessa o comparativa
  Esempi: "chi sono i migliori fornitori?", "trend delle vendite", "confronta questo mese con l'anno scorso"

- "simple_answer": Domanda generica che non richiede accesso al database
  Esempi: "cos'è l'IVA?", "come funziona la fatturazione elettronica?", "cosa significa TD24?"

- "unclear": L'intento non è chiaro e serve chiarimento

Rispondi SOLO con una di queste parole: query_data, analyze_data, simple_answer, unclear`;

const VALID_INTENTS: ChatIntent[] = [
  "query_data",
  "analyze_data",
  "simple_answer",
  "unclear",
];

/**
 * Nodo che classifica l'intento della richiesta utente
 */
export async function intentClassifierNode(
  state: ChatAgentStateType
): Promise<Partial<ChatAgentStateType>> {
  try {
    const llmSettings = state.llmSettings || { provider: "openai" as const };
    const llm = createTextLLM(llmSettings);

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(state.userInput),
    ];

    const response = await llm.invoke(messages);
    const intentRaw = (response.content as string).toLowerCase().trim();

    // Valida l'intento
    const intent: ChatIntent = VALID_INTENTS.includes(intentRaw as ChatIntent)
      ? (intentRaw as ChatIntent)
      : "unclear";

    return {
      intent,
      messages: [new HumanMessage(state.userInput)],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      intent: "unclear",
      errors: [`Classificazione intento fallita: ${errorMessage}`],
    };
  }
}
