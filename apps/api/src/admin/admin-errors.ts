import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { apiErrorFilter } from '../http/error-filter.js';

export const AdminErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  console.error('Admin API error:', error);
  return Response.json(
    { success: false, error: '服务器内部错误' },
    { status: 500 },
  );
});
