import { apiRequest } from './client';

export interface Document {
  id: string;
  extractionDate: string;
  customerName: string;
  supplierName: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  metadata: Record<string, unknown> | null;
  invoiceId: string | null;
  documentDate: string | null;
  dueDate: string | null;
  totalAmount: string | null;
  pdfStoragePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TreeNode {
  type: 'folder' | 'file';
  name: string;
  path: string;
  children?: TreeNode[];
  document?: Document;
}

export interface DocumentsListParams {
  customerName?: string;
  supplierName?: string;
  fromDate?: string;
  toDate?: string;
}

export async function getDocuments(params?: DocumentsListParams): Promise<Document[]> {
  const searchParams = new URLSearchParams();
  if (params?.customerName) searchParams.set('customerName', params.customerName);
  if (params?.supplierName) searchParams.set('supplierName', params.supplierName);
  if (params?.fromDate) searchParams.set('fromDate', params.fromDate);
  if (params?.toDate) searchParams.set('toDate', params.toDate);

  const query = searchParams.toString();
  return apiRequest<Document[]>(`/documents${query ? `?${query}` : ''}`);
}

export async function getDocument(id: string): Promise<Document> {
  return apiRequest<Document>(`/documents/${id}`);
}

export async function getDocumentsTree(): Promise<TreeNode> {
  return apiRequest<TreeNode>('/documents/tree');
}

export async function updateDocumentMetadata(
  id: string,
  metadata: Record<string, unknown>
): Promise<{ id: string; metadata: Record<string, unknown>; updatedAt: string }> {
  return apiRequest(`/documents/${id}/metadata`, {
    method: 'PATCH',
    body: JSON.stringify({ metadata }),
  });
}

export async function deleteDocument(id: string): Promise<{ message: string }> {
  return apiRequest(`/documents/${id}`, {
    method: 'DELETE',
  });
}

export function getDocumentPdfUrl(id: string): string {
  return `/api/v1/documents/${id}/pdf`;
}
