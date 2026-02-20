import { useAuthStore } from '../stores/auth.store';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function handleUnauthorized(): Promise<boolean> {
  if (isRefreshing) {
    return refreshPromise!;
  }

  isRefreshing = true;
  refreshPromise = refreshAccessToken();

  const success = await refreshPromise;

  isRefreshing = false;
  refreshPromise = null;

  if (!success) {
    useAuthStore.getState().logout();
  }

  return success;
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 - try to refresh token cookie
  if (response.status === 401) {
    const refreshed = await handleUnauthorized();

    if (refreshed) {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.message || error.error || `HTTP ${response.status}`,
      response.status,
      error
    );
  }

  return response.json();
}

export async function apiRequestFormData<T>(
  endpoint: string,
  formData: FormData,
  options?: Omit<RequestInit, 'body'>
): Promise<T> {
  const headers: HeadersInit = {
    ...options?.headers,
  };

  let response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    body: formData,
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 - try to refresh token cookie
  if (response.status === 401) {
    const refreshed = await handleUnauthorized();

    if (refreshed) {
      response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        body: formData,
        ...options,
        headers,
        credentials: 'include',
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.message || error.error || `HTTP ${response.status}`,
      response.status,
      error
    );
  }

  return response.json();
}
