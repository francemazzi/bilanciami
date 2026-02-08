import { apiRequest } from './client';
import type { LicenseTier } from './settings';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  licenseTier: LicenseTier;
  licenseExpiresAt: string | null;
  pdfCount: number;
  pdfLimit: number;
  createdAt: string;
}

export interface LicenseTierInfo {
  id: string;
  name: string;
  limit: number;
}

export async function getAdminUsers(): Promise<{
  users: AdminUser[];
  totalUsers: number;
}> {
  return apiRequest<{ users: AdminUser[]; totalUsers: number }>('/admin/users');
}

export async function updateUserLicense(
  userId: string,
  licenseTier: LicenseTier,
  expiresAt?: string | null
): Promise<{ success: boolean; user: AdminUser }> {
  return apiRequest<{ success: boolean; user: AdminUser }>(
    `/admin/users/${userId}/license`,
    {
      method: 'PUT',
      body: JSON.stringify({ licenseTier, expiresAt }),
    }
  );
}

export async function getLicenseTiers(): Promise<{ tiers: LicenseTierInfo[] }> {
  return apiRequest<{ tiers: LicenseTierInfo[] }>('/admin/license-tiers');
}
