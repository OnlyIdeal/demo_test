import { request, query } from '../lib/http';
import type { Application, PageData, Project, Tool } from '../types/api';
export function getApplications(params: { page: number; pageSize: number; status?: string; type?: string }) { return request<PageData<Application>>(`/applications${query(params)}`); }
export function getProjects() { return request<Project[]>('/projects'); }
export function getTools() { return request<Tool[]>('/catalog/tools'); }
export function createApplication(body: { type: string; requestedAmount: number; projectId?: string; toolId?: string; reason: string; expectedUsage?: string; startDate?: string; endDate?: string }) { return request<{ id: string; applicationNo: string }>('/applications', { method: 'POST', body: JSON.stringify(body) }); }
export function approveApplication(id: string, comment: string, approvedAmount?: number) { return request<{ id: string; status: string }>(`/applications/${id}/approve`, { method: 'POST', body: JSON.stringify({ comment, approvedAmount }) }); }
export function rejectApplication(id: string, comment: string) { return request<{ id: string; status: string }>(`/applications/${id}/reject`, { method: 'POST', body: JSON.stringify({ comment }) }); }
