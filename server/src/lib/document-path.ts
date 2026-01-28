/**
 * Utility per generare il path dei documenti
 * Formato: <data estrazione>/<nome customer>-<nome supplier>/
 */

/**
 * Formatta una data nel formato YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Sanitizza un nome per essere usato nel path (rimuove caratteri speciali)
 */
function sanitizeName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9\s-_]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

/**
 * Genera il path per un documento
 * @param extractionDate - Data di estrazione
 * @param customerName - Nome del customer
 * @param supplierName - Nome del supplier
 * @returns Path nel formato: YYYY-MM-DD/customer_name-supplier_name/
 */
export function generateDocumentPath(
  extractionDate: Date,
  customerName: string,
  supplierName: string
): string {
  const dateStr = formatDate(extractionDate);
  const customer = sanitizeName(customerName);
  const supplier = sanitizeName(supplierName);

  return `${dateStr}/${customer}-${supplier}/`;
}

/**
 * Genera il path completo per un file documento
 * @param extractionDate - Data di estrazione
 * @param customerName - Nome del customer
 * @param supplierName - Nome del supplier
 * @param fileName - Nome del file
 * @returns Path completo: YYYY-MM-DD/customer_name-supplier_name/filename
 */
export function generateDocumentFilePath(
  extractionDate: Date,
  customerName: string,
  supplierName: string,
  fileName: string
): string {
  const basePath = generateDocumentPath(extractionDate, customerName, supplierName);
  return `${basePath}${fileName}`;
}

/**
 * Estrae le informazioni dal path di un documento
 * @param filePath - Path del documento
 * @returns Oggetto con extractionDate, customerName, supplierName o null se invalido
 */
export function parseDocumentPath(filePath: string): {
  extractionDate: string;
  customerName: string;
  supplierName: string;
} | null {
  const match = filePath.match(/^(\d{4}-\d{2}-\d{2})\/([^-]+)-([^/]+)\//);
  if (!match) return null;

  return {
    extractionDate: match[1],
    customerName: match[2].replace(/_/g, " "),
    supplierName: match[3].replace(/_/g, " "),
  };
}
