import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createTextLLM } from "../../../services/llm.service.js";
import type { ChatAgentStateType } from "../state.js";

const SYSTEM_PROMPT = `Sei un assistente AI specializzato in contabilità italiana.
Rispondi SEMPRE in italiano, in modo chiaro e professionale.

## REGOLA CRITICA: NON INVENTARE MAI DATI
- NON inventare, fabbricare o indovinare MAI dati, numeri, nomi di clienti, importi o fatture.
- Mostra SOLO dati reali provenienti dai risultati delle query del database.
- Se non hai risultati di query, NON creare tabelle di esempio con dati fittizi.
- Se non ci sono dati disponibili, dì chiaramente che non hai trovato dati e suggerisci di riformulare la domanda.
- Ogni dato che presenti DEVE provenire dai risultati della query forniti nel contesto.

## Linee guida per le risposte

### Con risultati query:
- Presenta SOLO i dati reali ricevuti dalla query, niente di più
- Usa formattazione markdown per tabelle se ci sono più righe
- Fornisci insight utili sui dati (totali, medie, osservazioni)
- Suggerisci azioni concrete se rilevante:
  - Per fatture scadute: suggerisci solleciti
  - Per fornitori: evidenzia i top performer
  - Per previsioni: segnala mesi critici

### Formattazione tabelle:
| Colonna1 | Colonna2 | Colonna3 |
|----------|----------|----------|
| valore   | valore   | valore   |

### Formattazione importi:
- Usa sempre il simbolo € dopo il numero
- Formatta con separatore migliaia: 1.234,56 €

### Se l'operazione è stata annullata:
- Conferma che non è stata eseguita
- Chiedi se puoi aiutare in altro modo

### Se ci sono errori:
- Spiega il problema in modo comprensibile
- Suggerisci come riformulare la richiesta

### Per risposte semplici (senza query):
- Rispondi SOLO a domande teoriche/generiche di contabilità
- NON menzionare dati specifici dell'utente (fatture, clienti, importi)
- Cita fonti normative italiane se rilevante (DPR 633/72, etc.)
- Se la domanda riguarda dati dell'utente ma non hai risultati di query, dì: "Non ho trovato dati relativi alla tua richiesta. Prova a riformulare la domanda."`;

/**
 * Nodo che genera la risposta finale in italiano
 */
export async function responseGeneratorNode(
  state: ChatAgentStateType
): Promise<Partial<ChatAgentStateType>> {
  try {
    const llmSettings = state.llmSettings || { provider: "openai" as const };
    const llm = createTextLLM(llmSettings);

    // Costruisce il contesto basato sullo stato
    const userName = state.userName || "utente";
    let contextInfo = `Stai rispondendo all'utente: ${userName}. Mostra SOLO i dati di questo utente.\n\n`;

    console.log(`[RESPONSE] Intent: ${state.intent}, hasQueryResult: ${!!state.queryResult}, errors: ${JSON.stringify(state.errors)}, hasSqlQuery: ${!!state.sqlQuery}`);

    if (state.humanApprovalStatus === "rejected") {
      contextInfo += "L'utente ha annullato l'operazione richiesta.";
    } else if (state.queryResult) {
      const { data, rowCount, executionTime } = state.queryResult;
      contextInfo += `Risultati query (${rowCount} righe, ${executionTime}ms):\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;

      if (state.sqlQuery?.description) {
        contextInfo = `Query eseguita: ${state.sqlQuery.description}\n\n${contextInfo}`;
      }
    } else if (state.errors.length > 0) {
      contextInfo += `Errori riscontrati:\n- ${state.errors.join("\n- ")}`;
    } else if (state.intent === "simple_answer") {
      contextInfo += "Rispondi alla domanda teorica senza accedere al database. NON inventare dati, fatture o importi.";
    } else {
      contextInfo += "Non sono disponibili risultati dal database. NON inventare dati. Informa l'utente che non hai trovato risultati.";
    }

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      // Include storia conversazione precedente
      ...state.messages.slice(-10), // Ultimi 10 messaggi per contesto
      new HumanMessage(
        `Richiesta utente: ${state.userInput}\n\n---\n\n${contextInfo}`
      ),
    ];

    const response = await llm.invoke(messages);
    const responseText = response.content as string;

    return {
      response: responseText,
      messages: [new AIMessage(responseText)],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      response: `Mi dispiace, si è verificato un errore nel generare la risposta: ${errorMessage}`,
      errors: [`Generazione risposta fallita: ${errorMessage}`],
    };
  }
}
