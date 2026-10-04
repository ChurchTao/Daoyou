import { Controller, Get, Inject, Param, UseFilters } from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types.js';
import { Access, CurrentUser } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { EnemiesService } from './enemies.service.js';

const EnemyErrors = apiErrorFilter((error, config) => {
  console.error('获取敌人数据 API 错误:', error);
  return Response.json(
    {
      error:
        config.get('NODE_ENV') === 'development' && error instanceof Error
          ? error.message
          : '获取敌人数据失败，请稍后重试',
    },
    { status: 500 },
  );
});

@Controller('api/enemies')
@Access('user')
@UseFilters(EnemyErrors)
export class EnemiesController {
  constructor(
    @Inject(EnemiesService) private readonly enemies: EnemiesService,
  ) {}

  @Get(':id')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.enemies.read(user.id, id);
  }
}
