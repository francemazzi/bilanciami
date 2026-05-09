import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createTextLLM } from "../../../services/llm.service.js";
import { ddtTools } from "../tools/index.js";
import type { ChatAgentStateType } from "../state.js";

const SYSTEM_PROMPT = `Sei un assistente specializzato nell'analisi di DDT (Documenti di Trasporto) e degli articoli ordinati/consegnati.

Hai a disposizione tool dedicati per:
- ricerca DDT (ddt_search)
- top prodotti più ricevuti (ddt_top_products)
- ranking fornitori per consegne (ddt_supplier_ranking)
- storico consegne di un articolo (ddt_article_history)
- analisi periodo con confronto (ddt_period_analysis)
- catalogo prodotti per fornitore (ddt_product_catalog)

REGOLE:
1. Scegli SEMPRE il tool più adatto alla richiesta dell'utente.
2. Estrai dai messaggi dell'utente i parametri opzionali (periodo, fornitore, codice prodotto, date) e passali al tool.
3. Periodo: "questo mese" → month, "questo trimestre" → quarter, "questo/quest'anno" → year, altrimenti → all.
4. Devi SEMPRE invocare esattamente un tool. Non rispondere mai in linguaggio naturale.
5. Il parametro userId verrà aggiunto automaticamente: NON inventarlo, passa una stringa vuota se richiesto.`;

/**
 * Nodo che invoca uno dei tool DDT scelto dall'LLM via tool-calling.
 */
export async function ddtToolCallingNode(
  state: ChatAgentStateType
): Promise<Partial<ChatAgentStateType>> {
  try {
    const llmSettings = state.llmSettings || { provider: "openai" as const };
    const llm = createTextLLM(llmSettings);

    if (typeof (llm as { bindTools?: unknown }).bindTools !== "function") {
      return {
        errors: [
          "Il provider LLM corrente non supporta tool-calling. Configura OpenAI per usare le analisi DDT.",
        ],
      };
    }

    const llmWithTools = (
      llm as unknown as {
        bindTools: (tools: unknown[]) => typeof llm;
      }
    ).bindTools(ddtTools);

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(state.userInput),
    ];

    console.log(
      `[DDT-TOOL] User input: "${state.userInput}", provider: ${llmSettings.provider}`
    );

    const aiMsg = await llmWithTools.invoke(messages);
    const toolCalls = (aiMsg as { tool_calls?: Array<{ name: string; args: Record<string, unknown> }> })
      .tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      console.warn(`[DDT-TOOL] Nessun tool selezionato dall'LLM`);
      return {
        errors: [
          "Non sono riuscito a identificare l'analisi DDT richiesta. Riformula la domanda specificando articolo, fornitore o periodo.",
        ],
      };
    }

    const call = toolCalls[0];
    const tool = ddtTools.find((t) => t.name === call.name);
    if (!tool) {
      return { errors: [`Tool DDT "${call.name}" non disponibile`] };
    }

    // Forza userId dallo state — non lasciare che l'LLM lo inventi/ometta
    const args = { ...call.args, userId: state.userId };
    console.log(
      `[DDT-TOOL] Invoking ${call.name} with args: ${JSON.stringify({
        ...args,
        userId: "<redacted>",
      })}`
    );

    const result = await (tool as { invoke: (args: unknown) => Promise<unknown> }).invoke(args);
    const data = JSON.parse(result as string);

    return {
      toolResult: { toolName: call.name, data },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[DDT-TOOL] Error: ${errorMessage}`);
    return {
      errors: [`Esecuzione tool DDT fallita: ${errorMessage}`],
    };
  }
}
