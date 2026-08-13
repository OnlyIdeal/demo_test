import type { ApiResponse } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken() { return localStorage.getItem('ai_ems_token'); }

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, 0, '网络连接异常，请检查后端服务是否启动');
  }
  const payload = await response.json().catch(() => null) as ApiResponse<T> | null;
  if (!response.ok || !payload || payload.code < 200 || payload.code >= 300) {
    if (response.status === 401) localStorage.removeItem('ai_ems_token');
    throw new ApiError(response.status, payload?.code ?? response.status, payload?.msg ?? '请求失败', payload?.data);
  }
  return payload.data;
}

export function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') search.set(key, String(value)); });
  return search.toString() ? `?${search.toString()}` : '';
}
