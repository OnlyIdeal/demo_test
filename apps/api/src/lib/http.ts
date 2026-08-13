import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';

export const idSchema = z.string().trim().min(1, 'ID 不能为空');
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const roleSchema = z.enum(['employee', 'manager', 'budget_admin']);
export type UserRole = z.infer<typeof roleSchema>;

export const ok = (reply: FastifyReply, data: unknown, msg = 'success', code = 200) => reply.code(code).send({ code, msg, data });
export const created = (reply: FastifyReply, data: unknown, msg = 'created') => ok(reply, data, msg, 201);
export const fail = (reply: FastifyReply, code: number, msg: string, data: unknown = null) => reply.code(code).send({ code, msg, data });

export function readBody<T extends z.ZodTypeAny>(request: FastifyRequest, schema: T): z.infer<T> {
  return schema.parse(request.body);
}
export function readQuery<T extends z.ZodTypeAny>(request: FastifyRequest, schema: T): z.infer<T> {
  return schema.parse(request.query);
}

export const errorHandler = (error: unknown, reply: FastifyReply) => {
  if (error instanceof z.ZodError) return fail(reply, 400, '请求参数校验失败', error.flatten());
  const err = error as { statusCode?: number; message?: string; code?: string };
  if (err.code === 'FST_JWT_NO_AUTH' || err.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') return fail(reply, 401, '登录已失效，请重新登录');
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return fail(reply, 409, '数据已存在，不能重复创建');
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return fail(reply, 400, '关联数据不存在或不允许删除');
  requestLog(error);
  return fail(reply, err.statusCode && err.statusCode >= 400 ? err.statusCode : 500, '服务器内部错误');
};
function requestLog(error: unknown) { console.error(error); }
