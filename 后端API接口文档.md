# AI 费用管理平台 MVP 后端 API 文档

> 版本：v1.0  
> 数据库：SQLite 3.31+  
> 服务框架：Node.js 22 + Fastify 5 + Drizzle ORM  
> 基础路径：`/api/v1`

---

## 1. 通用约定

### 1.1 请求地址

本地开发地址：

```text
http://localhost:3000
```

所有业务接口前缀：

```text
/api/v1
```

健康检查接口：

```text
GET /health
```

### 1.2 认证请求头

除登录和健康检查外，接口需要携带 JWT：

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### 1.3 成功响应格式

```json
{
  "code": 200,
  "msg": "success",
  "data": {},
  "requestId": "可选请求编号",
  "timestamp": "2026-08-13T10:30:00+08:00"
}
```

创建成功：

```json
{
  "code": 201,
  "msg": "created",
  "data": {}
}
```

### 1.4 失败响应格式

```json
{
  "code": 400,
  "msg": "请求参数校验失败",
  "data": {
    "formErrors": [],
    "fieldErrors": {
      "requestedAmount": ["Number must be greater than 0"]
    }
  }
}
```

### 1.5 分页响应格式

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 120,
      "totalPages": 6
    }
  }
}
```

分页参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---:|---|
| `page` | integer | 否 | `1` | 页码，最小为 1 |
| `pageSize` | integer | 否 | `20` | 每页数量，范围 1-100 |

### 1.6 错误码

| HTTP/业务码 | 含义 | 使用场景 |
|---:|---|---|
| `200` | 成功 | 查询、修改成功 |
| `201` | 创建成功 | 新建费用、申请成功 |
| `400` | 请求参数错误 | 必填参数为空、类型错误、业务关联不一致 |
| `401` | 未认证 | Token 缺失、过期或账号密码错误 |
| `403` | 无权限 | 角色无权访问或操作数据 |
| `404` | 资源不存在 | 用户、项目、申请、预算不存在 |
| `409` | 状态冲突 | 已审批申请重复审批、唯一数据重复 |
| `500` | 服务器错误 | 未预期的后端异常 |

### 1.7 安全和校验规则

- 所有 Body、Query、Path 参数均使用 Zod Schema 校验。
- 所有字符串参数必须 `trim()` 后校验非空。
- 金额字段必须为数字且大于 0；已使用金额允许为 0。
- ID 字段必须为非空字符串。
- 日期字段必须为非空字符串；业务层按 ISO 8601 处理。
- 所有数据库查询使用 Drizzle ORM 条件构造器，底层生成参数化 SQL。
- 禁止将用户输入拼接进 SQL 字符串。
- 后端再次校验角色、部门和员工归属，不能只依赖前端隐藏按钮。

---

## 2. 角色和数据范围

| 角色 | 值 | 数据范围 |
|---|---|---|
| 员工 | `employee` | 仅本人申请、费用和预警 |
| 部门主管 | `manager` | 本部门申请、费用、项目和预算 |
| 预算管理员 | `budget_admin` | 全公司数据和管理操作 |

Demo 账号：

| 用户名 | 密码 | 角色 |
|---|---|---|
| `employee.demo` | `Employee@2026!` | `employee` |
| `manager.demo` | `Manager@2026!` | `manager` |
| `budget.admin` | `BudgetAdmin@2026!` | `budget_admin` |

---

## 3. 认证模块

### 3.1 用户登录

```http
POST /api/v1/auth/login
```

请求体：

```json
{
  "username": "employee.demo",
  "password": "BudgetAdmin@2026!"
}
```

字段规则：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `username` | string | 是 | 非空登录账号 |
| `password` | string | 是 | 非空密码 |

成功返回：

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "user_001",
      "username": "employee.demo",
      "name": "张小明",
      "email": "zhangxiaoming@example.com",
      "role": "employee",
      "departmentId": "dept_001"
    }
  }
}
```

异常：

- `401`：用户名或密码错误。
- `400`：用户名或密码为空。

### 3.2 获取当前用户

```http
GET /api/v1/auth/me
```

权限：已登录用户。

返回数据：当前用户信息和部门名称。

