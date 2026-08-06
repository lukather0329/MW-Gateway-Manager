const API_BASE = '/api';

let cachedCsrfToken: string | null = null;

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  const res = await fetch(`${API_BASE}/auth/csrf-token`, { credentials: 'include' });
  const data = await res.json();
  cachedCsrfToken = data.csrfToken;
  return cachedCsrfToken as string;
}

export function resetCsrfToken(): void {
  cachedCsrfToken = null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isMutating = method !== 'GET';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isMutating) {
    headers['x-csrf-token'] = await getCsrfToken();
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? `요청 실패 (${res.status})`, data?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
