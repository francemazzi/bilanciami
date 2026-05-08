import * as fs from "fs/promises";
import * as path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "documents");
type StorageDocumentKind = "invoice" | "ddt";

export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export function generateStoragePath(
  userId: string,
  documentId: string,
  fileName: string,
  documentKind: StorageDocumentKind = "invoice"
): string {
  const ext = path.extname(fileName) || ".pdf";
  const baseName = path.basename(fileName, ext);
  const safeName = baseName.replace(/[^a-zA-Z0-9-_]/g, "_");
  return path.join(userId, documentKind, documentId, `${safeName}${ext}`);
}

export async function savePdf(
  buffer: Buffer,
  userId: string,
  documentId: string,
  fileName: string,
  documentKind: StorageDocumentKind = "invoice"
): Promise<string> {
  await ensureUploadDir();

  const relativePath = generateStoragePath(userId, documentId, fileName, documentKind);
  const fullPath = path.join(UPLOAD_DIR, relativePath);

  // Create directory structure
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  // Write file
  await fs.writeFile(fullPath, buffer);

  return relativePath;
}

export async function getPdf(storagePath: string): Promise<Buffer> {
  const fullPath = path.join(UPLOAD_DIR, storagePath);
  return fs.readFile(fullPath);
}

export async function deletePdf(storagePath: string): Promise<void> {
  const fullPath = path.join(UPLOAD_DIR, storagePath);
  try {
    await fs.unlink(fullPath);
    // Try to remove empty parent directories
    const parentDir = path.dirname(fullPath);
    const files = await fs.readdir(parentDir);
    if (files.length === 0) {
      await fs.rmdir(parentDir);
    }
  } catch {
    // Ignore errors if file doesn't exist
  }
}

export async function pdfExists(storagePath: string): Promise<boolean> {
  const fullPath = path.join(UPLOAD_DIR, storagePath);
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}
