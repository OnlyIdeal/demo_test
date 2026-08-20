import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { db, sqlite } from '../db/client.js';
import {
  aiModels, aiTools, alerts, annualBudgets, applicationReviews, applications,
  auditLogs, departmentQuotas, departments, permissions, projects,
  rolePermissions, roles, usageRecords, users,
} from '../db/schema.js';
import { created, fail, ok, pageSchema, readBody, readQuery } from '../lib/http.js';
import { getRolePermissions, requirePermission, type UserRole } from '../lib/auth.js';

const loginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });
const listQuery = pageSchema.extend({ departmentId: z.string().trim().min(1).optional(), employeeId: z.string().trim().min(1).optional(), projectId: z.string().trim().min(1).optional(), startDate: z.string().trim().min(1).optional(), endDate: z.string().trim().min(1).optional() });
const applicationCreateSchema = z.object({ type: z.enum(['quota', 'budget_increase', 'tool_access', 'extra_usage']), requestedAmount: z.number().positive(), projectId: z.string().trim().min(1).optional(), toolId: z.string().trim().min(1).optional(), budgetId: z.string().trim().min(1).optional(), reason: z.string().trim().min(1), expectedUsage: z.string().trim().min(1).optional(), startDate: z.string().trim().min(1).optional(), endDate: z.string().trim().min(1).optional() });
const reviewSchema = z.object({ comment: z.string().trim().min(1).max(500), approvedAmount: z.number().positive().optional() });
const budgetSchema = z.object({ departmentId: z.string().trim().min(1), year: z.number().int().min(2000).max(2100), initialAmount: z.number().nonnegative(), status: z.enum(['draft', 'active', 'closed']).default('active') });
const quotaSchema = z.object({ departmentId: z.string().trim().min(1), year: z.number().int().min(2000).max(2100), allocatedAmount: z.number().nonnegative() });
const usageCreateSchema = z.object({ employeeId: z.string().trim().min(1), projectId: z.string().trim().min(1).optional(), toolId: z.string().trim().min(1), modelId: z.string().trim().min(1).optional(), applicationId: z.string().trim().min(1).optional(), usageType: z.enum(['seat', 'token', 'credit', 'call', 'fixed']), quantity: z.number().nonnegative(), originalCurrency: z.enum(['CNY', 'USD']), originalAmount: z.number().nonnegative(), exchangeRate: z.number().positive().default(1), amount: z.number().nonnegative(), occurredAt: z.string().trim().min(1) });
const roleSchema = z.enum(['employee', 'manager', 'budget_admin', 'system_admin']);
const userCreateSchema = z.object({ username: z.string().trim().min(3), password: z.string().min(8), name: z.string().trim().min(1), email: z.string().email(), role: roleSchema, departmentId: z.string().trim().min(1) });
const userUpdateSchema = z.object({ name: z.string().trim().min(1).optional(), email: z.string().email().optional(), role: roleSchema.optional(), departmentId: z.string().trim().min(1).optional(), status: z.enum(['active', 'inactive']).optional() });

