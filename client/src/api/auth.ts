import { apiRequest } from './client';
import type { User } from '../stores/auth.store';

interface AuthResponse {
  user: User;
  accessToken: string;
}

interface RefreshResponse {
  accessToken: string;
}

interface MeResponse {
  user: User;
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
    credentials: 'include',
  });
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
}

export async function logout(): Promise<void> {
  await apiRequest<{ success: boolean }>('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

export async function refreshToken(): Promise<RefreshResponse> {
  // Direct fetch to avoid circular dependency with apiRequest
  // This endpoint uses httpOnly cookie, not Authorization header
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  return response.json();
}

export async function getMe(accessToken: string): Promise<MeResponse> {
  return apiRequest<MeResponse>('/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export async function updateProfile(data: UpdateProfileInput): Promise<MeResponse> {
  return apiRequest<MeResponse>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
    credentials: 'include',
  });
}
