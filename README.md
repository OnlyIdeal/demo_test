# AI-EMS

AI 费用管理平台：统一管理年度部门预算、部门共享额度、员工/部门/项目费用、两级申请审批、使用率预警以及角色权限。

## 目录

- `apps/web`：React + Vite + TypeScript 前端
- `apps/api`：Fastify + Drizzle + SQLite 后端
- `database.sql`：数据库结构和演示数据
- `后端API接口文档.md`：REST API 文档
- `数据库架构设计.md`：数据库架构设计
- `docker-compose.yml`：服务器部署编排
- `Caddyfile`：`demo.onlyideal.top` HTTPS 反向代理

## 本地开发

```bash
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
pnpm api:dev
pnpm --dir apps/web dev
```

前端：`http://localhost:5173`  
后端：`http://localhost:3000`

## 演示账号

| 账号 | 密码 | 角色 |
|---|---|---|
| `system.admin` | `SystemAdmin@2026!` | 系统管理员（默认） |
| `employee.demo` | `Employee@2026!` | 员工 |
| `manager.demo` | `Manager@2026!` | 部门主管 |
| `budget.admin` | `BudgetAdmin@2026!` | 部门预算员（运营部） |

系统管理员拥有全局只读业务视图，并负责用户、角色权限、年度预算、部门额度和工具状态维护；部门主管负责本部门一级审批；部门预算员仅能管理和终审所属部门的数据；员工仅能查看个人费用并发起申请。

## 服务器部署

服务器需要提前完成：

- DNS：`demo.onlyideal.top` 指向服务器公网 IP
- 放通 TCP `80` 和 `443`
- 安装 Docker Compose

部署命令：

```bash
export JWT_SECRET='replace-with-a-random-long-secret'
git clone https://github.com/OnlyIdeal/demo_test.git
cd demo_test
docker compose up -d --build
```

访问：`https://demo.onlyideal.top`

SQLite 文件会持久化在 `apps/api/data/ai-ems.sqlite`，不要删除该目录。
