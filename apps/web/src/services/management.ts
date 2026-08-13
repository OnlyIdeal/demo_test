import { request, query } from '../lib/http';
import type { Alert, Budget, PageData, Quota, Tool } from '../types/api';
export function getBudgets(year: number) { return request<Budget[]>(`/budgets/annual${query({ year })}`); }
export function getQuotas(year: number) { return request<Quota[]>(`/quotas/overview${query({ year })}`); }
export function getAlerts(params: { page: number; pageSize: number; status?: string; level?: string }) { return request<PageData<Alert>>(`/alerts${query(params)}`); }
export function markAlertRead(id: string) { return request<{ id: string; status: string }>(`/alerts/${id}/read`, { method: 'PATCH' }); }
export function getCatalogTools() { return request<Tool[]>('/catalog/tools'); }
