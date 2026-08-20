import { and, desc, eq, gte, like, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { aiModels, aiTools, alerts, annualBudgets, applications, departmentQuotas, departments, projects, usageRecords, users } from '../db/schema.js';
import { created, fail, ok, pageSchema, readBody, readQuery } from '../lib/http.js';
import { requireRole } from '../lib/auth.js';
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const loginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });
const listQuery = pageSchema.extend({ departmentId: z.string().trim().min(1).optional(), employeeId: z.string().trim().min(1).optional(), projectId: z.string().trim().min(1).optional(), startDate: z.string().trim().min(1).optional(), endDate: z.string().trim().min(1).optional() });
const applicationCreateSchema = z.object({ type: z.enum(['quota', 'budget_increase', 'tool_access', 'extra_usage']), requestedAmount: z.number().positive(), projectId: z.string().trim().min(1).optional(), toolId: z.string().trim().min(1).optional(), budgetId: z.string().trim().min(1).optional(), reason: z.string().trim().min(1), expectedUsage: z.string().trim().min(1).optional(), startDate: z.string().trim().min(1).optional(), endDate: z.string().trim().min(1).optional() });
const reviewSchema = z.object({ comment: z.string().trim().min(1).max(500), approvedAmount: z.number().nonnegative().optional() });
const budgetIncreaseSchema = z.object({ budgetId: z.string().trim().min(1), requestedAmount: z.number().positive(), projectId: z.string().trim().min(1).optional(), reason: z.string().trim().min(1) });
const usageCreateSchema = z.object({ employeeId: z.string().trim().min(1), departmentId: z.string().trim().min(1), projectId: z.string().trim().min(1).optional(), toolId: z.string().trim().min(1), modelId: z.string().trim().min(1).optional(), applicationId: z.string().trim().min(1).optional(), usageType: z.enum(['seat', 'token', 'credit', 'call', 'fixed']), quantity: z.number().nonnegative(), originalCurrency: z.enum(['CNY', 'USD']), originalAmount: z.number().nonnegative(), exchangeRate: z.number().positive().default(1), amount: z.number().nonnegative(), occurredAt: z.string().trim().min(1) });
const readAlertSchema = z.object({ id: z.string().trim().min(1) });

function paginated<T>(items: T[], page: number, pageSize: number, total: number) { return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }; }
function scopeCondition(user: { role: string; departmentId: string; id: string }, departmentId?: string, employeeId?: string) {
  if (user.role === 'employee') return eq(usageRecords.employeeId, user.id);
  if (user.role === 'manager') return eq(usageRecords.departmentId, user.departmentId);
  if (employeeId) return eq(usageRecords.employeeId, employeeId);
  if (departmentId) return eq(usageRecords.departmentId, departmentId);
  return undefined;
}

