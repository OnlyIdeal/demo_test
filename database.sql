PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('employee', 'manager', 'budget_admin')),
    department_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    department_id TEXT NOT NULL,
    manager_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    start_date TEXT,
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employee_projects (
    employee_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    project_role TEXT,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_id, project_id),
    FOREIGN KEY (employee_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_tools (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    vendor TEXT NOT NULL,
    billing_type TEXT NOT NULL CHECK (billing_type IN ('seat', 'token', 'credit', 'call', 'fixed', 'mixed')),
    default_currency TEXT NOT NULL DEFAULT 'CNY' CHECK (default_currency IN ('CNY', 'USD')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_models (
    id TEXT PRIMARY KEY,
    tool_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'call' CHECK (unit IN ('token', 'credit', 'call', 'seat', 'fixed')),
    input_price REAL NOT NULL DEFAULT 0 CHECK (input_price >= 0),
    output_price REAL NOT NULL DEFAULT 0 CHECK (output_price >= 0),
    currency TEXT NOT NULL DEFAULT 'CNY' CHECK (currency IN ('CNY', 'USD')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tool_id, code),
    FOREIGN KEY (tool_id) REFERENCES ai_tools(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS annual_budgets (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    budget_year INTEGER NOT NULL CHECK (budget_year BETWEEN 2000 AND 2100),
    initial_amount REAL NOT NULL DEFAULT 0 CHECK (initial_amount >= 0),
    increase_amount REAL NOT NULL DEFAULT 0 CHECK (increase_amount >= 0),
    total_amount REAL GENERATED ALWAYS AS (initial_amount + increase_amount) STORED,
    used_amount REAL NOT NULL DEFAULT 0 CHECK (used_amount >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (department_id, budget_year),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS department_quotas (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    quota_year INTEGER NOT NULL CHECK (quota_year BETWEEN 2000 AND 2100),
    allocated_amount REAL NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
    used_amount REAL NOT NULL DEFAULT 0 CHECK (used_amount >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (department_id, quota_year),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    application_no TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('quota', 'budget_increase', 'tool_access', 'extra_usage')),
    applicant_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    project_id TEXT,
    tool_id TEXT,
    budget_id TEXT,
    requested_amount REAL NOT NULL CHECK (requested_amount > 0),
    approved_amount REAL CHECK (approved_amount IS NULL OR approved_amount >= 0),
    reason TEXT NOT NULL,
    expected_usage TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
    reviewer_id TEXT,
    reviewer_comment TEXT,
    submitted_at TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (applicant_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (tool_id) REFERENCES ai_tools(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (budget_id) REFERENCES annual_budgets(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS usage_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    project_id TEXT,
    tool_id TEXT NOT NULL,
    model_id TEXT,
    application_id TEXT,
    usage_type TEXT NOT NULL CHECK (usage_type IN ('seat', 'token', 'credit', 'call', 'fixed')),
    quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    original_currency TEXT NOT NULL DEFAULT 'CNY' CHECK (original_currency IN ('CNY', 'USD')),
    original_amount REAL NOT NULL CHECK (original_amount >= 0),
    exchange_rate REAL NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
    amount REAL NOT NULL CHECK (amount >= 0),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'supplier')),
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'disputed', 'void')),
    occurred_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (tool_id) REFERENCES ai_tools(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (model_id) REFERENCES ai_models(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS alert_settings (
    id TEXT PRIMARY KEY,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'department', 'user')),
    scope_id TEXT,
    threshold_70 INTEGER NOT NULL DEFAULT 70 CHECK (threshold_70 BETWEEN 0 AND 100),
    threshold_80 INTEGER NOT NULL DEFAULT 80 CHECK (threshold_80 BETWEEN 0 AND 100),
    threshold_90 INTEGER NOT NULL DEFAULT 90 CHECK (threshold_90 BETWEEN 0 AND 100),
    threshold_100 INTEGER NOT NULL DEFAULT 100 CHECK (threshold_100 BETWEEN 0 AND 100),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (scope_type, scope_id),
    FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('usage_rate_70', 'usage_rate_80', 'usage_rate_90', 'usage_rate_100', 'budget_execution', 'data_anomaly')),
    level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'high', 'critical')),
    employee_id TEXT,
    department_id TEXT,
    project_id TEXT,
    application_id TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    allocated_amount REAL,
    used_amount REAL,
    usage_rate REAL CHECK (usage_rate IS NULL OR (usage_rate >= 0 AND usage_rate <= 100)),
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved')),
    occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_by TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (read_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before_data TEXT,
    after_data TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_projects_department_status ON projects(department_id, status);
CREATE INDEX IF NOT EXISTS idx_employee_projects_project ON employee_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_models_tool_status ON ai_models(tool_id, status);
CREATE INDEX IF NOT EXISTS idx_budgets_year_department ON annual_budgets(budget_year, department_id);
CREATE INDEX IF NOT EXISTS idx_quotas_year_department ON department_quotas(quota_year, department_id);
CREATE INDEX IF NOT EXISTS idx_applications_status_department ON applications(status, department_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_employee_time ON usage_records(employee_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_department_time ON usage_records(department_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_project_time ON usage_records(project_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_tool_model ON usage_records(tool_id, model_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status_time ON alerts(status, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_department ON alerts(department_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- Mock Data: departments (5)
INSERT OR IGNORE INTO departments (id, code, name) VALUES
('dept_001', 'RND', '产品研发部'),
('dept_002', 'DATA', '数据平台部'),
('dept_003', 'MKT', '市场品牌部'),
('dept_004', 'CS', '客户成功部'),
('dept_005', 'OPS', '综合管理部');

-- Mock Data: users (6)
INSERT OR IGNORE INTO users (id, username, password_hash, name, email, role, department_id) VALUES
('user_001', 'employee.demo', '$2b$12$Jcop/Ba5ovlfwdnznE/dxuPNFHcxa7JkHtDTdCGWBQ64nuDRpuP8G', '张小明', 'zhangxiaoming@example.com', 'employee', 'dept_001'),
('user_002', 'manager.demo', '$2b$12$5JwZt0ylZuT7HlUZ/sffFupUXW8YVbG.aBxJtuDMNQDe5TAB7WXhe', '李敏', 'limin@example.com', 'manager', 'dept_001'),
('user_003', 'budget.admin', '$2b$12$o3mCqojbl0vUekALANKGm.Fsn2fVYXoEhmgQrDd96Em9jWBHzdy1O', '王芳', 'wangfang@example.com', 'budget_admin', 'dept_005'),
('user_004', 'employee.liu', 'demo_hash', '刘洋', 'liuyang@example.com', 'employee', 'dept_002'),
('user_005', 'manager.chen', 'demo_hash', '陈晨', 'chenchen@example.com', 'manager', 'dept_002'),
('user_006', 'employee.zhao', 'demo_hash', '赵倩', 'zhaoqian@example.com', 'employee', 'dept_003');

-- Mock Data: tools (8)
INSERT OR IGNORE INTO ai_tools (id, code, name, vendor, billing_type, default_currency) VALUES
('tool_001', 'feishu_ai', '飞书 AI', '字节跳动', 'mixed', 'CNY'),
('tool_002', 'workbuddy', 'WorkBuddy/CodeBuddy', '腾讯', 'credit', 'CNY'),
('tool_003', 'codex', 'Codex', 'OpenAI', 'token', 'USD'),
('tool_004', 'copilot', 'GitHub Copilot', 'GitHub', 'seat', 'USD'),
('tool_005', 'trae', 'Trae', '字节跳动', 'mixed', 'CNY'),
('tool_006', 'claude_code', 'Claude Code', 'Anthropic', 'token', 'USD'),
('tool_007', 'uniapi', 'UniAPI', '内部平台', 'token', 'CNY'),
('tool_008', 'fastgpt', 'FastGPT', 'FastGPT', 'call', 'CNY');

-- Mock Data: models (8)
INSERT OR IGNORE INTO ai_models (id, tool_id, code, name, unit, input_price, output_price, currency) VALUES
('model_001', 'tool_003', 'gpt-5', 'GPT-5', 'token', 0.01, 0.03, 'USD'),
('model_002', 'tool_003', 'gpt-5-mini', 'GPT-5 Mini', 'token', 0.002, 0.006, 'USD'),
('model_003', 'tool_006', 'claude-opus', 'Claude Opus', 'token', 0.015, 0.075, 'USD'),
('model_004', 'tool_006', 'claude-sonnet', 'Claude Sonnet', 'token', 0.003, 0.015, 'USD'),
('model_005', 'tool_007', 'qwen-max', '通义千问 Max', 'token', 0.02, 0.06, 'CNY'),
('model_006', 'tool_007', 'deepseek-v3', 'DeepSeek V3', 'token', 0.001, 0.002, 'CNY'),
('model_007', 'tool_008', 'gpt-4o-mini', 'GPT-4o Mini', 'call', 0.02, 0, 'CNY'),
('model_008', 'tool_001', 'feishu-assistant', '飞书智能助手', 'call', 0.1, 0, 'CNY');

-- Mock Data: projects (4)
INSERT OR IGNORE INTO projects (id, code, name, department_id, manager_id, start_date) VALUES
('project_001', 'CRM-2026', 'CRM 重构项目', 'dept_001', 'user_002', '2026-01-10'),
('project_002', 'DATA-2026', '数据平台项目', 'dept_002', 'user_005', '2026-02-01'),
('project_003', 'MKT-2026', '品牌内容中台', 'dept_003', 'user_006', '2026-01-20'),
('project_004', 'CS-2026', '客服知识库', 'dept_004', NULL, '2026-03-01');

-- Mock Data: employee-project relations (4)
INSERT OR IGNORE INTO employee_projects (employee_id, project_id, project_role) VALUES
('user_001', 'project_001', '开发成员'),
('user_004', 'project_002', '数据分析成员'),
('user_006', 'project_003', '内容负责人'),
('user_001', 'project_002', '协作成员');

-- Mock Data: annual budgets (5)
INSERT OR IGNORE INTO annual_budgets (id, department_id, budget_year, initial_amount, increase_amount, used_amount, created_by) VALUES
('budget_001', 'dept_001', 2026, 800000, 100000, 486200, 'user_003'),
('budget_002', 'dept_002', 2026, 600000, 0, 302680, 'user_003'),
('budget_003', 'dept_003', 2026, 450000, 0, 216450, 'user_003'),
('budget_004', 'dept_004', 2026, 380000, 0, 168920, 'user_003'),
('budget_005', 'dept_005', 2026, 250000, 0, 112180, 'user_003');

-- Mock Data: department quotas (5)
INSERT OR IGNORE INTO department_quotas (id, department_id, quota_year, allocated_amount, used_amount, created_by) VALUES
('quota_001', 'dept_001', 2026, 180000, 137400, 'user_003'),
('quota_002', 'dept_002', 2026, 140000, 95600, 'user_003'),
('quota_003', 'dept_003', 2026, 90000, 65200, 'user_003'),
('quota_004', 'dept_004', 2026, 70000, 42100, 'user_003'),
('quota_005', 'dept_005', 2026, 50000, 18400, 'user_003');

-- Mock Data: applications (4)
INSERT OR IGNORE INTO applications (id, application_no, type, applicant_id, department_id, project_id, tool_id, budget_id, requested_amount, approved_amount, reason, status, reviewer_id, submitted_at, reviewed_at) VALUES
('app_001', 'APP-202608-0001', 'quota', 'user_001', 'dept_001', 'project_001', 'tool_003', 'budget_001', 18000, 18000, 'CRM 重构项目需要使用 Codex 完成代码迁移和测试。', 'approved', 'user_002', '2026-08-01T09:30:00+08:00', '2026-08-01T14:20:00+08:00'),
('app_002', 'APP-202608-0002', 'extra_usage', 'user_004', 'dept_002', 'project_002', 'tool_006', 'budget_002', 8000, NULL, '数据平台项目需要增加 Claude Code 使用额度。', 'pending', NULL, '2026-08-10T10:15:00+08:00', NULL),
('app_003', 'APP-202608-0003', 'budget_increase', 'user_005', 'dept_002', 'project_002', NULL, 'budget_002', 120000, NULL, '数据平台项目进入集中开发期，申请年度部门预算追加。', 'pending', NULL, '2026-08-11T16:40:00+08:00', NULL),
('app_004', 'APP-202608-0004', 'quota', 'user_006', 'dept_003', 'project_003', 'tool_007', 'budget_003', 10000, 10000, '品牌内容中台需要使用 UniAPI 生成内容素材。', 'approved', 'user_003', '2026-08-02T11:00:00+08:00', '2026-08-02T15:00:00+08:00');

-- Mock Data: usage records (6)
INSERT OR IGNORE INTO usage_records (id, employee_id, department_id, project_id, tool_id, model_id, application_id, usage_type, quantity, original_currency, original_amount, exchange_rate, amount, source, occurred_at, created_by) VALUES
('usage_001', 'user_001', 'dept_001', 'project_001', 'tool_003', 'model_001', 'app_001', 'token', 12000000, 'USD', 900, 7.2, 6480, 'manual', '2026-08-05T10:00:00+08:00', 'user_003'),
('usage_002', 'user_001', 'dept_001', 'project_001', 'tool_003', 'model_002', 'app_001', 'token', 18000000, 'USD', 720, 7.2, 5184, 'csv', '2026-08-08T11:20:00+08:00', 'user_003'),
('usage_003', 'user_004', 'dept_002', 'project_002', 'tool_006', 'model_004', 'app_002', 'token', 8000000, 'USD', 820, 7.2, 5904, 'manual', '2026-08-09T13:00:00+08:00', 'user_003'),
('usage_004', 'user_006', 'dept_003', 'project_003', 'tool_007', 'model_005', 'app_004', 'token', 3200000, 'CNY', 8350, 1, 8350, 'manual', '2026-08-10T15:40:00+08:00', 'user_003'),
('usage_005', 'user_001', 'dept_001', 'project_002', 'tool_001', 'model_008', NULL, 'call', 420, 'CNY', 420, 1, 420, 'manual', '2026-08-11T09:10:00+08:00', 'user_003'),
('usage_006', 'user_004', 'dept_002', 'project_002', 'tool_008', 'model_007', NULL, 'call', 920, 'CNY', 920, 1, 920, 'manual', '2026-08-12T17:20:00+08:00', 'user_003');

-- Mock Data: alert settings (1)
INSERT OR IGNORE INTO alert_settings (id, scope_type, scope_id, updated_by) VALUES
('setting_001', 'global', NULL, 'user_003');

-- Mock Data: alerts (4)
INSERT OR IGNORE INTO alerts (id, type, level, employee_id, department_id, project_id, application_id, title, message, allocated_amount, used_amount, usage_rate, status, occurred_at) VALUES
('alert_001', 'usage_rate_90', 'high', 'user_001', 'dept_001', 'project_001', 'app_001', 'Codex 费用即将使用完', 'CRM 重构项目的 Codex 申请额度使用率已超过 90%。', 18000, 16740, 93, 'unread', '2026-08-12T09:00:00+08:00'),
('alert_002', 'usage_rate_80', 'warning', 'user_004', 'dept_002', 'project_002', 'app_002', 'Claude Code 使用率较高', '数据平台项目的 Claude Code 费用使用率已超过 80%。', 8000, 6520, 81.5, 'unread', '2026-08-12T10:00:00+08:00'),
('alert_003', 'usage_rate_80', 'warning', 'user_006', 'dept_003', 'project_003', 'app_004', 'UniAPI 费用使用率较高', '品牌内容中台的 UniAPI 费用使用率已达到 80%。', 10000, 8000, 80, 'read', '2026-08-11T14:00:00+08:00'),
('alert_004', 'budget_execution', 'warning', NULL, 'dept_001', NULL, NULL, '产品研发部预算执行率提醒', '产品研发部年度预算执行率已超过 50%，建议关注后续使用趋势。', 900000, 486200, 54.02, 'unread', '2026-08-13T08:00:00+08:00');

-- Mock Data: audit logs (2)
INSERT OR IGNORE INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_data) VALUES
('audit_001', 'user_003', 'approve', 'application', 'app_001', '{"status":"approved","approvedAmount":18000}'),
('audit_002', 'user_003', 'create', 'usage_record', 'usage_001', '{"amount":6480,"source":"manual"}');

COMMIT;

