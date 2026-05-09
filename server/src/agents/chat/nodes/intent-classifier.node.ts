import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createTextLLM } from "../../../services/llm.service.js";
import type { ChatAgentStateType, ChatIntent } from "../state.js";

const SYSTEM_PROMPT = `Sei un assistente AI per contabili italiani.
Analizza la richiesta dell'utente e classifica l'intento.

## REGOLA FONDAMENTALE
Se la richiesta menziona IN QUALSIASI MODO dati dell'utente (fatture, documenti, clienti, fornitori, importi, scadenze, pagamenti, incassi, spese, DDT, articoli, prodotti, consegne, ordinati), classifica SEMPRE come "query_data", "analyze_data" o "ddt_query". NON classificare MAI come "simple_answer" una richiesta che riguarda dati personali dell'utente.

Classifica come:
- "ddt_query": L'utente chiede informazioni o analisi su DDT (Documenti di Trasporto), articoli/prodotti ordinati o consegnati, codici prodotto, fornitori intesi come chi consegna merce, catalogo prodotti, storico consegne.
  Parole chiave: "DDT", "documento di trasporto", "articolo", "articoli", "prodotto", "prodotti", "ordinato", "ordinati", "consegna", "consegne", "ricevuto", "codice prodotto", "catalogo", "merce".
  Esempi: "quali prodotti ho ordinato di più?", "storico del codice ABC123", "DDT del fornitore X di marzo",
  "quanti DDT ho ricevuto questo mese?", "che articoli mi consegna Acme?", "catalogo prodotti di Beta srl",
  "chi mi consegna di più?", "quali sono gli articoli più ordinati?", "quanti articoli ho ricevuto quest'anno?"

- "query_data": L'utente vuole dati specifici dal database FATTURE (non DDT).
  Esempi: "quali fatture sono scadute?", "quanto devo incassare?", "mostrami le fatture di Mario Rossi",
  "quali fatture hai disponibile?", "quali fatture ho?", "elenca le mie fatture",
  "quanto devo pagare?", "chi mi deve pagare?", "fatture dell'anno", "fatture di questo mese"

- "analyze_data": L'utente vuole un'analisi complessa o comparativa SU FATTURE (non DDT)
  Esempi: "chi sono i migliori fornitori per fatturato?", "trend delle vendite", "confronta fatture di questo mese con l'anno scorso", "spese per categoria"

- "simple_answer": SOLO domande teoriche/generiche di contabilità che NON richiedono alcun dato dell'utente
  Esempi: "cos'è l'IVA?", "come funziona la fatturazione elettronica?", "cosa significa TD24?"

- "unclear": L'intento non è chiaro e serve chiarimento

## Regole di precedenza
- Se la richiesta menziona DDT/articoli/prodotti/consegne/ordinati → SEMPRE "ddt_query" (anche se cita anche fornitori).
- Se la richiesta menziona "fornitore" SENZA contesto DDT/articoli, è "query_data" o "analyze_data" (riferito alle fatture).
- Nel dubbio tra "query_data" e "simple_answer", scegli SEMPRE "query_data".

Rispondi SOLO con una di queste parole: query_data, analyze_data, ddt_query, simple_answer, unclear`;

const VALID_INTENTS: ChatIntent[] = [
  "query_data",
  "analyze_data",
  "ddt_query",
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

    console.log(`[INTENT] Input: "${state.userInput}" -> Intent: "${intent}" (raw: "${intentRaw}")`);

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
