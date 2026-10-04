import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
import {
  isRedisLockContention,
  LockAcquisitionError,
  RedisLeaseLostError,
} from '@server/lib/redis/lock.js';
import { CombatV6MutationLockedError } from '@server/combat/mutation-policy.js';

export function errorBody(
  message: string,
  status = 500,
  details?: unknown,
): Response {
  const body: { success: false; error: string; details?: unknown } = {
    success: false,
    error: message,
  };

  if (getRuntimeEnvironment().NODE_ENV === 'development' && details) {
    body.details = details instanceof Error ? details.message : details;
  }

  return Response.json(body, { status });
}

export function redisLockErrorResponse(error: unknown): Response | null {
  if (error instanceof CombatV6MutationLockedError)
    return Response.json(
      { success: false, code: error.code, error: error.message },
      { status: 409 },
    );
  if (isRedisLockContention(error)) {
    const response = errorBody('操作正在处理中，请稍后重试', 429);
    response.headers.set('Retry-After', '1');
    return response;
  }
  if (error instanceof LockAcquisitionError) {
    const response = errorBody('Redis 协调服务暂不可用，请稍后重试', 503);
    response.headers.set('Retry-After', '1');
    return response;
  }
  if (error instanceof RedisLeaseLostError) {
    const response = errorBody(error.message, 503);
    response.headers.set('Retry-After', '1');
    return response;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '55P03'
  ) {
    const response = errorBody('数据库事务繁忙，请稍后重试', 503);
    response.headers.set('Retry-After', '1');
    return response;
  }
  return null;
}
