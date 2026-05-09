import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { ChatAgentState, type ChatAgentStateType } from "./state.js";
import { intentClassifierNode } from "./nodes/intent-classifier.node.js";
import { sqlGeneratorNode } from "./nodes/sql-generator.node.js";
import { sqlExecutorNode } from "./nodes/sql-executor.node.js";
import { responseGeneratorNode } from "./nodes/response-generator.node.js";
import { ddtToolCallingNode } from "./nodes/ddt-tool-calling.node.js";
import type { LLMSettings } from "../../types/llm-provider.js";

// Checkpointer per persistenza stato (Human-in-the-Loop)
const checkpointer = new MemorySaver();

/**
 * Routing: determina il prossimo nodo basandosi sull'intento
 */
function routeByIntent(
  state: ChatAgentStateType
): "generateSQL" | "ddtToolCalling" | "generateResponse" {
  switch (state.intent) {
    case "query_data":
    case "analyze_data":
      return "generateSQL";
    case "ddt_query":
      return "ddtToolCalling";
    case "simple_answer":
    case "unclear":
    default:
      return "generateResponse";
  }
}

/**
 * Routing: controlla se serve approvazione umana o se eseguire direttamente
 */
function routeByApproval(
  state: ChatAgentStateType
): "executeSQL" | "generateResponse" | "waitApproval" {
  // Se ci sono errori nella generazione SQL, vai alla risposta
  if (state.errors.length > 0 && !state.sqlQuery) {
    return "generateResponse";
  }

  // Se serve approvazione e non è ancora stata data, aspetta
  if (state.needsHumanApproval && state.humanApprovalStatus === null) {
    return "waitApproval";
  }

  // Se rifiutato, genera risposta di annullamento
  if (state.humanApprovalStatus === "rejected") {
    return "generateResponse";
  }

  // Altrimenti esegui la query
  return "executeSQL";
}

/**
 * Nodo di attesa approvazione - ritorna messaggio per HITL
 */
async function waitApprovalNode(
  state: ChatAgentStateType
): Promise<Partial<ChatAgentStateType>> {
  return {
    response: `Ho preparato una query che richiede la tua approvazione.\n\n**${state.sqlQuery?.description}**\n\nVuoi procedere?`,
  };
}

/**
 * Crea il grafo dell'agente chat
 *
 * Flusso:
 * START → classify → [routing per intento]
 *                       ├─ query/analyze → generateSQL → [routing approvazione]
 *                       │                                  ├─ sensibile → INTERRUPT
 *                       │                                  ├─ rifiutato → generateResponse
 *                       │                                  └─ ok → executeSQL → generateResponse
 *                       └─ simple/unclear → generateResponse
 *                                                 ↓
 *                                                END
 */
export function createChatAgentGraph() {
  const graph = new StateGraph(ChatAgentState)
    // Nodi
    .addNode("classify", intentClassifierNode)
    .addNode("generateSQL", sqlGeneratorNode)
    .addNode("executeSQL", sqlExecutorNode)
    .addNode("ddtToolCalling", ddtToolCallingNode)
    .addNode("generateResponse", responseGeneratorNode)
    .addNode("waitApproval", waitApprovalNode)

    // Edges
    .addEdge(START, "classify")
    .addConditionalEdges("classify", routeByIntent, {
      generateSQL: "generateSQL",
      ddtToolCalling: "ddtToolCalling",
      generateResponse: "generateResponse",
    })
    .addConditionalEdges("generateSQL", routeByApproval, {
      executeSQL: "executeSQL",
      generateResponse: "generateResponse",
      waitApproval: "waitApproval",
    })
    .addEdge("executeSQL", "generateResponse")
    .addEdge("ddtToolCalling", "generateResponse")
    .addEdge("waitApproval", END) // Termina qui, aspetta approvazione
    .addEdge("generateResponse", END);

  return graph.compile({ checkpointer });
}

// Singleton instance
let graphInstance: ReturnType<typeof createChatAgentGraph> | null = null;

/**
 * Restituisce il singleton del grafo chat
 */
export function getChatAgentGraph() {
  if (!graphInstance) {
    graphInstance = createChatAgentGraph();
  }
  return graphInstance;
}

/**
 * Invia un messaggio all'assistente chat
 *
 * @param userInput - Messaggio dell'utente
 * @param userId - ID utente per filtrare documenti
 * @param llmSettings - Configurazione LLM
 * @param threadId - ID thread per continuare conversazione (opzionale)
 * @returns Risposta e metadata
 */
export async function chat(
  userInput: string,
  userId: string,
  userName: string,
  llmSettings: LLMSettings,
  threadId?: string
) {
  const graph = getChatAgentGraph();

  const config = {
    configurable: {
      thread_id: threadId || crypto.randomUUID(),
    },
  };

  const result = await graph.invoke(
    {
      userInput,
      userId,
      userName,
      llmSettings,
      threadId: config.configurable.thread_id,
    },
    config
  );

  return {
    response: result.response,
    threadId: config.configurable.thread_id,
    needsApproval:
      result.needsHumanApproval && result.humanApprovalStatus === null,
    sqlQuery: result.sqlQuery,
    errors: result.errors,
  };
}

/**
 * Continua dopo approvazione/rifiuto umano
 *
 * @param threadId - ID thread della conversazione
 * @param approved - true se approvato, false se rifiutato
 * @param feedback - Feedback opzionale per modificare la query
 * @returns Risposta dopo l'elaborazione
 */
export async function continueWithApproval(
  threadId: string,
  approved: boolean,
  feedback?: string
) {
  const graph = getChatAgentGraph();

  const config = {
    configurable: { thread_id: threadId },
  };

  // Aggiorna lo stato con la decisione umana
  const result = await graph.invoke(
    {
      humanApprovalStatus: approved ? "approved" : "rejected",
      humanFeedback: feedback || null,
    },
    config
  );

  return {
    response: result.response,
    threadId,
    errors: result.errors,
  };
}
