import { Controller, Delete, Get, Inject, UseFilters } from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types.js';
import { isRedisLockContention } from '@server/lib/redis/lock.js';
import { Access, CurrentUser } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { LifecycleService } from './lifecycle.service.js';
const DeleteErrors = apiErrorFilter((error) =>
  isRedisLockContention(error)
    ? Response.json(
        { error: '角色正在执行其他操作，请稍后重试' },
        { status: 429 },
      )
    : undefined,
);
const ContextErrors = apiErrorFilter((error, config) => {
  console.error('获取转世上下文 API 错误:', error);
  return Response.json(
    {
      error:
        config.get('NODE_ENV') === 'development'
          ? error instanceof Error
            ? error.message
            : '获取转世上下文失败'
          : '获取转世上下文失败，请稍后再试',
    },
    { status: 500 },
  );
});
@Controller('api/cultivators')
@Access('user')
export class LifecycleController {
  constructor(
    @Inject(LifecycleService) private readonly lifecycle: LifecycleService,
  ) {}
  @Delete()
  @UseFilters(DeleteErrors)
  delete(@CurrentUser() user: AuthUser, @FirstQuery() query: { id?: string }) {
    return this.lifecycle.delete(user.id, query.id);
  }
  @Get('reincarnate-context')
  @UseFilters(ContextErrors)
  reincarnateContext(@CurrentUser() user: AuthUser) {
    return this.lifecycle.reincarnateContext(user.id);
  }
}
