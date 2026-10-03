import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { TasksService } from './tasks.service.js';

const ListSchema = z.object({
  status: z.enum(['active', 'completed']).optional(),
});
const ListErrors = apiErrorFilter((error) => {
  if (error instanceof z.ZodError)
    return Response.json(
      { error: error.issues[0]?.message || '查询参数错误' },
      { status: 400 },
    );
  console.error('获取任务列表失败:', error);
  return Response.json(
    { error: '获取任务列表失败，请稍后再试' },
    { status: 500 },
  );
});
const DetailErrors = apiErrorFilter((error) => {
  console.error('获取任务详情失败:', error);
  return Response.json(
    { error: '获取任务详情失败，请稍后再试' },
    { status: 500 },
  );
});
const ChallengeErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  const message =
    error instanceof Error ? error.message : '试炼失败，请稍后再试';
  return Response.json(
    { error: message },
    {
      status:
        message === '任务不存在'
          ? 404
          : message.includes('没有可执行')
            ? 409
            : 400,
    },
  );
});
const ClaimErrors = apiErrorFilter((error) => {
  const message =
    error instanceof Error ? error.message : '领取奖励失败，请稍后再试';
  return Response.json(
    { error: message },
    {
      status:
        message === '任务不存在'
          ? 404
          : message.includes('尚未完成') || message.includes('已经领取')
            ? 409
            : 400,
    },
  );
});

@Controller('api/tasks')
@Access('active')
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}

  @Get()
  @UseFilters(ListErrors)
  list(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(ListSchema)) query: z.infer<typeof ListSchema>,
  ) {
    return this.tasks.list(actor, query.status);
  }

  @Get(':id')
  @UseFilters(DetailErrors)
  detail(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id') id: string,
  ) {
    return this.tasks.detail(actor, id);
  }

  @Post(':id/challenge')
  @HttpCode(200)
  @UseFilters(ChallengeErrors)
  challenge(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
  ) {
    return this.tasks.challenge(actor, id);
  }

  @Post(':id/claim-reward')
  @HttpCode(200)
  @UseFilters(ClaimErrors)
  claim(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id') id: string,
  ) {
    return this.tasks.claim(actor, id);
  }
}
