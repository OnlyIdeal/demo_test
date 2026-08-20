import { request, query } from '../lib/http';
import type { AdminUser, Alert, Budget, Department, PageData, Permission, Quota, RoleConfig, Tool, UserOption, UserRole } from '../types/api';
export function getBudgets(year: number) { return request<Budget[]>(`/budgets/annual${query({ year })}`); }
export function getQuotas(year: number) { return request<Quota[]>(`/quotas/overview${query({ year })}`); }
export function getAlerts(params: { page: number; pageSize: number; status?: string; level?: string }) { return request<PageData<Alert>>(`/alerts${query(params)}`); }
export function markAlertRead(id: string) { return request<{ id: string; status: string }>(`/alerts/${id}/read`, { method: 'PATCH' }); }
export function getCatalogTools() { return request<Tool[]>('/catalog/tools'); }
export function saveBudget(body: { departmentId: string; year: number; initialAmount: number; status: string }) { return request<{ id: string }>('/budgets/annual', { method: 'PUT', body: JSON.stringify(body) }); }
export function saveQuota(body: { departmentId: string; year: number; allocatedAmount: number }) { return request<{ id: string }>('/quotas', { method: 'PUT', body: JSON.stringify(body) }); }
export function updateToolStatus(id: string, status: string) { return request<{ id: string; status: string }>(`/catalog/tools/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
export function getDepartments() { return request<Department[]>('/departments'); }
export function getUserOptions() { return request<UserOption[]>('/users/options'); }
export function getUsers() { return request<AdminUser[]>('/admin/users'); }
export function createUser(body: { username: string; password: string; name: string; email: string; role: UserRole; departmentId: string }) { return request<{ id: string }>('/admin/users', { method: 'POST', body: JSON.stringify(body) }); }
export function updateUser(id: string, body: Partial<Pick<AdminUser, 'name' | 'email' | 'role' | 'departmentId' | 'status'>>) { return request<{ id: string }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); }
export function getRoles() { return request<{ roles: RoleConfig[]; permissions: Permission[] }>('/admin/roles'); }
export function updateRolePermissions(id: UserRole, permissionIds: string[]) { return request<{ roleId: UserRole; permissions: string[] }>(`/admin/roles/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions: permissionIds }) }); }