function paginated<T>(items: T[], page: number, pageSize: number, total: number) {
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

function registerBusinessRoutes(app: FastifyInstance) {
  app.get('/api/v1/usages', { preHandler: [app.authenticate, requirePermission('usage.view')] }, async (request, reply) => {
    const q = readQuery(request, listQuery);
    const departmentId = departmentScope(request.user.role, request.user.departmentId, q.departmentId);
    const accessScope = request.user.role === 'employee' ? eq(usageRecords.employeeId, request.user.id) : departmentId ? eq(usageRecords.departmentId, departmentId) : undefined;
    const where = and(eq(usageRecords.status, 'confirmed'), accessScope, request.user.role === 'system_admin' && q.employeeId ? eq(usageRecords.employeeId, q.employeeId) : undefined, q.projectId ? eq(usageRecords.projectId, q.projectId) : undefined, q.startDate ? gte(usageRecords.occurredAt, q.startDate) : undefined, q.endDate ? lte(usageRecords.occurredAt, q.endDate) : undefined);
    const items = await db.select({ id: usageRecords.id, employeeId: usageRecords.employeeId, employeeName: users.name, departmentId: usageRecords.departmentId, departmentName: departments.name, projectId: usageRecords.projectId, projectName: projects.name, toolId: usageRecords.toolId, toolName: aiTools.name, modelId: usageRecords.modelId, amount: usageRecords.amount, quantity: usageRecords.quantity, usageType: usageRecords.usageType, occurredAt: usageRecords.occurredAt }).from(usageRecords).leftJoin(users, eq(usageRecords.employeeId, users.id)).leftJoin(departments, eq(usageRecords.departmentId, departments.id)).leftJoin(projects, eq(usageRecords.projectId, projects.id)).leftJoin(aiTools, eq(usageRecords.toolId, aiTools.id)).where(where).orderBy(desc(usageRecords.occurredAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const total = await db.select({ count: sql<number>`count(*)` }).from(usageRecords).where(where).get();
    return ok(reply, paginated(items, q.page, q.pageSize, total?.count ?? 0));
  });

  app.post('/api/v1/usages', { preHandler: [app.authenticate, requirePermission('usage.create')] }, async (request, reply) => {
    const body = readBody(request, usageCreateSchema);
    const employee = await db.select().from(users).where(eq(users.id, body.employeeId)).get();
    if (!employee) return fail(reply, 400, '员工不存在');
    if (request.user.role !== 'system_admin' && employee.departmentId !== request.user.departmentId) return fail(reply, 403, '只能录入本部门费用');
    if (body.projectId) {
      const project = await db.select().from(projects).where(eq(projects.id, body.projectId)).get();
      if (!project || project.departmentId !== employee.departmentId) return fail(reply, 400, '项目与员工部门不一致');
    }
    const tool = await db.select().from(aiTools).where(eq(aiTools.id, body.toolId)).get();
    if (!tool || tool.status !== 'active') return fail(reply, 400, 'AI 工具不存在或已停用');
    const id = `usage_${randomUUID()}`;
    const year = new Date(body.occurredAt).getFullYear();
    const quota = await db.select().from(departmentQuotas).where(and(eq(departmentQuotas.departmentId, employee.departmentId), eq(departmentQuotas.quotaYear, year))).get();
    sqlite.transaction(() => {
      sqlite.prepare('INSERT INTO usage_records (id, employee_id, department_id, project_id, tool_id, model_id, application_id, usage_type, quantity, original_currency, original_amount, exchange_rate, amount, source, status, occurred_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'manual\', \'confirmed\', ?, ?)').run(id, body.employeeId, employee.departmentId, body.projectId ?? null, body.toolId, body.modelId ?? null, body.applicationId ?? null, body.usageType, body.quantity, body.originalCurrency, body.originalAmount, body.exchangeRate, body.amount, body.occurredAt, request.user.id);
      sqlite.prepare('UPDATE annual_budgets SET used_amount = used_amount + ?, updated_at = ? WHERE department_id = ? AND budget_year = ?').run(body.amount, new Date().toISOString(), employee.departmentId, year);
      sqlite.prepare('UPDATE department_quotas SET used_amount = used_amount + ?, updated_at = ? WHERE department_id = ? AND quota_year = ?').run(body.amount, new Date().toISOString(), employee.departmentId, year);
    })();
    if (quota?.allocatedAmount) {
      const oldRate = quota.usedAmount / quota.allocatedAmount * 100;
      const newRate = (quota.usedAmount + body.amount) / quota.allocatedAmount * 100;
      const crossed = [100, 90, 80, 70].find((threshold) => oldRate < threshold && newRate >= threshold);
      if (crossed) await db.insert(alerts).values({ id: `alert_${randomUUID()}`, type: 'quota_threshold', level: crossed >= 100 ? 'critical' : crossed >= 90 ? 'high' : crossed >= 80 ? 'medium' : 'low', employeeId: employee.id, departmentId: employee.departmentId, projectId: body.projectId, title: `部门额度使用率达到 ${crossed}%`, message: `${employee.name}的费用录入使部门额度使用率达到 ${newRate.toFixed(2)}%`, allocatedAmount: quota.allocatedAmount, usedAmount: quota.usedAmount + body.amount, usageRate: newRate, status: 'unread', occurredAt: new Date().toISOString() }).run();
    }
    await audit(request.user.id, 'create', 'usage_record', id, body);
    return created(reply, { id });
  });

  app.get('/api/v1/budgets/annual', { preHandler: [app.authenticate, requirePermission('budget.view')] }, async (request, reply) => {
    const query = z.object({ year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()), departmentId: z.string().optional() }).parse(request.query);
    const departmentId = departmentScope(request.user.role, request.user.departmentId, query.departmentId);
    const rows = await db.select({ id: annualBudgets.id, departmentId: annualBudgets.departmentId, departmentName: departments.name, year: annualBudgets.budgetYear, initialAmount: annualBudgets.initialAmount, increaseAmount: annualBudgets.increaseAmount, totalAmount: annualBudgets.totalAmount, usedAmount: annualBudgets.usedAmount, status: annualBudgets.status }).from(annualBudgets).leftJoin(departments, eq(annualBudgets.departmentId, departments.id)).where(and(eq(annualBudgets.budgetYear, query.year), departmentId ? eq(annualBudgets.departmentId, departmentId) : undefined)).orderBy(desc(annualBudgets.usedAmount));
    return ok(reply, rows.map((row) => ({ ...row, remainingAmount: row.totalAmount - row.usedAmount, executionRate: row.totalAmount ? Number((row.usedAmount / row.totalAmount * 100).toFixed(2)) : 0 })));
  });

  app.put('/api/v1/budgets/annual', { preHandler: [app.authenticate, requirePermission('budget.manage')] }, async (request, reply) => {
    const body = readBody(request, budgetSchema);
    if (request.user.role !== 'system_admin' && body.departmentId !== request.user.departmentId) return fail(reply, 403, '只能维护本部门预算');
    const existing = await db.select().from(annualBudgets).where(and(eq(annualBudgets.departmentId, body.departmentId), eq(annualBudgets.budgetYear, body.year))).get();
    const id = existing?.id ?? `budget_${randomUUID()}`;
    if (existing) await db.update(annualBudgets).set({ initialAmount: body.initialAmount, status: body.status }).where(eq(annualBudgets.id, id)).run();
    else sqlite.prepare('INSERT INTO annual_budgets (id, department_id, budget_year, initial_amount, increase_amount, used_amount, status, created_by) VALUES (?, ?, ?, ?, 0, 0, ?, ?)').run(id, body.departmentId, body.year, body.initialAmount, body.status, request.user.id);
    await audit(request.user.id, existing ? 'update' : 'create', 'annual_budget', id, body);
    return ok(reply, { id });
  });
  app.get('/api/v1/applications', { preHandler: [app.authenticate, requirePermission('application.view')] }, async (request, reply) => {
    const q = readQuery(request, pageSchema.extend({ status: z.string().optional(), type: z.string().optional() }));
    const scope = request.user.role === 'employee' ? eq(applications.applicantId, request.user.id) : request.user.role === 'system_admin' ? undefined : eq(applications.departmentId, request.user.departmentId);
    const where = and(scope, q.status ? eq(applications.status, q.status) : undefined, q.type ? eq(applications.type, q.type) : undefined);
    const fields = { id: applications.id, applicationNo: applications.applicationNo, type: applications.type, applicantId: applications.applicantId, applicantName: users.name, departmentId: applications.departmentId, departmentName: departments.name, requestedAmount: applications.requestedAmount, approvedAmount: applications.approvedAmount, reason: applications.reason, expectedUsage: applications.expectedUsage, status: applications.status, approvalStage: applications.approvalStage, submittedAt: applications.submittedAt, reviewedAt: applications.reviewedAt };
    const items = await db.select(fields).from(applications).leftJoin(users, eq(applications.applicantId, users.id)).leftJoin(departments, eq(applications.departmentId, departments.id)).where(where).orderBy(desc(applications.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const total = await db.select({ count: sql<number>`count(*)` }).from(applications).where(where).get();
    return ok(reply, paginated(items, q.page, q.pageSize, total?.count ?? 0));
  });

  app.post('/api/v1/applications', { preHandler: [app.authenticate, requirePermission('application.create')] }, async (request, reply) => {
    const body = readBody(request, applicationCreateSchema);
    if (body.type === 'budget_increase' && request.user.role !== 'manager') return fail(reply, 403, '仅部门主管可提交预算增加申请');
    let budgetId = body.budgetId;
    if (body.type === 'budget_increase' && !budgetId) {
      const budget = await db.select({ id: annualBudgets.id }).from(annualBudgets).where(and(eq(annualBudgets.departmentId, request.user.departmentId), eq(annualBudgets.budgetYear, new Date().getFullYear()))).get();
      if (!budget) return fail(reply, 400, '本部门尚未建立当年预算');
      budgetId = budget.id;
    }
    if (body.projectId) {
      const project = await db.select().from(projects).where(eq(projects.id, body.projectId)).get();
      if (!project || project.departmentId !== request.user.departmentId) return fail(reply, 400, '项目不属于当前部门');
    }
    const id = `app_${randomUUID()}`;
    const applicationNo = `APP-${Date.now()}`;
    await db.insert(applications).values({ id, applicationNo, type: body.type, applicantId: request.user.id, departmentId: request.user.departmentId, projectId: body.projectId, toolId: body.toolId, budgetId, requestedAmount: body.requestedAmount, reason: body.reason, expectedUsage: body.expectedUsage, startDate: body.startDate, endDate: body.endDate, status: 'pending', approvalStage: 'manager', submittedAt: new Date().toISOString(), createdAt: new Date().toISOString() }).run();
    await audit(request.user.id, 'submit', 'application', id, body);
    return created(reply, { id, applicationNo });
  });

  app.get('/api/v1/applications/:id', { preHandler: [app.authenticate, requirePermission('application.view')] }, async (request, reply) => {
    const id = z.string().min(1).parse((request.params as { id: string }).id);
    const item = await db.select({ id: applications.id, applicationNo: applications.applicationNo, type: applications.type, applicantId: applications.applicantId, applicantName: users.name, departmentId: applications.departmentId, departmentName: departments.name, requestedAmount: applications.requestedAmount, approvedAmount: applications.approvedAmount, reason: applications.reason, expectedUsage: applications.expectedUsage, status: applications.status, approvalStage: applications.approvalStage, submittedAt: applications.submittedAt, reviewedAt: applications.reviewedAt }).from(applications).leftJoin(users, eq(applications.applicantId, users.id)).leftJoin(departments, eq(applications.departmentId, departments.id)).where(eq(applications.id, id)).get();
    if (!item) return fail(reply, 404, '申请不存在');
    if (request.user.role === 'employee' && item.applicantId !== request.user.id) return fail(reply, 403, '无权查看该申请');
    if (request.user.role !== 'employee' && request.user.role !== 'system_admin' && item.departmentId !== request.user.departmentId) return fail(reply, 403, '无权查看其他部门申请');
    const reviews = await db.select({ id: applicationReviews.id, stage: applicationReviews.stage, action: applicationReviews.action, reviewerName: users.name, reviewerComment: applicationReviews.reviewerComment, approvedAmount: applicationReviews.approvedAmount, reviewedAt: applicationReviews.reviewedAt }).from(applicationReviews).leftJoin(users, eq(applicationReviews.reviewerId, users.id)).where(eq(applicationReviews.applicationId, id)).orderBy(applicationReviews.reviewedAt);
    return ok(reply, { ...item, reviews });
  });

  const review = async (request: Parameters<typeof readBody>[0], reply: Parameters<typeof fail>[0], action: 'approved' | 'rejected') => {
    const authRequest = request as typeof request & { user: { id: string; role: UserRole; departmentId: string }; params: { id: string } };
    const id = z.string().min(1).parse(authRequest.params.id);
    const body = readBody(request, reviewSchema);
    const item = await db.select().from(applications).where(eq(applications.id, id)).get();
    if (!item) return fail(reply, 404, '申请不存在');
    if (item.status !== 'pending') return fail(reply, 409, '当前申请已完成审批');
    const expectedRole = item.approvalStage === 'manager' ? 'manager' : 'budget_admin';
    if (authRequest.user.role !== expectedRole) return fail(reply, 403, `当前环节须由${expectedRole === 'manager' ? '部门主管' : '部门预算员'}处理`);
    const requiredPermission = expectedRole === 'manager' ? 'application.approve_manager' : 'application.approve_budget';
    if (!(await getRolePermissions(authRequest.user.role)).includes(requiredPermission)) return fail(reply, 403, '当前角色未配置审批权限');
    if (item.departmentId !== authRequest.user.departmentId) return fail(reply, 403, '只能审批本部门申请');
    const approvedAmount = action === 'approved' ? body.approvedAmount ?? item.requestedAmount : null;
    const now = new Date().toISOString();
    const nextStage = action === 'rejected' || item.approvalStage === 'budget_admin' ? 'completed' : 'budget_admin';
    const nextStatus = action === 'rejected' ? 'rejected' : nextStage === 'completed' ? 'approved' : 'pending';
    sqlite.transaction(() => {
      sqlite.prepare('INSERT INTO application_reviews (id, application_id, stage, action, reviewer_id, reviewer_comment, approved_amount, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`review_${randomUUID()}`, id, item.approvalStage, action, authRequest.user.id, body.comment, approvedAmount, now);
      sqlite.prepare('UPDATE applications SET status = ?, approval_stage = ?, approved_amount = ?, reviewer_id = ?, reviewer_comment = ?, reviewed_at = ?, updated_at = ? WHERE id = ?').run(nextStatus, nextStage, approvedAmount, authRequest.user.id, body.comment, now, now, id);
      if (nextStatus === 'approved' && item.type === 'budget_increase' && item.budgetId) sqlite.prepare('UPDATE annual_budgets SET increase_amount = increase_amount + ?, updated_at = ? WHERE id = ?').run(approvedAmount, now, item.budgetId);
      if (nextStatus === 'approved' && (item.type === 'quota' || item.type === 'extra_usage')) sqlite.prepare('INSERT INTO department_quotas (id, department_id, quota_year, allocated_amount, used_amount, status, created_by) VALUES (?, ?, ?, ?, 0, \'active\', ?) ON CONFLICT(department_id, quota_year) DO UPDATE SET allocated_amount = allocated_amount + excluded.allocated_amount, updated_at = ?').run(`quota_${randomUUID()}`, item.departmentId, new Date().getFullYear(), approvedAmount, authRequest.user.id, now);
    })();
    await audit(authRequest.user.id, action, 'application', id, { stage: item.approvalStage, approvedAmount });
    return ok(reply, { id, status: nextStatus, approvalStage: nextStage, message: nextStatus === 'pending' ? '主管审批已通过，等待部门预算员审批' : action === 'approved' ? '申请已最终通过并生效' : '申请已驳回' });
  };

  app.post('/api/v1/applications/:id/approve', { preHandler: [app.authenticate] }, async (request, reply) => review(request, reply, 'approved'));
  app.post('/api/v1/applications/:id/reject', { preHandler: [app.authenticate] }, async (request, reply) => review(request, reply, 'rejected'));
  app.get('/api/v1/quotas/overview', { preHandler: [app.authenticate, requirePermission('quota.view')] }, async (request, reply) => {
    const query = z.object({ year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()), departmentId: z.string().optional() }).parse(request.query);
    const departmentId = departmentScope(request.user.role, request.user.departmentId, query.departmentId);
    const rows = await db.select({ id: departmentQuotas.id, departmentId: departmentQuotas.departmentId, departmentName: departments.name, year: departmentQuotas.quotaYear, allocatedAmount: departmentQuotas.allocatedAmount, usedAmount: departmentQuotas.usedAmount }).from(departmentQuotas).leftJoin(departments, eq(departmentQuotas.departmentId, departments.id)).where(and(eq(departmentQuotas.quotaYear, query.year), departmentId ? eq(departmentQuotas.departmentId, departmentId) : undefined));
    return ok(reply, rows.map((row) => ({ ...row, remainingAmount: row.allocatedAmount - row.usedAmount, usageRate: row.allocatedAmount ? Number((row.usedAmount / row.allocatedAmount * 100).toFixed(2)) : 0 })));
  });

  app.put('/api/v1/quotas', { preHandler: [app.authenticate, requirePermission('quota.manage')] }, async (request, reply) => {
    const body = readBody(request, quotaSchema);
    if (request.user.role !== 'system_admin' && body.departmentId !== request.user.departmentId) return fail(reply, 403, '只能维护本部门额度');
    const existing = await db.select().from(departmentQuotas).where(and(eq(departmentQuotas.departmentId, body.departmentId), eq(departmentQuotas.quotaYear, body.year))).get();
    const id = existing?.id ?? `quota_${randomUUID()}`;
    if (existing) await db.update(departmentQuotas).set({ allocatedAmount: body.allocatedAmount }).where(eq(departmentQuotas.id, id)).run();
    else await db.insert(departmentQuotas).values({ id, departmentId: body.departmentId, quotaYear: body.year, allocatedAmount: body.allocatedAmount, usedAmount: 0, status: 'active', createdBy: request.user.id }).run();
    await audit(request.user.id, existing ? 'update' : 'create', 'department_quota', id, body);
    return ok(reply, { id });
  });

  app.get('/api/v1/alerts', { preHandler: [app.authenticate, requirePermission('alerts.view')] }, async (request, reply) => {
    const q = readQuery(request, pageSchema.extend({ status: z.string().optional(), level: z.string().optional() }));
    const scope = request.user.role === 'employee' ? eq(alerts.employeeId, request.user.id) : request.user.role === 'system_admin' ? undefined : eq(alerts.departmentId, request.user.departmentId);
    const where = and(scope, q.status ? eq(alerts.status, q.status) : undefined, q.level ? eq(alerts.level, q.level) : undefined);
    const items = await db.select().from(alerts).where(where).orderBy(desc(alerts.occurredAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const total = await db.select({ count: sql<number>`count(*)` }).from(alerts).where(where).get();
    return ok(reply, paginated(items, q.page, q.pageSize, total?.count ?? 0));
  });

  app.patch('/api/v1/alerts/:id/read', { preHandler: [app.authenticate, requirePermission('alerts.view')] }, async (request, reply) => {
    const id = z.string().min(1).parse((request.params as { id: string }).id);
    const item = await db.select().from(alerts).where(eq(alerts.id, id)).get();
    if (!item) return fail(reply, 404, '预警不存在');
    if (request.user.role === 'employee' && item.employeeId !== request.user.id) return fail(reply, 403, '无权操作该预警');
    if (request.user.role !== 'employee' && request.user.role !== 'system_admin' && item.departmentId !== request.user.departmentId) return fail(reply, 403, '无权操作其他部门预警');
    await db.update(alerts).set({ status: 'read', readBy: request.user.id, readAt: new Date().toISOString() }).where(eq(alerts.id, id)).run();
    return ok(reply, { id, status: 'read' });
  });

  app.get('/api/v1/projects', { preHandler: [app.authenticate] }, async (request, reply) => {
    const query = z.object({ departmentId: z.string().optional() }).parse(request.query);
    const departmentId = departmentScope(request.user.role, request.user.departmentId, query.departmentId);
    const rows = await db.select({ id: projects.id, code: projects.code, name: projects.name, departmentId: projects.departmentId, departmentName: departments.name, managerId: projects.managerId, status: projects.status }).from(projects).leftJoin(departments, eq(projects.departmentId, departments.id)).where(departmentId ? eq(projects.departmentId, departmentId) : undefined).orderBy(projects.name);
    return ok(reply, rows);
  });

  app.get('/api/v1/catalog/tools', { preHandler: [app.authenticate, requirePermission('catalog.view')] }, async (_request, reply) => {
    const rows = await db.select({ id: aiTools.id, code: aiTools.code, name: aiTools.name, vendor: aiTools.vendor, billingType: aiTools.billingType, currency: aiTools.defaultCurrency, status: aiTools.status, modelCount: sql<number>`count(${aiModels.id})` }).from(aiTools).leftJoin(aiModels, eq(aiModels.toolId, aiTools.id)).groupBy(aiTools.id).orderBy(aiTools.name);
    return ok(reply, rows);
  });

  app.patch('/api/v1/catalog/tools/:id/status', { preHandler: [app.authenticate, requirePermission('catalog.manage')] }, async (request, reply) => {
    const id = z.string().min(1).parse((request.params as { id: string }).id);
    const body = readBody(request, z.object({ status: z.enum(['active', 'inactive']) }));
    await db.update(aiTools).set({ status: body.status }).where(eq(aiTools.id, id)).run();
    await audit(request.user.id, 'update_status', 'ai_tool', id, body);
    return ok(reply, { id, status: body.status });
  });
  app.get('/api/v1/departments', { preHandler: [app.authenticate] }, async (request, reply) => {
    const rows = await db.select().from(departments).where(request.user.role === 'system_admin' ? undefined : eq(departments.id, request.user.departmentId)).orderBy(departments.name);
    return ok(reply, rows);
  });

  app.get('/api/v1/users/options', { preHandler: [app.authenticate, requirePermission('usage.create')] }, async (request, reply) => {
    const rows = await db.select({ id: users.id, name: users.name, departmentId: users.departmentId, departmentName: departments.name }).from(users).leftJoin(departments, eq(users.departmentId, departments.id)).where(and(eq(users.status, 'active'), request.user.role === 'system_admin' ? undefined : eq(users.departmentId, request.user.departmentId))).orderBy(users.name);
    return ok(reply, rows);
  });

  app.get('/api/v1/admin/users', { preHandler: [app.authenticate, requirePermission('user.manage')] }, async (_request, reply) => {
    const rows = await db.select({ id: users.id, username: users.username, name: users.name, email: users.email, role: users.role, departmentId: users.departmentId, departmentName: departments.name, status: users.status }).from(users).leftJoin(departments, eq(users.departmentId, departments.id)).orderBy(users.name);
    return ok(reply, rows);
  });

  app.post('/api/v1/admin/users', { preHandler: [app.authenticate, requirePermission('user.manage')] }, async (request, reply) => {
    const body = readBody(request, userCreateSchema);
    const duplicate = await db.select({ id: users.id }).from(users).where(eq(users.username, body.username)).get();
    if (duplicate) return fail(reply, 409, '用户名已存在');
    const department = await db.select({ id: departments.id }).from(departments).where(eq(departments.id, body.departmentId)).get();
    if (!department) return fail(reply, 400, '部门不存在');
    const id = `user_${randomUUID()}`;
    await db.insert(users).values({ id, username: body.username, passwordHash: await bcrypt.hash(body.password, 12), name: body.name, email: body.email, role: body.role, departmentId: body.departmentId, status: 'active' }).run();
    await audit(request.user.id, 'create', 'user', id, { ...body, password: undefined });
    return created(reply, { id });
  });

  app.patch('/api/v1/admin/users/:id', { preHandler: [app.authenticate, requirePermission('user.manage')] }, async (request, reply) => {
    const id = z.string().min(1).parse((request.params as { id: string }).id);
    const body = readBody(request, userUpdateSchema);
    if (id === request.user.id && (body.status === 'inactive' || (body.role && body.role !== 'system_admin'))) return fail(reply, 400, '不能停用当前账号或移除自己的系统管理员角色');
    const existing = await db.select().from(users).where(eq(users.id, id)).get();
    if (!existing) return fail(reply, 404, '用户不存在');
    await db.update(users).set(body).where(eq(users.id, id)).run();
    await audit(request.user.id, 'update', 'user', id, body);
    return ok(reply, { id });
  });

  app.get('/api/v1/admin/roles', { preHandler: [app.authenticate, requirePermission('role.manage')] }, async (_request, reply) => {
    const roleRows = await db.select().from(roles).orderBy(roles.name);
    const permissionRows = await db.select().from(permissions).orderBy(permissions.module, permissions.name);
    const mappings = await db.select().from(rolePermissions);
    return ok(reply, {
      roles: roleRows.map((role) => ({ ...role, permissions: mappings.filter((item) => item.roleId === role.id).map((item) => item.permissionId) })),
      permissions: permissionRows,
    });
  });

  app.put('/api/v1/admin/roles/:id/permissions', { preHandler: [app.authenticate, requirePermission('role.manage')] }, async (request, reply) => {
    const roleId = roleSchema.parse((request.params as { id: string }).id);
    const body = readBody(request, z.object({ permissions: z.array(z.string()).max(100) }));
    if (roleId === 'system_admin') return fail(reply, 400, '系统管理员必须保留全部系统权限');
    const validPermissions = await db.select({ id: permissions.id }).from(permissions);
    const validSet = new Set(validPermissions.map((item) => item.id));
    if (body.permissions.some((permission) => !validSet.has(permission))) return fail(reply, 400, '包含无效权限');
    sqlite.transaction(() => {
      sqlite.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
      const insert = sqlite.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
      body.permissions.forEach((permission) => insert.run(roleId, permission));
    })();
    await audit(request.user.id, 'configure_permissions', 'role', roleId, body);
    return ok(reply, { roleId, permissions: body.permissions });
  });
}

function departmentScope(role: UserRole, ownDepartmentId: string, requestedDepartmentId?: string) {
  return role === 'system_admin' ? requestedDepartmentId : ownDepartmentId;
}

async function audit(actorId: string, action: string, entityType: string, entityId: string, afterData?: unknown) {
  await db.insert(auditLogs).values({ id: `audit_${randomUUID()}`, actorId, action, entityType, entityId, afterData: afterData ? JSON.stringify(afterData) : null }).run();
}

export async function registerRoutes(app: FastifyInstance) {
  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = readBody(request, loginSchema);
    const user = await db.select().from(users).where(eq(users.username, body.username)).get();
    if (!user || user.status !== 'active' || !(await bcrypt.compare(body.password, user.passwordHash))) return fail(reply, 401, '用户名或密码错误');
    const userPermissions = await getRolePermissions(user.role);
    const token = await app.jwt.sign({ id: user.id, username: user.username, name: user.name, role: user.role, departmentId: user.departmentId });
    return ok(reply, { token, user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role, departmentId: user.departmentId, permissions: userPermissions } });
  });

  app.get('/api/v1/auth/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await db.select({ id: users.id, username: users.username, name: users.name, email: users.email, role: users.role, departmentId: users.departmentId, departmentName: departments.name }).from(users).leftJoin(departments, eq(users.departmentId, departments.id)).where(eq(users.id, request.user.id)).get();
    if (!user) return fail(reply, 401, '用户不存在');
    return ok(reply, { ...user, departmentName: user.role === 'system_admin' ? '全公司' : user.departmentName, permissions: await getRolePermissions(user.role) });
  });

  app.get('/api/v1/dashboard/overview', { preHandler: [app.authenticate, requirePermission('dashboard.view')] }, async (request, reply) => {
    const year = z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()).parse((request.query as { year?: string }).year);
    const departmentId = departmentScope(request.user.role, request.user.departmentId);
    const budgetWhere = request.user.role === 'employee' ? eq(annualBudgets.id, '__none__') : and(eq(annualBudgets.budgetYear, year), departmentId ? eq(annualBudgets.departmentId, departmentId) : undefined);
    const quotaWhere = and(eq(departmentQuotas.quotaYear, year), departmentId ? eq(departmentQuotas.departmentId, departmentId) : undefined);
    const budget = await db.select({ total: sql<number>`coalesce(sum(${annualBudgets.totalAmount}), 0)`, used: sql<number>`coalesce(sum(${annualBudgets.usedAmount}), 0)` }).from(annualBudgets).where(budgetWhere).get();
    const quota = await db.select({ allocated: sql<number>`coalesce(sum(${departmentQuotas.allocatedAmount}), 0)`, used: sql<number>`coalesce(sum(${departmentQuotas.usedAmount}), 0)` }).from(departmentQuotas).where(quotaWhere).get();
    const alertScope = request.user.role === 'employee' ? eq(alerts.employeeId, request.user.id) : departmentId ? eq(alerts.departmentId, departmentId) : undefined;
    const alertResult = await db.select({ count: sql<number>`count(*)` }).from(alerts).where(and(eq(alerts.status, 'unread'), alertScope)).get();
    const total = budget?.total ?? 0;
    const budgetUsed = budget?.used ?? 0;
    const allocated = quota?.allocated ?? 0;
    const quotaUsed = quota?.used ?? 0;
    return ok(reply, { year, budget: { totalAmount: total, usedAmount: budgetUsed, remainingAmount: total - budgetUsed, executionRate: total ? Number((budgetUsed / total * 100).toFixed(2)) : 0 }, quota: { allocatedAmount: allocated, usedAmount: quotaUsed, remainingAmount: allocated - quotaUsed, usageRate: allocated ? Number((quotaUsed / allocated * 100).toFixed(2)) : 0 }, unreadAlertCount: alertResult?.count ?? 0 });
  });
  registerBusinessRoutes(app);
}
