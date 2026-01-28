import { apiRequestFormData } from './client';
import type { ExtractionResponse } from './types';

export async function uploadPdfs(files: File[]): Promise<ExtractionResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  return apiRequestFormData<ExtractionResponse>('/invoices/extract', formData);
}

export async function getInvoiceSchema(): Promise<Record<string, unknown>> {
  const response = await fetch('/api/v1/invoices/schema');
  if (!response.ok) {
    throw new Error('Failed to fetch schema');
  }
  return response.json();
}
