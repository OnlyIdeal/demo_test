export type UserRole = 'employee' | 'manager' | 'budget_admin' | 'system_admin';

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: UserRole;
  departmentId: string;
  departmentName?: string;
  permissions: string[];
}

export interface ApiResponse<T> { code: number; msg: string; data: T; }
export interface PageData<T> { items: T[]; pagination: { page: number; pageSize: number; total: number; totalPages: number }; }
export interface DashboardOverview { year: number; budget: { totalAmount: number; usedAmount: number; remainingAmount: number; executionRate: number }; quota: { allocatedAmount: number; usedAmount: number; remainingAmount: number; usageRate: number }; unreadAlertCount: number; }
export interface UsageRecord { id: string; employeeId: string; employeeName: string; departmentId: string; departmentName: string; projectId?: string; projectName?: string; toolId: string; toolName: string; modelId?: string; amount: number; quantity: number; usageType: string; occurredAt: string; }
export interface ApplicationReview { id: string; stage: 'manager' | 'budget_admin'; action: 'approved' | 'rejected'; reviewerName: string; reviewerComment: string; approvedAmount?: number; reviewedAt: string; }
export interface Application { id: string; applicationNo: string; type: string; applicantId: string; applicantName: string; departmentId: string; departmentName: string; requestedAmount: number; approvedAmount?: number; reason: string; expectedUsage?: string; status: string; approvalStage: 'manager' | 'budget_admin' | 'completed'; submittedAt?: string; reviewedAt?: string; reviews?: ApplicationReview[]; }
export interface Project { id: string; name: string; code: string; departmentId: string; departmentName: string; status: string; }
export interface Tool { id: string; name: string; vendor: string; billingType: string; currency: string; status: string; modelCount: number; }
export interface Budget { id: string; departmentId: string; departmentName: string; year: number; initialAmount: number; increaseAmount: number; totalAmount: number; usedAmount: number; remainingAmount: number; executionRate: number; status: string; }
export interface Quota { id: string; departmentId: string; departmentName: string; year: number; allocatedAmount: number; usedAmount: number; remainingAmount: number; usageRate: number; }
export interface Alert { id: string; type: string; level: string; employeeId?: string; departmentId?: string; projectId?: string; applicationId?: string; title: string; message: string; allocatedAmount?: number; usedAmount?: number; usageRate?: number; status: string; occurredAt: string; }
export interface Department { id: string; code: string; name: string; status: string; }
export interface UserOption { id: string; name: string; departmentId: string; departmentName: string; }
export interface AdminUser { id: string; username: string; name: string; email: string; role: UserRole; departmentId: string; departmentName: string; status: string; }
export interface Permission { id: string; name: string; module: string; description: string; }
export interface RoleConfig { id: UserRole; name: string; description: string; dataScope: 'self' | 'department' | 'global'; status: string; permissions: string[]; }