### 3.3 退出登录

MVP 使用无状态 JWT，退出登录由前端删除本地 Token。后端不需要持久化登出接口。

---

## 4. 工作台模块

### 4.1 获取工作台概览

```http
GET /api/v1/dashboard/overview?year=2026
```

权限：全部角色。

Query 参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---:|---|
| `year` | integer | 否 | 当前年份 | 预算年度，范围 2000-2100 |

返回：

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "year": 2026,
    "budget": {
      "totalAmount": 900000,
      "usedAmount": 486200,
      "remainingAmount": 413800,
      "executionRate": 54.02
    },
    "quota": {
      "allocatedAmount": 180000,
      "usedAmount": 137400,
      "remainingAmount": 42600,
      "usageRate": 76.33
    },
    "unreadAlertCount": 3
  }
}
```

数据范围：

- 员工：本人所在部门。
- 部门主管：本人所在部门。
- 预算管理员：全公司。

---

## 5. 费用模块

### 5.1 查询费用记录

```http
GET /api/v1/usages
```

权限：全部角色，数据按角色自动过滤。

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页数量 |
| `departmentId` | string | 否 | 预算管理员可按部门筛选 |
| `employeeId` | string | 否 | 预算管理员可按员工筛选 |
| `projectId` | string | 否 | 项目筛选 |
| `startDate` | string | 否 | 开始时间 |
| `endDate` | string | 否 | 结束时间 |

返回字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 费用记录 ID |
| `employeeId` | string | 员工 ID |
| `employeeName` | string | 员工姓名 |
| `departmentId` | string | 部门 ID |
| `departmentName` | string | 部门名称 |
| `projectId` | string/null | 项目 ID |
| `projectName` | string/null | 项目名称 |
| `toolId` | string | 工具 ID |
| `toolName` | string | 工具名称 |
| `modelId` | string/null | 模型 ID |
| `amount` | number | 人民币费用 |
| `quantity` | number | 原始用量 |
| `usageType` | string | 用量类型 |
| `occurredAt` | string | 发生时间 |

### 5.2 新增费用记录

```http
POST /api/v1/usages
```

权限：`budget_admin`。

请求体：

```json
{
  "employeeId": "user_001",
  "departmentId": "dept_001",
  "projectId": "project_001",
  "toolId": "tool_003",
  "modelId": "model_001",
  "applicationId": "app_001",
  "usageType": "token",
  "quantity": 12000000,
  "originalCurrency": "USD",
  "originalAmount": 900,
  "exchangeRate": 7.2,
  "amount": 6480,
  "occurredAt": "2026-08-13T10:00:00+08:00"
}
```

必填规则：

- `employeeId`、`departmentId`、`toolId`、`usageType`、`quantity`、`originalCurrency`、`originalAmount`、`exchangeRate`、`amount`、`occurredAt` 必填。
- 员工必须存在且属于传入部门，否则返回 `400`。
- 金额和用量不能为负数。

成功返回：

```json
{
  "code": 201,
  "msg": "created",
  "data": { "id": "usage_xxx" }
}
```

---

## 6. 预算模块

### 6.1 查询年度部门预算

```http
GET /api/v1/budgets/annual?year=2026
```

权限：`manager`、`budget_admin`；员工返回 `403`。

返回字段：

```json
{
  "id": "budget_001",
  "departmentId": "dept_001",
  "departmentName": "产品研发部",
  "year": 2026,
  "initialAmount": 800000,
  "increaseAmount": 100000,
  "totalAmount": 900000,
  "usedAmount": 486200,
  "remainingAmount": 413800,
  "executionRate": 54.02,
  "status": "active"
}
```

### 6.2 提交预算增加申请

```http
POST /api/v1/budgets/increase-requests
```

权限：`manager`、`budget_admin`。

请求体：

```json
{
  "budgetId": "budget_002",
  "requestedAmount": 120000,
  "projectId": "project_002",
  "reason": "数据平台项目进入集中开发期，申请年度部门预算追加。"
}
```

规则：

- `budgetId`、`requestedAmount`、`reason` 必填。
- 部门主管只能为本部门预算发起申请。
- 预算管理员可以为任意部门发起申请。
- 本接口创建 `applications.type = budget_increase` 的待审批记录。

---

## 7. 额度模块

### 7.1 查询部门共享额度

```http
GET /api/v1/quotas/overview?year=2026
```

权限：全部角色，结果按角色过滤。

返回字段：

```json
{
  "id": "quota_001",
  "departmentId": "dept_001",
  "departmentName": "产品研发部",
  "year": 2026,
  "allocatedAmount": 180000,
  "usedAmount": 137400,
  "remainingAmount": 42600,
  "usageRate": 76.33
}
```

注意：`usageRate` 是部门共享额度使用率，不是年度预算执行率。

---

## 8. 申请与审批模块

### 8.1 查询申请列表

```http
GET /api/v1/applications?page=1&pageSize=20&status=pending&type=quota
```

权限：全部角色，按角色过滤：

- 员工：本人申请。
- 部门主管：本部门申请。
- 预算管理员：全公司申请。

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页数量 |
| `status` | string | 否 | 申请状态 |
| `type` | string | 否 | 申请类型 |

### 8.2 新建申请

```http
POST /api/v1/applications
```

权限：全部已登录用户；员工不能创建 `budget_increase` 类型。

请求体：

```json
{
  "type": "quota",
  "requestedAmount": 18000,
  "projectId": "project_001",
  "toolId": "tool_003",
  "reason": "CRM 重构项目需要使用 Codex 完成代码迁移和测试。",
  "expectedUsage": "预计使用 3 周",
  "startDate": "2026-08-13",
  "endDate": "2026-09-03"
}
```

必填：`type`、`requestedAmount`、`reason`。

### 8.3 查询申请详情

```http
GET /api/v1/applications/:id
```

权限：申请人、申请所属部门主管、预算管理员。

### 8.4 审批通过

```http
POST /api/v1/applications/:id/approve
```

权限：`manager`、`budget_admin`。

请求体：

```json
{
  "comment": "项目情况属实，同意本次额度申请。",
  "approvedAmount": 18000
}
```

规则：

- `comment` 必填。
- `approvedAmount` 可选，不填时使用申请金额。
- 只能审批 `pending` 状态的申请。
- 部门主管只能审批本部门申请。

### 8.5 驳回申请

```http
POST /api/v1/applications/:id/reject
```

请求体：

```json
{
  "comment": "请补充项目使用计划后重新提交。"
}
```

规则：

- 驳回意见必填。
- 只能驳回 `pending` 状态申请。

---

## 9. 项目模块

### 9.1 查询项目

```http
GET /api/v1/projects
```

权限：全部角色。

数据范围：

- 员工和部门主管：本部门项目。
- 预算管理员：全公司项目。

返回字段：`id`、`code`、`name`、`departmentId`、`departmentName`、`managerId`、`status`。

MVP 暂不提供项目创建和编辑接口，项目先通过数据库 Mock 数据或后台初始化维护。

---

## 10. 预警模块

### 10.1 查询预警

```http
GET /api/v1/alerts?page=1&pageSize=20&status=unread&level=high
```

权限：全部角色，按角色过滤。

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页数量 |
| `status` | string | 否 | `unread`、`read`、`resolved` |
| `level` | string | 否 | `info`、`warning`、`high`、`critical` |

### 10.2 标记预警已读

```http
PATCH /api/v1/alerts/:id/read
```

权限：预警所属员工、部门主管、预算管理员。

返回：

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "id": "alert_001",
    "status": "read"
  }
}
```

