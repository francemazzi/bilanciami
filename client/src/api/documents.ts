import { apiRequest } from './client';

export type FollowUpStatus = 'gestita' | 'richiesta_saldo' | 'sollecitata' | 'da_gestire';
export type DocumentKind = 'invoice' | 'ddt';

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
  documentKind: DocumentKind | null;
  documentNumber: string | null;
  invoiceId: string | null;
  documentDate: string | null;
  dueDate: string | null;
  totalAmount: string | null;
  pdfStoragePath: string | null;
  followUpStatus: FollowUpStatus | null;
  done: boolean;
  userNotes: string | null;
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
  documentKind?: DocumentKind;
  fromDate?: string;
  toDate?: string;
}

export async function getDocuments(params?: DocumentsListParams): Promise<Document[]> {
  const searchParams = new URLSearchParams();
  if (params?.customerName) searchParams.set('customerName', params.customerName);
  if (params?.supplierName) searchParams.set('supplierName', params.supplierName);
  if (params?.documentKind) searchParams.set('documentKind', params.documentKind);
  if (params?.fromDate) searchParams.set('fromDate', params.fromDate);
  if (params?.toDate) searchParams.set('toDate', params.toDate);

  const query = searchParams.toString();
  return apiRequest<Document[]>(`/documents${query ? `?${query}` : ''}`);
}

export async function getDocument(id: string): Promise<Document> {
  return apiRequest<Document>(`/documents/${id}`);
}

export async function getDocumentsTree(params?: Pick<DocumentsListParams, 'documentKind'>): Promise<TreeNode> {
  const searchParams = new URLSearchParams();
  if (params?.documentKind) searchParams.set('documentKind', params.documentKind);
  const query = searchParams.toString();
  return apiRequest<TreeNode>(`/documents/tree${query ? `?${query}` : ''}`);
}

export interface DdtArticleHistoryItem {
  documentId: string;
  documentNumber: string | null;
  documentDate: string | null;
  fileName: string;
  supplierName: string;
  recipientName: string;
  productCode: string | null;
  description: string;
  quantity: number | null;
  unitOfMeasure: string | null;
}

export interface DdtArticleHistoryParams {
  supplierName?: string;
  productCode?: string;
  fromDate?: string;
  toDate?: string;
}

export async function getDdtArticleHistory(
  params?: DdtArticleHistoryParams
): Promise<DdtArticleHistoryItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.supplierName) searchParams.set('supplierName', params.supplierName);
  if (params?.productCode) searchParams.set('productCode', params.productCode);
  if (params?.fromDate) searchParams.set('fromDate', params.fromDate);
  if (params?.toDate) searchParams.set('toDate', params.toDate);

  const query = searchParams.toString();
  return apiRequest<DdtArticleHistoryItem[]>(`/documents/ddt/article-history${query ? `?${query}` : ''}`);
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

export async function updateFollowUpStatus(
  id: string,
  followUpStatus: FollowUpStatus | null
): Promise<{ id: string; followUpStatus: FollowUpStatus | null; updatedAt: string }> {
  return apiRequest(`/documents/${id}/follow-up`, {
    method: 'PATCH',
    body: JSON.stringify({ followUpStatus }),
  });
}

export async function updateDocumentDone(
  id: string,
  done: boolean
): Promise<{ id: string; done: boolean; updatedAt: string }> {
  return apiRequest(`/documents/${id}/done`, {
    method: 'PATCH',
    body: JSON.stringify({ done }),
  });
}

export async function updateDocumentUserNotes(
  id: string,
  userNotes: string | null
): Promise<{ id: string; userNotes: string | null; updatedAt: string }> {
  return apiRequest(`/documents/${id}/user-notes`, {
    method: 'PATCH',
    body: JSON.stringify({ userNotes }),
  });
}

export interface SollecitoResponse {
  emailTo: string;
  subject: string;
  body: string;
}

export async function generateSollecito(documentId: string): Promise<SollecitoResponse> {
  return apiRequest<SollecitoResponse>(`/documents/${documentId}/sollecito`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
