import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const departments = sqliteTable('departments', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').$type<'employee' | 'manager' | 'budget_admin'>().notNull(),
  departmentId: text('department_id').notNull(),
  status: text('status').notNull(),
}, (table) => ({
  departmentIdx: index('idx_users_department').on(table.departmentId),
  usernameIdx: uniqueIndex('idx_users_username').on(table.username),
}));

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  departmentId: text('department_id').notNull(),
  managerId: text('manager_id'),
  status: text('status').notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
});

export const aiTools = sqliteTable('ai_tools', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  vendor: text('vendor').notNull(),
  billingType: text('billing_type').notNull(),
  defaultCurrency: text('default_currency').notNull(),
  status: text('status').notNull(),
});

export const aiModels = sqliteTable('ai_models', {
  id: text('id').primaryKey(),
  toolId: text('tool_id').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  inputPrice: real('input_price').notNull(),
  outputPrice: real('output_price').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull(),
});

export const annualBudgets = sqliteTable('annual_budgets', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull(),
  budgetYear: integer('budget_year').notNull(),
  initialAmount: real('initial_amount').notNull(),
  increaseAmount: real('increase_amount').notNull(),
  totalAmount: real('total_amount').notNull(),
  usedAmount: real('used_amount').notNull(),
  status: text('status').notNull(),
  createdBy: text('created_by').notNull(),
});

export const departmentQuotas = sqliteTable('department_quotas', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull(),
  quotaYear: integer('quota_year').notNull(),
  allocatedAmount: real('allocated_amount').notNull(),
  usedAmount: real('used_amount').notNull(),
  status: text('status').notNull(),
  createdBy: text('created_by').notNull(),
});

export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(),
  applicationNo: text('application_no').notNull(),
  type: text('type').notNull(),
  applicantId: text('applicant_id').notNull(),
  departmentId: text('department_id').notNull(),
  projectId: text('project_id'),
  toolId: text('tool_id'),
  budgetId: text('budget_id'),
  requestedAmount: real('requested_amount').notNull(),
  approvedAmount: real('approved_amount'),
  reason: text('reason').notNull(),
  expectedUsage: text('expected_usage'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  status: text('status').notNull(),
  approvalStage: text('approval_stage').$type<'manager' | 'budget_admin' | 'completed'>().notNull().default('manager'),
  reviewerId: text('reviewer_id'),
  reviewerComment: text('reviewer_comment'),
  submittedAt: text('submitted_at'),
  reviewedAt: text('reviewed_at'),
  createdAt: text('created_at'),
});

export const usageRecords = sqliteTable('usage_records', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  departmentId: text('department_id').notNull(),
  projectId: text('project_id'),
  toolId: text('tool_id').notNull(),
  modelId: text('model_id'),
  applicationId: text('application_id'),
  usageType: text('usage_type').notNull(),
  quantity: real('quantity').notNull(),
  originalCurrency: text('original_currency').notNull(),
  originalAmount: real('original_amount').notNull(),
  exchangeRate: real('exchange_rate').notNull(),
  amount: real('amount').notNull(),
  source: text('source').notNull(),
  status: text('status').notNull(),
  occurredAt: text('occurred_at').notNull(),
  createdBy: text('created_by').notNull(),
});

export const alerts = sqliteTable('alerts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  level: text('level').notNull(),
  employeeId: text('employee_id'),
  departmentId: text('department_id'),
  projectId: text('project_id'),
  applicationId: text('application_id'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  allocatedAmount: real('allocated_amount'),
  usedAmount: real('used_amount'),
  usageRate: real('usage_rate'),
  status: text('status').notNull(),
  occurredAt: text('occurred_at').notNull(),
  readBy: text('read_by'),
  readAt: text('read_at'),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  beforeData: text('before_data'),
  afterData: text('after_data'),
});