---

## 11. 工具与模型模块

### 11.1 查询工具列表

```http
GET /api/v1/catalog/tools
```

权限：全部已登录用户；预算管理员可查看完整台账。

返回字段：

```json
{
  "id": "tool_003",
  "code": "codex",
  "name": "Codex",
  "vendor": "OpenAI",
  "billingType": "token",
  "currency": "USD",
  "modelCount": 2
}
```

MVP 暂不提供工具和模型新增、修改、价格同步接口，先通过数据库初始化脚本维护。

---

## 12. 接口代码结构

```text
apps/api/
├── src/
│   ├── db/
│   │   ├── client.ts
│   │   └── schema.ts
│   ├── lib/
│   │   ├── auth.ts
│   │   └── http.ts
│   ├── routes/
│   │   └── index.ts
│   └── server.ts
├── scripts/
│   └── seed.ts
├── data/
├── .env.example
├── package.json
└── tsconfig.json
```

实现约束：

- `src/routes/index.ts` 负责接口路由和业务组合。
- `src/db/schema.ts` 负责 Drizzle 表定义。
- `src/db/client.ts` 负责 SQLite 连接和初始化。
- `src/lib/http.ts` 负责统一响应、Zod 校验和错误处理。
- `src/lib/auth.ts` 负责 JWT 和角色权限。
- 禁止在页面或路由中拼接 SQL。

