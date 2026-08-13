import { request, query } from '../lib/http';
import type { PageData, UsageRecord } from '../types/api';
export function getUsages(params: { page: number; pageSize: number; departmentId?: string; employeeId?: string; projectId?: string; startDate?: string; endDate?: string }) { return request<PageData<UsageRecord>>(`/usages${query(params)}`); }
