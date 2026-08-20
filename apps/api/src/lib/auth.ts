import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/client.js';
import { rolePermissions, users } from '../db/schema.js';

export type UserRole = 'employee' | 'manager' | 'budget_admin' | 'system_admin';
export type AuthUser = { id: string; username: string; name: string; role: UserRole; departmentId: string };

declare module '@fastify/jwt' {
  interface FastifyJWT { payload: AuthUser; user: AuthUser; }
}
declare module 'fastify' {
  interface FastifyInstance { authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>; }
}

export async function getRolePermissions(role: UserRole) {
  const rows = await db.select({ id: rolePermissions.permissionId }).from(rolePermissions).where(eq(rolePermissions.roleId, role));
  return rows.map((row) => row.id);
}

export default fp(async (app: FastifyInstance) => {
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'change-me-in-production' });
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    await request.jwtVerify();
    const current = await db.select().from(users).where(eq(users.id, request.user.id)).get();
    if (!current || current.status !== 'active') {
      reply.code(401).send({ code: 401, msg: '账号不存在或已停用', data: null });
      return;
    }
    request.user = { id: current.id, username: current.username, name: current.name, role: current.role, departmentId: current.departmentId };
  });
});

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const permissions = await getRolePermissions(request.user.role);
    if (!permissions.includes(permission)) {
      reply.code(403).send({ code: 403, msg: '当前角色无权执行该操作', data: null });
    }
  };
}