---

## 13. 本地启动步骤

### 13.1 环境要求

- Node.js `22.x LTS`
- pnpm `9.x` 或更高版本
- SQLite `3.31+`（服务运行时由 `better-sqlite3` 提供）

### 13.2 安装依赖

在项目根目录执行：

```bash
pnpm install
```

### 13.3 配置环境变量

```bash
copy apps/api/.env.example apps/api/.env
```

PowerShell 也可以执行：

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

开发环境可以保持默认配置。

### 13.4 初始化数据库

服务首次启动会自动执行根目录的 `database.sql`，创建表和插入 Mock 数据。

也可以单独执行：

```bash
pnpm api:seed
```

### 13.5 启动开发服务

```bash
pnpm api:dev
```

启动成功后访问：

```text
http://localhost:3000/health
```

预期返回：

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "status": "ok",
    "service": "ai-ems-api"
  }
}
```

---

## 14. 本地接口测试步骤

### 14.1 登录获取 Token

PowerShell：

```powershell
$login = Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/v1/auth/login `
  -ContentType 'application/json' `
  -Body '{"username":"budget.admin","password":"BudgetAdmin@2026!"}'
$token = $login.data.token
```

### 14.2 查询工作台

```powershell
Invoke-RestMethod -Method Get `
  -Uri 'http://localhost:3000/api/v1/dashboard/overview?year=2026' `
  -Headers @{ Authorization = "Bearer $token" }
```

### 14.3 查询费用

```powershell
Invoke-RestMethod -Method Get `
  -Uri 'http://localhost:3000/api/v1/usages?page=1&pageSize=20' `
  -Headers @{ Authorization = "Bearer $token" }
```

### 14.4 查询申请

```powershell
Invoke-RestMethod -Method Get `
  -Uri 'http://localhost:3000/api/v1/applications?status=pending' `
  -Headers @{ Authorization = "Bearer $token" }
```

### 14.5 审批申请

```powershell
$body = '{"comment":"项目情况属实，同意本次申请。"}'
Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/api/v1/applications/app_002/approve' `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType 'application/json' `
  -Body $body
```

### 14.6 验证无 Token

```powershell
Invoke-RestMethod -Method Get `
  -Uri 'http://localhost:3000/api/v1/dashboard/overview?year=2026'
```

预期返回 `401`。

### 14.7 验证非法参数

```powershell
Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3000/api/v1/applications' `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType 'application/json' `
  -Body '{"type":"quota","requestedAmount":0,"reason":""}'
```

预期返回 `400` 参数校验错误。

---

## 15. 部署说明

MVP 部署时建议：

1. 服务器安装 Node.js 22 和 pnpm。
2. 拉取 GitHub 仓库 `OnlyIdeal/AI-EMS`。
3. 执行 `pnpm install`。
4. 配置 `apps/api/.env`，必须修改 `JWT_SECRET`。
5. 执行 `pnpm api:start`。
6. 使用 Caddy 或 Nginx 反向代理到 `localhost:3000`。
7. 持久化备份 `apps/api/data/ai-ems.sqlite`。

生产环境必须：

- 替换 Demo 密码哈希。
- 使用长度足够且随机的 `JWT_SECRET`。
- 限制 CORS 来源。
- 禁止把 `.env` 和 SQLite 数据库提交到 GitHub。
- 为 SQLite 文件配置定期备份。





