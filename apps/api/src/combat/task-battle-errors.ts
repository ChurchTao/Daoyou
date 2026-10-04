import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { ZodError } from 'zod';
import { apiErrorFilter } from '../http/error-filter.js';

export function taskBattleErrors(invalidMessage: string) {
  return apiErrorFilter(
    (error) =>
      redisLockErrorResponse(error) ??
      Response.json(
        {
          error:
            error instanceof ZodError
              ? invalidMessage
              : error instanceof Error
                ? error.message
                : String(error),
        },
        { status: error instanceof ZodError ? 400 : 409 },
      ),
  );
}
