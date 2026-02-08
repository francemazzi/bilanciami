import { prisma } from "../../../lib/prisma.js";
import type { ChatAgentStateType } from "../state.js";

/**
 * Pattern SQL pericolosi da bloccare
 */
const DANGEROUS_PATTERNS = [
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /TRUNCATE/i,
  /ALTER\s+TABLE/i,
  /CREATE\s+TABLE/i,
  /GRANT/i,
  /REVOKE/i,
  /DELETE\s+FROM/i,
  /UPDATE\s+.*\s+SET/i,
  /INSERT\s+INTO/i,
];

/**
 * Valida la sicurezza della query SQL
 */
function validateSQL(sql: string): { valid: boolean; reason?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sql)) {
      return {
        valid: false,
        reason: `Operazione non permessa: ${pattern.source}`,
      };
    }
  }

  // Verifica che sia una SELECT
  if (!sql.trim().toUpperCase().startsWith("SELECT")) {
    return {
      valid: false,
      reason: "Solo query SELECT sono permesse",
    };
  }

  return { valid: true };
}

/**
 * Nodo che esegue la query SQL con validazione di sicurezza
 */
export async function sqlExecutorNode(
  state: ChatAgentStateType
): Promise<Partial<ChatAgentStateType>> {
  // Nessuna query da eseguire
  if (!state.sqlQuery) {
    return {
      errors: ["Nessuna query SQL da eseguire"],
    };
  }

  // Se rifiutato dall'utente, non eseguire
  if (state.humanApprovalStatus === "rejected") {
    return {
      queryResult: null,
    };
  }

  const { sql, params } = state.sqlQuery;

  // Validazione sicurezza
  const validation = validateSQL(sql);
  if (!validation.valid) {
    return {
      errors: [`Query bloccata: ${validation.reason}`],
    };
  }

  try {
    const startTime = Date.now();

    // Esegue query raw con Prisma
    const result = await prisma.$queryRawUnsafe(sql, ...(params || []));

    const executionTime = Date.now() - startTime;
    const data = Array.isArray(result)
      ? (result as Record<string, unknown>[])
      : [result as Record<string, unknown>];

    return {
      queryResult: {
        data,
        rowCount: data.length,
        executionTime,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      errors: [`Esecuzione query fallita: ${errorMessage}`],
    };
  }
}
