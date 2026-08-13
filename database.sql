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
    approval_stage TEXT NOT NULL DEFAULT 'manager' CHECK (approval_stage IN ('manager', 'budget_admin', 'completed')),
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
CREATE INDEX IF NOT EXISTS idx_applications_approval_stage ON applications(status, approval_stage, department_id);
CREATE INDEX IF NOT EXISTS idx_usage_employee_time ON usage_records(employee_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_department_time ON usage_records(department_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_project_time ON usage_records(project_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_tool_model ON usage_records(tool_id, model_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status_time ON alerts(status, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_department ON alerts(department_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- Mock Data: departments (5)
INSERT OR IGNORE INTO departments (id, code, name) VALUES
('dept_001', 'RND', '娴溠冩惂閻柨褰傞柈?),
('dept_002', 'DATA', '閺佺増宓侀獮鍐插酱闁?),
('dept_003', 'MKT', '鐢倸婧€閸濅胶澧濋柈?),
('dept_004', 'CS', '鐎广垺鍩涢幋鎰闁?),
('dept_005', 'OPS', '缂佺厧鎮庣粻锛勬倞闁?);

-- Mock Data: users (6)
INSERT OR IGNORE INTO users (id, username, password_hash, name, email, role, department_id) VALUES
('user_001', 'employee.demo', '$2b$12$Jcop/Ba5ovlfwdnznE/dxuPNFHcxa7JkHtDTdCGWBQ64nuDRpuP8G', '瀵姴鐨弰?, 'zhangxiaoming@example.com', 'employee', 'dept_001'),
('user_002', 'manager.demo', '$2b$12$5JwZt0ylZuT7HlUZ/sffFupUXW8YVbG.aBxJtuDMNQDe5TAB7WXhe', '閺夊孩鏅?, 'limin@example.com', 'manager', 'dept_001'),
('user_003', 'budget.admin', '$2b$12$o3mCqojbl0vUekALANKGm.Fsn2fVYXoEhmgQrDd96Em9jWBHzdy1O', '閻滃濮?, 'wangfang@example.com', 'budget_admin', 'dept_005'),
('user_004', 'employee.liu', 'demo_hash', '閸掓ɑ纾?, 'liuyang@example.com', 'employee', 'dept_002'),
('user_005', 'manager.chen', 'demo_hash', '闂勫牊娅?, 'chenchen@example.com', 'manager', 'dept_002'),
('user_006', 'employee.zhao', 'demo_hash', '鐠ч潧鈧?, 'zhaoqian@example.com', 'employee', 'dept_003');

-- Mock Data: tools (8)
INSERT OR IGNORE INTO ai_tools (id, code, name, vendor, billing_type, default_currency) VALUES
('tool_001', 'feishu_ai', '妞嬬偘鍔?AI', '鐎涙濡捄鍐插З', 'mixed', 'CNY'),
('tool_002', 'workbuddy', 'WorkBuddy/CodeBuddy', '閼垫崘顔?, 'credit', 'CNY'),
('tool_003', 'codex', 'Codex', 'OpenAI', 'token', 'USD'),
('tool_004', 'copilot', 'GitHub Copilot', 'GitHub', 'seat', 'USD'),
('tool_005', 'trae', 'Trae', '鐎涙濡捄鍐插З', 'mixed', 'CNY'),
('tool_006', 'claude_code', 'Claude Code', 'Anthropic', 'token', 'USD'),
('tool_007', 'uniapi', 'UniAPI', '閸愬懘鍎撮獮鍐插酱', 'token', 'CNY'),
('tool_008', 'fastgpt', 'FastGPT', 'FastGPT', 'call', 'CNY');

-- Mock Data: models (8)
INSERT OR IGNORE INTO ai_models (id, tool_id, code, name, unit, input_price, output_price, currency) VALUES
('model_001', 'tool_003', 'gpt-5', 'GPT-5', 'token', 0.01, 0.03, 'USD'),
('model_002', 'tool_003', 'gpt-5-mini', 'GPT-5 Mini', 'token', 0.002, 0.006, 'USD'),
('model_003', 'tool_006', 'claude-opus', 'Claude Opus', 'token', 0.015, 0.075, 'USD'),
('model_004', 'tool_006', 'claude-sonnet', 'Claude Sonnet', 'token', 0.003, 0.015, 'USD'),
('model_005', 'tool_007', 'qwen-max', '闁矮绠熼崡鍐６ Max', 'token', 0.02, 0.06, 'CNY'),
('model_006', 'tool_007', 'deepseek-v3', 'DeepSeek V3', 'token', 0.001, 0.002, 'CNY'),
('model_007', 'tool_008', 'gpt-4o-mini', 'GPT-4o Mini', 'call', 0.02, 0, 'CNY'),
('model_008', 'tool_001', 'feishu-assistant', '妞嬬偘鍔熼弲楦垮厴閸斺晜澧?, 'call', 0.1, 0, 'CNY');

-- Mock Data: projects (4)
INSERT OR IGNORE INTO projects (id, code, name, department_id, manager_id, start_date) VALUES
('project_001', 'CRM-2026', 'CRM 闁插秵鐎い鍦窗', 'dept_001', 'user_002', '2026-01-10'),
('project_002', 'DATA-2026', '閺佺増宓侀獮鍐插酱妞ゅ湱娲?, 'dept_002', 'user_005', '2026-02-01'),
('project_003', 'MKT-2026', '閸濅胶澧濋崘鍛啇娑擃厼褰?, 'dept_003', 'user_006', '2026-01-20'),
('project_004', 'CS-2026', '鐎广垺婀囬惌銉ㄧ槕鎼?, 'dept_004', NULL, '2026-03-01');

-- Mock Data: employee-project relations (4)
INSERT OR IGNORE INTO employee_projects (employee_id, project_id, project_role) VALUES
('user_001', 'project_001', '瀵偓閸欐垶鍨氶崨?),
('user_004', 'project_002', '閺佺増宓侀崚鍡樼€介幋鎰喅'),
('user_006', 'project_003', '閸愬懎顔愮拹鐔荤煑娴?),
('user_001', 'project_002', '閸楀繋缍旈幋鎰喅');

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
('app_001', 'APP-202608-0001', 'quota', 'user_001', 'dept_001', 'project_001', 'tool_003', 'budget_001', 18000, 18000, 'CRM 闁插秵鐎い鍦窗闂団偓鐟曚椒濞囬悽?Codex 鐎瑰本鍨氭禒锝囩垳鏉╀胶些閸滃本绁寸拠鏇樷偓?, 'approved', 'user_002', '2026-08-01T09:30:00+08:00', '2026-08-01T14:20:00+08:00'),
('app_002', 'APP-202608-0002', 'extra_usage', 'user_004', 'dept_002', 'project_002', 'tool_006', 'budget_002', 8000, NULL, '閺佺増宓侀獮鍐插酱妞ゅ湱娲伴棁鈧憰浣割杻閸?Claude Code 娴ｈ法鏁ゆ０婵嗗閵?, 'pending', NULL, '2026-08-10T10:15:00+08:00', NULL),
('app_003', 'APP-202608-0003', 'budget_increase', 'user_005', 'dept_002', 'project_002', NULL, 'budget_002', 120000, NULL, '閺佺増宓侀獮鍐插酱妞ゅ湱娲版潻娑樺弳闂嗗棔鑵戝鈧崣鎴炴埂閿涘瞼鏁电拠宄板嬀鎼达箓鍎撮梻銊╊暕缁犳鎷烽崝鐘偓?, 'pending', NULL, '2026-08-11T16:40:00+08:00', NULL),
('app_004', 'APP-202608-0004', 'quota', 'user_006', 'dept_003', 'project_003', 'tool_007', 'budget_003', 10000, 10000, '閸濅胶澧濋崘鍛啇娑擃厼褰撮棁鈧憰浣峰▏閻?UniAPI 閻㈢喐鍨氶崘鍛啇缁辩姵娼楅妴?, 'approved', 'user_003', '2026-08-02T11:00:00+08:00', '2026-08-02T15:00:00+08:00');

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
('alert_001', 'usage_rate_90', 'high', 'user_001', 'dept_001', 'project_001', 'app_001', 'Codex 鐠愬湱鏁ら崡鍐茬殺娴ｈ法鏁ょ€?, 'CRM 闁插秵鐎い鍦窗閻?Codex 閻㈠疇顕０婵嗗娴ｈ法鏁ら悳鍥у嚒鐡掑懓绻?90%閵?, 18000, 16740, 93, 'unread', '2026-08-12T09:00:00+08:00'),
('alert_002', 'usage_rate_80', 'warning', 'user_004', 'dept_002', 'project_002', 'app_002', 'Claude Code 娴ｈ法鏁ら悳鍥窛妤?, '閺佺増宓侀獮鍐插酱妞ゅ湱娲伴惃?Claude Code 鐠愬湱鏁ゆ担璺ㄦ暏閻滃洤鍑＄搾鍛扮箖 80%閵?, 8000, 6520, 81.5, 'unread', '2026-08-12T10:00:00+08:00'),
('alert_003', 'usage_rate_80', 'warning', 'user_006', 'dept_003', 'project_003', 'app_004', 'UniAPI 鐠愬湱鏁ゆ担璺ㄦ暏閻滃洩绶濇?, '閸濅胶澧濋崘鍛啇娑擃厼褰撮惃?UniAPI 鐠愬湱鏁ゆ担璺ㄦ暏閻滃洤鍑℃潏鎯у煂 80%閵?, 10000, 8000, 80, 'read', '2026-08-11T14:00:00+08:00'),
('alert_004', 'budget_execution', 'warning', NULL, 'dept_001', NULL, NULL, '娴溠冩惂閻柨褰傞柈銊╊暕缁犳澧界悰宀€宸奸幓鎰板晪', '娴溠冩惂閻柨褰傞柈銊ュ嬀鎼达箓顣╃粻妤佸⒔鐞涘瞼宸煎鑼剁Т鏉?50%閿涘苯缂撶拋顔煎彠濞夈劌鎮楃紒顓濆▏閻劏绉奸崝瑁も偓?, 900000, 486200, 54.02, 'unread', '2026-08-13T08:00:00+08:00');

-- Mock Data: audit logs (2)
UPDATE applications SET approval_stage = 'completed' WHERE status IN ('approved', 'rejected');

INSERT OR IGNORE INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_data) VALUES
('audit_001', 'user_003', 'approve', 'application', 'app_001', '{"status":"approved","approvedAmount":18000}'),
('audit_002', 'user_003', 'create', 'usage_record', 'usage_001', '{"amount":6480,"source":"manual"}');

-- Additional demo data: keep every functional module at 10+ records.
INSERT OR IGNORE INTO departments (id, code, name) VALUES
('dept_006', 'FIN', '鐠愩垹濮熺粻锛勬倞闁?), ('dept_007', 'HR', '娴滃搫濮忕挧鍕爱闁?), ('dept_008', 'LEGAL', '濞夋洖濮熼崥鍫ｎ潐闁?),
('dept_009', 'SALES', '闁库偓閸烆喛绻嶉拃銉╁劥'), ('dept_010', 'PMO', '妞ゅ湱娲扮粻锛勬倞閸旂偛鍙曠€?);

INSERT OR IGNORE INTO users (id, username, password_hash, name, email, role, department_id) VALUES
('user_007', 'employee.wu', 'demo_hash', '閸氭潙鈧?, 'wuqian@example.com', 'employee', 'dept_004'),
('user_008', 'manager.wang', 'demo_hash', '閻滃顥?, 'wanglei@example.com', 'manager', 'dept_004'),
('user_009', 'employee.sun', 'demo_hash', '鐎涙瑦鍋?, 'sunyue@example.com', 'employee', 'dept_005'),
('user_010', 'employee.he', 'demo_hash', '娴ｆ洜鍔?, 'heran@example.com', 'employee', 'dept_006');

INSERT OR IGNORE INTO ai_tools (id, code, name, vendor, billing_type, default_currency) VALUES
('tool_009', 'internal_ai_lab', '閸愬懘鍎?AI 鐎圭偤鐛欑€广倧绱欏鏃傘仛閿?, '閸忣剙寰冮崘鍛村劥', 'credit', 'CNY'),
('tool_010', 'local_rag', '閺堫剙婀撮惌銉ㄧ槕鎼存挸濮幍瀣剁礄濠曟梻銇氶敍?, '閸忣剙寰冮崘鍛村劥', 'call', 'CNY');

INSERT OR IGNORE INTO ai_models (id, tool_id, code, name, unit, input_price, output_price, currency) VALUES
('model_009', 'tool_009', 'lab-chat', '閸愬懘鍎寸€圭偤鐛欑€广倕顕拠婵嚹侀崹?, 'credit', 0.08, 0.12, 'CNY'),
('model_010', 'tool_009', 'lab-code', '閸愬懘鍎寸€圭偤鐛欑€广倓鍞惍浣鼓侀崹?, 'credit', 0.1, 0.15, 'CNY'),
('model_011', 'tool_010', 'local-rag-v1', '閺堫剙婀撮惌銉ㄧ槕鎼存挻顥呯槐銏∧侀崹?, 'call', 0.2, 0, 'CNY'),
('model_012', 'tool_010', 'local-rag-v2', '閺堫剙婀撮惌銉ㄧ槕鎼存挸顤冨鐑樐侀崹?, 'call', 0.3, 0, 'CNY');

INSERT OR IGNORE INTO projects (id, code, name, department_id, manager_id, start_date) VALUES
('project_005', 'FIN-2026', '鐠愩垹濮熼弲楦垮厴閹躲儴銆冩い鍦窗', 'dept_006', 'user_003', '2026-03-10'),
('project_006', 'HR-2026', '閸涙ê浼愰張宥呭閸斺晜澧滄い鍦窗', 'dept_007', 'user_003', '2026-03-15'),
('project_007', 'LEGAL-2026', '閸氬牆鎮撶€光剝鐓￠幓鎰櫏妞ゅ湱娲?, 'dept_008', 'user_003', '2026-04-01'),
('project_008', 'SALES-2026', '闁库偓閸烆喚鐓＄拠鍡楃氨妞ゅ湱娲?, 'dept_009', 'user_003', '2026-04-05'),
('project_009', 'PMO-2026', '妞ゅ湱娲扮粻锛勬倞閺呴缚鍏橀崠鏍€嶉惄?, 'dept_010', 'user_003', '2026-04-10'),
('project_010', 'CORP-2026', '娴间椒绗?AI 閼宠棄濮忛崗鍗炵紦妞ゅ湱娲?, 'dept_005', 'user_003', '2026-04-15');

INSERT OR IGNORE INTO annual_budgets (id, department_id, budget_year, initial_amount, increase_amount, used_amount, created_by) VALUES
('budget_006', 'dept_006', 2026, 210000, 20000, 88000, 'user_003'), ('budget_007', 'dept_007', 2026, 180000, 0, 72000, 'user_003'),
('budget_008', 'dept_008', 2026, 160000, 10000, 66000, 'user_003'), ('budget_009', 'dept_009', 2026, 240000, 0, 142000, 'user_003'),
('budget_010', 'dept_010', 2026, 300000, 50000, 190000, 'user_003');

INSERT OR IGNORE INTO department_quotas (id, department_id, quota_year, allocated_amount, used_amount, created_by) VALUES
('quota_006', 'dept_006', 2026, 60000, 33000, 'user_003'), ('quota_007', 'dept_007', 2026, 50000, 28000, 'user_003'),
('quota_008', 'dept_008', 2026, 45000, 24000, 'user_003'), ('quota_009', 'dept_009', 2026, 80000, 57000, 'user_003'),
('quota_010', 'dept_010', 2026, 100000, 71000, 'user_003');

INSERT OR IGNORE INTO applications (id, application_no, type, applicant_id, department_id, project_id, tool_id, budget_id, requested_amount, reason, status, approval_stage, submitted_at) VALUES
('app_005', 'APP-202608-0005', 'quota', 'user_007', 'dept_004', 'project_004', 'tool_001', 'budget_004', 12000, '鐎广垺婀囬惌銉ㄧ槕鎼存挸濮幍瀣杺鎼达妇鏁电拠?, 'pending', 'manager', '2026-08-03T09:00:00+08:00'),
('app_006', 'APP-202608-0006', 'extra_usage', 'user_009', 'dept_005', 'project_010', 'tool_008', 'budget_005', 6000, '缂佺厧鎮庣粻锛勬倞妞ゅ湱娲版潻钘夊鐠嬪啰鏁ゆ０婵嗗', 'pending', 'budget_admin', '2026-08-04T09:30:00+08:00'),
('app_007', 'APP-202608-0007', 'tool_access', 'user_010', 'dept_006', 'project_005', 'tool_009', 'budget_006', 3000, '鐠愩垹濮熼幎銉ㄣ€冩い鍦窗瀵偓闁艾鐤勬灞灸侀崹?, 'rejected', 'completed', '2026-08-05T10:00:00+08:00'),
('app_008', 'APP-202608-0008', 'quota', 'user_001', 'dept_001', 'project_002', 'tool_006', 'budget_001', 9000, '鐠恒劑鍎撮梻銊┿€嶉惄顕€顤傛惔锔炬暤鐠?, 'approved', 'completed', '2026-08-06T11:00:00+08:00'),
('app_009', 'APP-202608-0009', 'extra_usage', 'user_004', 'dept_002', 'project_002', 'tool_009', 'budget_002', 7000, '閺佺増宓侀獮鍐插酱濡€崇€风拫鍐暏妫版繂瀹?, 'pending', 'manager', '2026-08-07T13:00:00+08:00'),
('app_010', 'APP-202608-0010', 'budget_increase', 'user_005', 'dept_002', 'project_002', NULL, 'budget_002', 50000, '閺佺増宓侀獮鍐插酱楠炴潙瀹虫０鍕暬鏉╄棄濮?, 'pending', 'budget_admin', '2026-08-08T14:00:00+08:00');

INSERT OR IGNORE INTO usage_records (id, employee_id, department_id, project_id, tool_id, model_id, usage_type, quantity, original_currency, original_amount, exchange_rate, amount, source, status, occurred_at, created_by) VALUES
('usage_007', 'user_007', 'dept_004', 'project_004', 'tool_001', 'model_008', 'call', 380, 'CNY', 380, 1, 380, 'manual', 'confirmed', '2026-08-06T10:00:00+08:00', 'user_003'),
('usage_008', 'user_009', 'dept_005', 'project_010', 'tool_008', 'model_007', 'call', 670, 'CNY', 670, 1, 670, 'manual', 'confirmed', '2026-08-07T10:00:00+08:00', 'user_003'),
('usage_009', 'user_010', 'dept_006', 'project_005', 'tool_009', 'model_009', 'credit', 1200, 'CNY', 1200, 1, 1200, 'csv', 'confirmed', '2026-08-08T10:00:00+08:00', 'user_003'),
('usage_010', 'user_001', 'dept_001', 'project_001', 'tool_004', 'model_001', 'seat', 1, 'USD', 19, 7.2, 136.8, 'manual', 'confirmed', '2026-08-09T10:00:00+08:00', 'user_003');

INSERT OR IGNORE INTO alerts (id, type, level, employee_id, department_id, project_id, application_id, title, message, allocated_amount, used_amount, usage_rate, status, occurred_at) VALUES
('alert_005', 'usage_rate_70', 'info', 'user_007', 'dept_004', 'project_004', 'app_005', '鐎广垺婀囨０婵嗗娴ｈ法鏁ら幓鎰板晪', '鐎广垺婀囬惌銉ㄧ槕鎼存捇銆嶉惄顕€顤傛惔锕€鍑℃担璺ㄦ暏 72%閵?, 12000, 8640, 72, 'unread', '2026-08-06T09:00:00+08:00'),
('alert_006', 'usage_rate_90', 'high', 'user_009', 'dept_005', 'project_010', 'app_006', '缂佺厧鎮庣粻锛勬倞妫版繂瀹抽崡鍐茬殺閻劌鐣?, '缂佺厧鎮庣粻锛勬倞妞ゅ湱娲版０婵嗗瀹歌弓濞囬悽?92%閵?, 6000, 5520, 92, 'unread', '2026-08-07T09:00:00+08:00'),
('alert_007', 'budget_execution', 'warning', NULL, 'dept_006', NULL, NULL, '鐠愩垹濮熺粻锛勬倞闁劑顣╃粻妤佸絹闁?, '闁劑妫獮鏉戝妫板嫮鐣婚幍褑顢戦悳鍥у嚒鏉?42%閵?, 230000, 88000, 38.26, 'read', '2026-08-08T09:00:00+08:00'),
('alert_008', 'usage_rate_80', 'warning', 'user_010', 'dept_006', 'project_005', 'app_007', '鐠愩垹濮熷Ο鈥崇€锋０婵嗗鏉堝啴鐝?, '鐠愩垹濮熼幎銉ㄣ€冩い鍦窗妫版繂瀹冲韫▏閻?80%閵?, 3000, 2400, 80, 'unread', '2026-08-09T09:00:00+08:00'),
('alert_009', 'usage_rate_90', 'high', 'user_004', 'dept_002', 'project_002', 'app_009', '閺佺増宓侀獮鍐插酱妫版繂瀹虫０鍕劅', '閺佺増宓侀獮鍐插酱妞ゅ湱娲版０婵嗗瀹歌弓濞囬悽?90%閵?, 7000, 6300, 90, 'unread', '2026-08-10T09:00:00+08:00'),
('alert_010', 'budget_execution', 'warning', NULL, 'dept_010', NULL, NULL, '妞ゅ湱娲扮粻锛勬倞閸旂偛鍙曠€广倝顣╃粻妤佸絹闁?, '闁劑妫獮鏉戝妫板嫮鐣婚幍褑顢戦悳鍥у嚒鏉?63%閵?, 350000, 220500, 63, 'read', '2026-08-11T09:00:00+08:00');

UPDATE applications SET approval_stage = 'completed' WHERE status IN ('approved', 'rejected');

INSERT OR IGNORE INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_data) VALUES
('audit_003', 'user_002', 'approve_manager', 'application', 'app_005', '{"approvalStage":"budget_admin"}'),
('audit_004', 'user_003', 'approve_budget', 'application', 'app_006', '{"status":"approved"}'),
('audit_005', 'user_002', 'reject', 'application', 'app_007', '{"status":"rejected"}'),
('audit_006', 'user_003', 'import', 'usage_record', 'usage_007', '{"amount":380}'),
('audit_007', 'user_003', 'import', 'usage_record', 'usage_008', '{"amount":670}'),
('audit_008', 'user_003', 'create', 'alert', 'alert_005', '{"usageRate":72}'),
('audit_009', 'user_003', 'create', 'budget', 'budget_006', '{"totalAmount":230000}'),
('audit_010', 'user_003', 'create', 'project', 'project_005', '{"status":"active"}');

COMMIT;

