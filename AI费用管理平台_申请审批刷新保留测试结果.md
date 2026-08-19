# AI 费用管理平台
## 申请→主管审批→预算员审批→刷新后数据保留实际测试结果

> 测试日期：2026-08-19  
> 测试环境：本地 API，`http://127.0.0.1:3000`  
> 测试方式：真实调用登录、申请、审批、详情查询和申请列表接口；审批完成后重启 API，再次查询详情验证数据持久化。  
> 测试结论：通过

## 1. 测试目标

验证一条新申请可以完整走通以下业务流程：

```text
员工提交申请
  ↓
部门主管审批
  ↓
预算管理员审批
  ↓
重新加载/刷新数据后仍保留最终审批结果
```

## 2. 测试账号

| 角色 | 账号 | 用途 |
|---|---|---|
| 员工 | `employee.demo` | 创建申请、查看自己的申请 |
| 部门主管 | `manager.demo` | 执行主管审批 |
| 预算管理员 | `budget.admin` | 执行最终预算审批 |

## 3. 测试数据

| 字段 | 实际值 |
|---|---|
| 申请 ID | `app_71c672fb-8277-4914-929c-3e02db8f04de` |
| 申请编号 | `APP-1787129212918` |
| 申请类型 | `quota` |
| 申请金额 | `1888` |
| 主管审批金额 | `1888` |
| 预算员最终审批金额 | `1800` |
| 项目 | `project_001` |
| AI 工具 | `tool_003` |
| 预算 | `budget_001` |
| 申请理由 | 实际审批链路与刷新保留测试 |

## 4. 执行过程和实际结果

### 4.1 员工提交申请

**请求：**

```http
POST /api/v1/applications
Authorization: Bearer <employee.demo token>
Content-Type: application/json
```

**请求参数：**

```json
{
  "type": "quota",
  "requestedAmount": 1888,
  "projectId": "project_001",
  "toolId": "tool_003",
  "budgetId": "budget_001",
  "reason": "实际审批链路与刷新保留测试"
}
```

**实际返回：HTTP 201**

```json
{
  "code": 201,
  "msg": "created",
  "data": {
    "id": "app_71c672fb-8277-4914-929c-3e02db8f04de",
    "applicationNo": "APP-1787129212918"
  }
}
```

**结果：通过。** 员工提交成功，系统生成申请 ID 和申请编号，申请初始状态为 `pending`、审批阶段为 `manager`。

### 4.2 部门主管审批

**请求：**

```http
POST /api/v1/applications/app_71c672fb-8277-4914-929c-3e02db8f04de/approve
Authorization: Bearer <manager.demo token>
Content-Type: application/json
```

**请求参数：**

```json
{
  "comment": "主管审核通过",
  "approvedAmount": 1888
}
```

**实际返回：HTTP 200**

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "id": "app_71c672fb-8277-4914-929c-3e02db8f04de",
    "status": "pending",
    "approvalStage": "budget_admin",
    "message": "已通过主管审批，等待预算管理员审批"
  }
}
```

**主管审批后详情查询结果：**

```json
{
  "status": "pending",
  "approvalStage": "budget_admin",
  "approvedAmount": 1888,
  "reviewerId": "user_002",
  "reviewedAt": null
}
```

**结果：通过。** 主管审批不会直接结束流程，申请正确进入预算管理员审批阶段。

### 4.3 预算管理员审批

**请求：**

```http
POST /api/v1/applications/app_71c672fb-8277-4914-929c-3e02db8f04de/approve
Authorization: Bearer <budget.admin token>
Content-Type: application/json
```

**请求参数：**

```json
{
  "comment": "预算员审核通过",
  "approvedAmount": 1800
}
```

**实际返回：HTTP 200**

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "id": "app_71c672fb-8277-4914-929c-3e02db8f04de",
    "status": "approved",
    "approvalStage": "completed",
    "message": "申请已最终通过"
  }
}
```

**结果：通过。** 预算管理员审批后，申请状态变为 `approved`，审批阶段变为 `completed`，最终审批金额为 `1800`。

### 4.4 模拟刷新/重新加载申请详情

在最终审批成功后，重新发起：

```http
GET /api/v1/applications/app_71c672fb-8277-4914-929c-3e02db8f04de
Authorization: Bearer <new employee.demo token>
```

本次查询发生在重新登录并重新启动 API 服务之后，用于验证数据库持久化，而不是复用审批请求的内存结果。

**实际返回关键字段：HTTP 200**

```json
{
  "code": 200,
  "data": {
    "id": "app_71c672fb-8277-4914-929c-3e02db8f04de",
    "applicationNo": "APP-1787129212918",
    "requestedAmount": 1888,
    "approvedAmount": 1800,
    "status": "approved",
    "approvalStage": "completed",
    "reviewerId": "user_003",
    "createdAt": "2026-08-19T08:46:52.918Z",
    "reviewedAt": "2026-08-19T08:46:53.016Z"
  }
}
```

**结果：通过。** API 服务重新启动后，申请仍存在，最终状态、审批阶段、审批金额、审批人和时间均保留。

### 4.5 刷新申请列表

重新请求：

```http
GET /api/v1/applications?page=1&pageSize=100
Authorization: Bearer <employee.demo token>
```

**实际结果：**

- HTTP 状态：`200`
- 列表中找到测试申请：`1` 条
- 申请 ID：`app_71c672fb-8277-4914-929c-3e02db8f04de`
- 申请编号：`APP-1787129212918`
- 状态：`approved`
- 审批阶段：`completed`
- 最终审批金额：`1800`

**结果：通过。** 刷新申请列表后，测试申请仍然展示，数据没有丢失。

## 5. 流程断言结果

| 断言 | 预期 | 实际 | 结果 |
|---|---|---|---|
| 员工可以提交申请 | HTTP 201，生成申请 ID | HTTP 201，生成 `app_71c672fb-8277-4914-929c-3e02db8f04de` | 通过 |
| 主管审批后不能直接结束 | 状态仍为 `pending` | `pending` | 通过 |
| 主管审批后进入预算员阶段 | `approvalStage=budget_admin` | `budget_admin` | 通过 |
| 预算管理员可以最终审批 | 状态变为 `approved` | `approved` | 通过 |
| 流程最终阶段正确 | `approvalStage=completed` | `completed` | 通过 |
| 审批金额保留 | 最终金额为 `1800` | `1800` | 通过 |
| 服务重启后详情保留 | GET 仍返回测试申请 | HTTP 200，申请存在 | 通过 |
| 刷新列表后记录保留 | 列表中找到 1 条 | 找到 1 条 | 通过 |

## 6. 测试中发现并修复的问题

首次启动测试 API 时，`database.sql` 的部分历史 Mock Data 字符串存在引号不完整问题，SQLite 返回：

```text
SqliteError: near "dept_002": syntax error
```

处理方式：

- 重写异常的初始化 Mock Data 字符串为有效 SQL。
- 保留原有业务数据结构和测试数据数量要求。
- 使用 SQLite 内存数据库执行完整 `database.sql` 校验。
- 校验结果：`SQL_OK`。
- 修复后 API 正常启动并完成本次审批链路测试。

## 7. 最终结论

本次实际测试完整通过：

```text
员工提交成功
→ 主管审批成功
→ 预算员审批成功
→ API 服务重新启动
→ 重新查询详情成功
→ 刷新申请列表后数据仍然存在
```

申请审批状态机、数据库持久化和刷新后数据保留均符合当前 MVP 需求。