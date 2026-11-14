import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { ChatError } from '@server/social/application/chatError.js';
import { ZodError } from 'zod';
import { apiErrorFilter } from '../http/error-filter.js';

export const AdminErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof ChatError)
    return Response.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  // 旧路由的 ZodPipe 用 legacy-unhandled 自行转成 500，到这里的只有新路由的参数错误。
  if (error instanceof ZodError)
    return Response.json(
      { success: false, error: '请求参数无效' },
      { status: 400 },
    );
  console.error('Admin API error:', error);
  return Response.json(
    { success: false, error: '服务器内部错误' },
    { status: 500 },
  );
});
