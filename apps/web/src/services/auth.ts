import { request } from '../lib/http';
import type { ApiResponse, DashboardOverview, User } from '../types/api';

export async function login(username: string, password: string) {
  return request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}
export async function getCurrentUser() { return request<User>('/auth/me'); }
export async function getDashboardOverview(year: number) { return request<DashboardOverview>(`/dashboard/overview?year=${year}`); }
