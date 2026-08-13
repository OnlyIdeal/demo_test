import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export type AuthUser = { id: string; username: string; name: string; role: 'employee' | 'manager' | 'budget_admin'; departmentId: string };

declare module '@fastify/jwt' {
  interface FastifyJWT { payload: AuthUser; user: AuthUser; }
}
declare module 'fastify' {
  interface FastifyInstance { authenticate: (request: FastifyRequest) => Promise<void>; }
}

export default fp(async (app: FastifyInstance) => {
  await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'change-me-in-production' });
  app.decorate('authenticate', async (request: FastifyRequest) => {
    await request.jwtVerify();
  });
});

export function requireRole(...roles: AuthUser['role'][]) {
  return async (request: FastifyRequest, reply: { code: (status: number) => { send: (body: unknown) => void } }) => {
    if (!roles.includes(request.user.role)) reply.code(403).send({ code: 403, msg: '无权限执行该操作', data: null });
  };
}

