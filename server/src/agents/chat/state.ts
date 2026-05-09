import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { LLMSettings } from "../../types/llm-provider.js";

/**
 * Tipi di intento riconosciuti dal classificatore
 */
export type ChatIntent =
  | "query_data" // Richiede dati dal database (fatture)
  | "analyze_data" // Analisi complessa (fatture)
  | "ddt_query" // Domande/analisi su DDT, articoli ordinati, consegne
  | "simple_answer" // Risposta senza DB
  | "unclear"; // Intento non chiaro

/**
 * Risultato dell'invocazione di un tool DDT
 */
export interface ToolResult {
  toolName: string;
  data: unknown;
}

/**
 * Query SQL generata con metadati di sicurezza
 */
export interface SQLQuery {
  sql: string;
  params: unknown[];
  description: string;
  isSensitive: boolean;
  sensitiveReason?: string;
}

/**
 * Risultato dell'esecuzione query
 */
export interface QueryResult {
  data: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

/**
 * Stato dell'agente chat per LangGraph
 *
 * Gestisce il flusso conversazionale con supporto per:
 * - Classificazione intento
 * - Generazione ed esecuzione SQL
 * - Human-in-the-Loop per operazioni sensibili
 * - Persistenza conversazione tramite threadId
 */
export const ChatAgentState = Annotation.Root({
  // Messaggi della conversazione
  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: (existing, newMsgs) => [...existing, ...newMsgs],
  }),

  // Input corrente dell'utente
  userInput: Annotation<string>,

  // ID utente per filtrare i documenti
  userId: Annotation<string>,

  // Nome utente per contestualizzare le risposte
  userName: Annotation<string>({
    default: () => "",
    reducer: (existing, newVal) => newVal || existing,
  }),

  // Settings LLM dell'utente
  llmSettings: Annotation<LLMSettings | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

  // Classificazione dell'intento
  intent: Annotation<ChatIntent | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

  // Query SQL generata
  sqlQuery: Annotation<SQLQuery | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

  // Risultato della query
  queryResult: Annotation<QueryResult | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

  // Risultato del tool DDT (branch tool-calling)
  toolResult: Annotation<ToolResult | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

  // Flag per Human-in-the-Loop
  needsHumanApproval: Annotation<boolean>({
    default: () => false,
    reducer: (_, newVal) => newVal,
  }),

  // Stato approvazione umana
  humanApprovalStatus: Annotation<"pending" | "approved" | "rejected" | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

  // Feedback umano (modifiche alla query)
  humanFeedback: Annotation<string | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

  // Risposta finale generata
  response: Annotation<string | null>({
    default: () => null,
    reducer: (_, newVal) => newVal,
  }),

  // Errori accumulati
  errors: Annotation<string[]>({
    default: () => [],
    reducer: (existing, newErrors) => [...existing, ...newErrors],
  }),

  // Thread ID per persistenza conversazione
  threadId: Annotation<string>({
    default: () => crypto.randomUUID(),
    reducer: (existing, newVal) => newVal || existing,
  }),
});

export type ChatAgentStateType = typeof ChatAgentState.State;
