import { apiRequest, apiRequestFormData } from './client';
import type { JobCreatedResponse, JobStatusResponse } from './types';

export async function uploadPdfs(files: File[]): Promise<JobCreatedResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  return apiRequestFormData<JobCreatedResponse>('/invoices/extract', formData);
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  return apiRequest<JobStatusResponse>(`/invoices/jobs/${jobId}`);
}

export async function getInvoiceSchema(): Promise<Record<string, unknown>> {
  const response = await fetch('/api/v1/invoices/schema');
  if (!response.ok) {
    throw new Error('Failed to fetch schema');
  }
  return response.json();
}