export async function registerRoutes(app: FastifyInstance) {
  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = readBody(request, loginSchema);
    const user = await db.select().from(users).where(eq(users.username, body.username)).get();
    if (!user || user.status !== 'active') return fail(reply, 401, '用户名或密码错误');
    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) return fail(reply, 401, '用户名或密码错误');
    const token = await app.jwt.sign({ id: user.id, username: user.username, name: user.name, role: user.role, departmentId: user.departmentId });
    return ok(reply, { token, user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role, departmentId: user.departmentId } });
  });

  app.get('/api/v1/auth/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await db.select({ id: users.id, username: users.username, name: users.name, email: users.email, role: users.role, departmentId: users.departmentId, departmentName: departments.name }).from(users).leftJoin(departments, eq(users.departmentId, departments.id)).where(eq(users.id, request.user.id)).get();
    if (!user) return fail(reply, 401, '用户不存在');
    return ok(reply, user);
  });

  app.get('/api/v1/dashboard/overview', { preHandler: [app.authenticate] }, async (request, reply) => {
    const year = z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()).parse((request.query as { year?: string }).year);
    const budgetCondition = request.user.role === 'budget_admin' ? eq(annualBudgets.budgetYear, year) : request.user.role === 'employee' ? eq(annualBudgets.id, '__employee_has_no_department_budget_access__') : and(eq(annualBudgets.budgetYear, year), eq(annualBudgets.departmentId, request.user.departmentId));
    const quotaCondition = request.user.role === 'budget_admin' ? eq(departmentQuotas.quotaYear, year) : and(eq(departmentQuotas.quotaYear, year), eq(departmentQuotas.departmentId, request.user.departmentId));
    const budget = await db.select({ total: sql<number>`coalesce(sum(${annualBudgets.totalAmount}), 0)`, used: sql<number>`coalesce(sum(${annualBudgets.usedAmount}), 0)` }).from(annualBudgets).where(budgetCondition).get();
    const quota = await db.select({ allocated: sql<number>`coalesce(sum(${departmentQuotas.allocatedAmount}), 0)`, used: sql<number>`coalesce(sum(${departmentQuotas.usedAmount}), 0)` }).from(departmentQuotas).where(quotaCondition).get();
    const alertsResult = await db.select({ count: sql<number>`count(*)` }).from(alerts).where(and(eq(alerts.status, 'unread'), request.user.role === 'employee' ? eq(alerts.employeeId, request.user.id) : request.user.role === 'manager' ? eq(alerts.departmentId, request.user.departmentId) : undefined)).get();
    return ok(reply, { year, budget: { totalAmount: budget?.total ?? 0, usedAmount: budget?.used ?? 0, remainingAmount: (budget?.total ?? 0) - (budget?.used ?? 0), executionRate: budget?.total ? Number(((budget.used / budget.total) * 100).toFixed(2)) : 0 }, quota: { allocatedAmount: quota?.allocated ?? 0, usedAmount: quota?.used ?? 0, remainingAmount: (quota?.allocated ?? 0) - (quota?.used ?? 0), usageRate: quota?.allocated ? Number(((quota.used / quota.allocated) * 100).toFixed(2)) : 0 }, unreadAlertCount: alertsResult?.count ?? 0 });
  });

  app.get('/api/v1/usages', { preHandler: [app.authenticate] }, async (request, reply) => {
    const q = readQuery(request, listQuery); const conditions = [eq(usageRecords.status, 'confirmed'), scopeCondition(request.user, q.departmentId, q.employeeId), q.projectId ? eq(usageRecords.projectId, q.projectId) : undefined, q.startDate ? gte(usageRecords.occurredAt, q.startDate) : undefined, q.endDate ? lte(usageRecords.occurredAt, q.endDate) : undefined].filter(Boolean) as any[];
    const where = and(...conditions); const items = await db.select({ id: usageRecords.id, employeeId: usageRecords.employeeId, employeeName: users.name, departmentId: usageRecords.departmentId, departmentName: departments.name, projectId: usageRecords.projectId, projectName: projects.name, toolId: usageRecords.toolId, toolName: aiTools.name, modelId: usageRecords.modelId, amount: usageRecords.amount, quantity: usageRecords.quantity, usageType: usageRecords.usageType, occurredAt: usageRecords.occurredAt }).from(usageRecords).leftJoin(users, eq(usageRecords.employeeId, users.id)).leftJoin(departments, eq(usageRecords.departmentId, departments.id)).leftJoin(projects, eq(usageRecords.projectId, projects.id)).leftJoin(aiTools, eq(usageRecords.toolId, aiTools.id)).where(where).orderBy(desc(usageRecords.occurredAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const total = await db.select({ count: sql<number>`count(*)` }).from(usageRecords).where(where).get(); return ok(reply, paginated(items, q.page, q.pageSize, total?.count ?? 0));
  });

  app.post('/api/v1/usages', { preHandler: [app.authenticate, requireRole('budget_admin')] }, async (request, reply) => {
    const body = readBody(request, usageCreateSchema); const id = `usage_${randomUUID()}`;
    const employee = await db.select().from(users).where(eq(users.id, body.employeeId)).get(); if (!employee) return fail(reply, 400, '员工不存在');
    if (employee.departmentId !== body.departmentId) return fail(reply, 400, '员工与部门归属不一致');
    await db.insert(usageRecords).values({ id, ...body, createdBy: request.user.id, source: 'manual', status: 'confirmed' }).run(); return created(reply, { id });
  });

  app.get('/api/v1/budgets/annual', { preHandler: [app.authenticate, requireRole('manager', 'budget_admin')] }, async (request, reply) => {
    const year = z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()).parse((request.query as { year?: string }).year); const dept = request.user.role === 'budget_admin' ? undefined : eq(annualBudgets.departmentId, request.user.departmentId);
    const rows = await db.select({ id: annualBudgets.id, departmentId: annualBudgets.departmentId, departmentName: departments.name, year: annualBudgets.budgetYear, initialAmount: annualBudgets.initialAmount, increaseAmount: annualBudgets.increaseAmount, totalAmount: annualBudgets.totalAmount, usedAmount: annualBudgets.usedAmount, status: annualBudgets.status }).from(annualBudgets).leftJoin(departments, eq(annualBudgets.departmentId, departments.id)).where(and(eq(annualBudgets.budgetYear, year), dept)).orderBy(desc(annualBudgets.usedAmount)); return ok(reply, rows.map(row => ({ ...row, remainingAmount: row.totalAmount - row.usedAmount, executionRate: row.totalAmount ? Number(((row.usedAmount / row.totalAmount) * 100).toFixed(2)) : 0 })));
  });

  app.post('/api/v1/budgets/increase-requests', { preHandler: [app.authenticate, requireRole('manager', 'budget_admin')] }, async (request, reply) => {
    const body = readBody(request, budgetIncreaseSchema); const budget = await db.select().from(annualBudgets).where(eq(annualBudgets.id, body.budgetId)).get(); if (!budget) return fail(reply, 404, '年度预算不存在');
    if (request.user.role === 'manager' && budget.departmentId !== request.user.departmentId) return fail(reply, 403, '不能申请其他部门预算');
    const id = `app_${randomUUID()}`; const appNo = `APP-${Date.now()}`; await db.insert(applications).values({ id, applicationNo: appNo, type: 'budget_increase', applicantId: request.user.id, departmentId: budget.departmentId, projectId: body.projectId, budgetId: body.budgetId, requestedAmount: body.requestedAmount, reason: body.reason, status: 'pending', approvalStage: 'manager', submittedAt: new Date().toISOString(), createdAt: new Date().toISOString() }).run(); return created(reply, { id, applicationNo: appNo });
  });

  app.get('/api/v1/applications', { preHandler: [app.authenticate] }, async (request, reply) => {
    const q = readQuery(request, pageSchema.extend({ status: z.string().trim().min(1).optional(), type: z.string().trim().min(1).optional() })); const scope = request.user.role === 'employee' ? eq(applications.applicantId, request.user.id) : request.user.role === 'manager' ? eq(applications.departmentId, request.user.departmentId) : undefined; const where = and(scope, q.status ? eq(applications.status, q.status) : undefined, q.type ? eq(applications.type, q.type) : undefined); const items = await db.select({ id: applications.id, applicationNo: applications.applicationNo, type: applications.type, applicantId: applications.applicantId, applicantName: users.name, departmentId: applications.departmentId, departmentName: departments.name, requestedAmount: applications.requestedAmount, approvedAmount: applications.approvedAmount, reason: applications.reason, status: applications.status, approvalStage: applications.approvalStage, submittedAt: applications.submittedAt, reviewedAt: applications.reviewedAt }).from(applications).leftJoin(users, eq(applications.applicantId, users.id)).leftJoin(departments, eq(applications.departmentId, departments.id)).where(where).orderBy(desc(applications.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize); const total = await db.select({ count: sql<number>`count(*)` }).from(applications).where(where).get(); return ok(reply, paginated(items, q.page, q.pageSize, total?.count ?? 0));
  });

  app.post('/api/v1/applications', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = readBody(request, applicationCreateSchema); if (body.type === 'budget_increase' && request.user.role === 'employee') return fail(reply, 403, '员工不能直接提交预算增加申请'); const id = `app_${randomUUID()}`; const applicationNo = `APP-${Date.now()}`; await db.insert(applications).values({ id, applicationNo, type: body.type, applicantId: request.user.id, departmentId: request.user.departmentId, projectId: body.projectId, toolId: body.toolId, budgetId: body.budgetId, requestedAmount: body.requestedAmount, reason: body.reason, expectedUsage: body.expectedUsage, startDate: body.startDate, endDate: body.endDate, status: 'pending', approvalStage: 'manager', submittedAt: new Date().toISOString(), createdAt: new Date().toISOString() }).run(); return created(reply, { id, applicationNo });
  });

  app.get('/api/v1/applications/:id', { preHandler: [app.authenticate] }, async (request, reply) => { const id = z.string().trim().min(1).parse((request.params as { id: string }).id); const item = await db.select().from(applications).where(eq(applications.id, id)).get(); if (!item) return fail(reply, 404, '申请不存在'); if (request.user.role === 'employee' && item.applicantId !== request.user.id) return fail(reply, 403, '无权查看该申请'); if (request.user.role === 'manager' && item.departmentId !== request.user.departmentId) return fail(reply, 403, '无权查看该申请'); return ok(reply, item); });

  app.post('/api/v1/applications/:id/approve', { preHandler: [app.authenticate, requireRole('manager', 'budget_admin')] }, async (request, reply) => { const id = z.string().trim().min(1).parse((request.params as { id: string }).id); const body = readBody(request, reviewSchema); const item = await db.select().from(applications).where(eq(applications.id, id)).get(); if (!item) return fail(reply, 404, '申请不存在'); if (item.status !== 'pending') return fail(reply, 409, '当前申请不是待审批状态'); if (request.user.role === 'manager' && item.departmentId !== request.user.departmentId) return fail(reply, 403, '不能审批其他部门申请'); if (request.user.role === 'manager' && item.approvalStage !== 'manager') return fail(reply, 403, '当前申请不在主管审批阶段'); if (request.user.role === 'budget_admin' && item.approvalStage !== 'budget_admin') return fail(reply, 403, '当前申请不在预算管理员审批阶段'); const nextStage = request.user.role === 'manager' ? 'budget_admin' : 'completed'; const nextStatus = nextStage === 'completed' ? 'approved' : 'pending'; await db.update(applications).set({ status: nextStatus, approvalStage: nextStage, approvedAmount: body.approvedAmount ?? item.requestedAmount, reviewerId: request.user.id, reviewerComment: body.comment, reviewedAt: nextStage === 'completed' ? new Date().toISOString() : item.reviewedAt }).where(eq(applications.id, id)).run(); return ok(reply, { id, status: nextStatus, approvalStage: nextStage, message: nextStage === 'completed' ? '申请已最终通过' : '已通过主管审批，等待预算管理员审批' }); });

  app.post('/api/v1/applications/:id/reject', { preHandler: [app.authenticate, requireRole('manager', 'budget_admin')] }, async (request, reply) => { const id = z.string().trim().min(1).parse((request.params as { id: string }).id); const body = readBody(request, reviewSchema); const item = await db.select().from(applications).where(eq(applications.id, id)).get(); if (!item) return fail(reply, 404, '申请不存在'); if (!item || item.status !== 'pending') return fail(reply, 409, '当前申请不是待审批状态'); if (request.user.role === 'manager' && item.departmentId !== request.user.departmentId) return fail(reply, 403, '不能审批其他部门申请'); if (request.user.role === 'manager' && item.approvalStage !== 'manager') return fail(reply, 403, '当前申请不在主管审批阶段'); if (request.user.role === 'budget_admin' && item.approvalStage !== 'budget_admin') return fail(reply, 403, '当前申请不在预算管理员审批阶段'); await db.update(applications).set({ status: 'rejected', approvalStage: 'completed', reviewerId: request.user.id, reviewerComment: body.comment, reviewedAt: new Date().toISOString() }).where(eq(applications.id, id)).run(); return ok(reply, { id, status: 'rejected', message: '申请已驳回' }); });

  app.get('/api/v1/quotas/overview', { preHandler: [app.authenticate] }, async (request, reply) => { const year = z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()).parse((request.query as { year?: string }).year); const scope = request.user.role === 'budget_admin' ? eq(departmentQuotas.quotaYear, year) : and(eq(departmentQuotas.quotaYear, year), eq(departmentQuotas.departmentId, request.user.departmentId)); const rows = await db.select({ id: departmentQuotas.id, departmentId: departmentQuotas.departmentId, departmentName: departments.name, year: departmentQuotas.quotaYear, allocatedAmount: departmentQuotas.allocatedAmount, usedAmount: departmentQuotas.usedAmount }).from(departmentQuotas).leftJoin(departments, eq(departmentQuotas.departmentId, departments.id)).where(scope); return ok(reply, rows.map(row => ({ ...row, remainingAmount: row.allocatedAmount - row.usedAmount, usageRate: row.allocatedAmount ? Number(((row.usedAmount / row.allocatedAmount) * 100).toFixed(2)) : 0 }))); });

  app.get('/api/v1/alerts', { preHandler: [app.authenticate] }, async (request, reply) => { const q = readQuery(request, pageSchema.extend({ status: z.string().trim().min(1).optional(), level: z.string().trim().min(1).optional() })); const scope = request.user.role === 'employee' ? eq(alerts.employeeId, request.user.id) : request.user.role === 'manager' ? eq(alerts.departmentId, request.user.departmentId) : undefined; const where = and(scope, q.status ? eq(alerts.status, q.status) : undefined, q.level ? eq(alerts.level, q.level) : undefined); const items = await db.select().from(alerts).where(where).orderBy(desc(alerts.occurredAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize); const total = await db.select({ count: sql<number>`count(*)` }).from(alerts).where(where).get(); return ok(reply, paginated(items, q.page, q.pageSize, total?.count ?? 0)); });

  app.patch('/api/v1/alerts/:id/read', { preHandler: [app.authenticate] }, async (request, reply) => { const id = z.string().trim().min(1).parse((request.params as { id: string }).id); const item = await db.select().from(alerts).where(eq(alerts.id, id)).get(); if (!item) return fail(reply, 404, '预警不存在'); if (request.user.role === 'employee' && item.employeeId !== request.user.id) return fail(reply, 403, '无权操作该预警'); if (request.user.role === 'manager' && item.departmentId !== request.user.departmentId) return fail(reply, 403, '无权操作该预警'); await db.update(alerts).set({ status: 'read', readBy: request.user.id, readAt: new Date().toISOString() }).where(eq(alerts.id, id)).run(); return ok(reply, { id, status: 'read' }); });

  app.get('/api/v1/projects', { preHandler: [app.authenticate] }, async (request, reply) => { const scope = request.user.role === 'budget_admin' ? undefined : eq(projects.departmentId, request.user.departmentId); const rows = await db.select({ id: projects.id, code: projects.code, name: projects.name, departmentId: projects.departmentId, departmentName: departments.name, managerId: projects.managerId, status: projects.status }).from(projects).leftJoin(departments, eq(projects.departmentId, departments.id)).where(scope).orderBy(projects.name); return ok(reply, rows); });
  app.get('/api/v1/catalog/tools', { preHandler: [app.authenticate] }, async (_request, reply) => { const rows = await db.select({ id: aiTools.id, code: aiTools.code, name: aiTools.name, vendor: aiTools.vendor, billingType: aiTools.billingType, currency: aiTools.defaultCurrency, modelCount: sql<number>`count(${aiModels.id})` }).from(aiTools).leftJoin(aiModels, eq(aiModels.toolId, aiTools.id)).groupBy(aiTools.id).orderBy(aiTools.name); return ok(reply, rows); });
}


