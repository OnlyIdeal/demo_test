import { request, query } from '../lib/http';
import type { PageData, UsageRecord } from '../types/api';
export function getUsages(params: { page: number; pageSize: number; departmentId?: string; employeeId?: string; projectId?: string; startDate?: string; endDate?: string }) { return request<PageData<UsageRecord>>(`/usages${query(params)}`); }
export function createUsage(body: { employeeId: string; projectId?: string; toolId: string; usageType: string; quantity: number; originalCurrency: string; originalAmount: number; exchangeRate: number; amount: number; occurredAt: string }) { return request<{ id: string }>('/usages', { method: 'POST', body: JSON.stringify(body) }); }
