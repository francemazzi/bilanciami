import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createTextLLM } from "../../../services/llm.service.js";
import type { ChatAgentStateType, SQLQuery } from "../state.js";

const SYSTEM_PROMPT = `Sei un esperto SQL che genera query per un database PostgreSQL di fatture italiane.

## Schema Database

### Tabella "documents" (fatture)
- id: UUID (primary key)
- customerName: VARCHAR - Nome cliente della fattura
- supplierName: VARCHAR - Nome fornitore della fattura
- invoiceId: VARCHAR - Numero fattura (es. "FAT-2024-001")
- documentDate: TIMESTAMP - Data emissione documento
- dueDate: TIMESTAMP - Data scadenza pagamento
- totalAmount: FLOAT - Importo totale in EUR
- done: BOOLEAN - Flag che indica se la fattura è stata completata/gestita (default false)
- followUpStatus: VARCHAR - Stato di follow-up: 'gestita', 'richiesta_saldo', 'sollecitata', 'da_gestire', oppure NULL se non ancora impostato
- userNotes: TEXT - Note personali dell'utente sulla fattura
- metadata: JSONB - Dati completi fattura (supplier, customer, line_items, totals, payment_details)
- createdAt, updatedAt: TIMESTAMP

### Tabella "users_on_documents" (associazione utente-documento)
- userId: UUID
- documentId: UUID
- role: VARCHAR (viewer, editor, owner)

## Campi JSONB metadata principali
- metadata->'supplier'->>'name' - Nome fornitore
- metadata->'supplier'->>'vat_number' - P.IVA fornitore
- metadata->'customer'->>'name' - Nome cliente
- metadata->'customer'->>'vat_number' - P.IVA cliente
- metadata->'totals'->>'total_amount' - Importo totale
- metadata->'totals'->>'total_vat' - Totale IVA
- metadata->'payment_details'->>'due_date' - Scadenza
- metadata->'payment_details'->>'iban' - IBAN

## Logica "da gestire" / "ancora da fare"
Una fattura è considerata "da gestire" o "ancora da fare" quando:
- done = false (non completata)
- followUpStatus IS NULL oppure followUpStatus != 'gestita'

Una fattura è considerata "gestita" / "completata" quando:
- done = true OPPURE followUpStatus = 'gestita'

## Regole OBBLIGATORIE

1. SEMPRE filtrare per userId usando JOIN:
   FROM documents d
   JOIN users_on_documents ud ON d.id = ud."documentId"
   WHERE ud."userId" = $1

2. Usa parametri $1, $2, etc. per valori dinamici (MAI inserire valori direttamente)

3. $1 è SEMPRE lo userId

4. Restituisci SOLO un oggetto JSON valido con questa struttura:
{
  "sql": "SELECT ... FROM documents d JOIN users_on_documents ud ON d.id = ud.\"documentId\" WHERE ud.\"userId\" = $1 AND ...",
  "params": [],
  "description": "Breve descrizione in italiano",
  "isSensitive": false,
  "sensitiveReason": null
}

## Operazioni SENSIBILI (isSensitive: true)
- DELETE, UPDATE, INSERT
- Query che potrebbero esporre dati sensibili (IBAN, P.IVA)
- Export di grandi quantità di dati (senza LIMIT)

## Esempi

Richiesta: "fatture scadute"
{
  "sql": "SELECT d.\"invoiceId\", d.\"customerName\", d.\"dueDate\", d.\"totalAmount\" FROM documents d JOIN users_on_documents ud ON d.id = ud.\"documentId\" WHERE ud.\"userId\" = $1 AND d.\"dueDate\" < NOW() ORDER BY d.\"dueDate\" ASC",
  "params": [],
  "description": "Fatture con data scadenza passata",
  "isSensitive": false
}

Richiesta: "totale da incassare questo mese"
{
  "sql": "SELECT COALESCE(SUM(d.\"totalAmount\"), 0) as totale FROM documents d JOIN users_on_documents ud ON d.id = ud.\"documentId\" WHERE ud.\"userId\" = $1 AND d.\"dueDate\" >= DATE_TRUNC('month', NOW()) AND d.\"dueDate\" < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'",
  "params": [],
  "description": "Somma importi fatture in scadenza questo mese",
  "isSensitive": false
}

Richiesta: "fatture da gestire" / "fatture ancora da fare" / "cosa devo ancora gestire"
{
  "sql": "SELECT d.\"invoiceId\", d.\"supplierName\", d.\"customerName\", d.\"dueDate\", d.\"totalAmount\", d.\"followUpStatus\" FROM documents d JOIN users_on_documents ud ON d.id = ud.\"documentId\" WHERE ud.\"userId\" = $1 AND d.done = false AND (d.\"followUpStatus\" IS NULL OR d.\"followUpStatus\" != 'gestita') ORDER BY d.\"dueDate\" ASC NULLS LAST",
  "params": [],
  "description": "Fatture non ancora gestite o completate",
  "isSensitive": false
}

Richiesta: "fatture sollecitate"
{
  "sql": "SELECT d.\"invoiceId\", d.\"supplierName\", d.\"customerName\", d.\"dueDate\", d.\"totalAmount\", d.\"followUpStatus\" FROM documents d JOIN users_on_documents ud ON d.id = ud.\"documentId\" WHERE ud.\"userId\" = $1 AND d.\"followUpStatus\" = 'sollecitata' ORDER BY d.\"dueDate\" ASC",
  "params": [],
  "description": "Fatture con stato sollecitata",
  "isSensitive": false
}`;

/**
 * Nodo che genera query SQL dalla richiesta utente
 */
export async function sqlGeneratorNode(
  state: ChatAgentStateType
): Promise<Partial<ChatAgentStateType>> {
  try {
    const llmSettings = state.llmSettings || { provider: "openai" as const };
    const llm = createTextLLM(llmSettings);

    // Include feedback umano se presente (per retry dopo modifica)
    const userPrompt = state.humanFeedback
      ? `Richiesta originale: ${state.userInput}\n\nModifica richiesta dall'utente: ${state.humanFeedback}`
      : state.userInput;

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(userPrompt),
    ];

    console.log(`[SQL-GEN] User input: "${state.userInput}", provider: ${llmSettings.provider}`);

    const response =
      llmSettings.provider === "openai"
        ? await llm.invoke(messages, {
            response_format: { type: "json_object" },
          })
        : await llm.invoke(messages);

    const content = response.content as string;
    console.log(`[SQL-GEN] LLM response: ${content.substring(0, 500)}`);

    // Estrai JSON dalla risposta (gestisce markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Nessun JSON valido nella risposta");
    }

    const sqlQuery = JSON.parse(jsonMatch[0]) as SQLQuery;

    // Prepend userId ai params (sempre $1)
    sqlQuery.params = [state.userId, ...(sqlQuery.params || [])];

    console.log(`[SQL-GEN] Generated SQL: ${sqlQuery.sql}`);
    console.log(`[SQL-GEN] Params: ${JSON.stringify(sqlQuery.params)}`);

    return {
      sqlQuery,
      needsHumanApproval: sqlQuery.isSensitive,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SQL-GEN] Error: ${errorMessage}`);
    return {
      errors: [`Generazione SQL fallita: ${errorMessage}`],
    };
  }
}
