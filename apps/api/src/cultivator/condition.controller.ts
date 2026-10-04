import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { AttributeResetServiceError } from '@server/cultivator/application/AttributeResetService.js';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/cultivator/application/QiService.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody, JsonBodyParseError } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { ConditionService } from './condition.service.js';

const ConsumeSchema = z.object({
  consumableId: z.string().uuid(),
  revision: z.number().int().nonnegative().optional(),
  quantity: z.number().int().min(1).max(99).default(1),
});
const BreakthroughSchema = z.object({}).strict();

function qiErrorResponse(error: unknown) {
  if (error instanceof QiInsufficientError)
    return Response.json(
      {
        error: error.code,
        message: error.message,
        required: error.required,
        current: error.current,
        action: error.action,
      },
      { status: 409 },
    );
  if (error instanceof QiServiceError)
    return Response.json({ error: error.message }, { status: error.status });
}

const ConsumeErrors = apiErrorFilter((error) => {
  if (error instanceof JsonBodyParseError) return undefined;
  if (error instanceof z.ZodError)
    return Response.json(
      { success: false, error: '请求参数格式错误' },
      { status: 400 },
    );
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof AttributeResetServiceError)
    return Response.json({ error: error.message }, { status: error.status });
  return (
    qiErrorResponse(error) ??
    Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '使用失败',
      },
      { status: 400 },
    )
  );
});
const InnErrors = apiErrorFilter((error) => {
  if (error instanceof Error && error.message.startsWith('囊中羞涩，灵石不足'))
    return Response.json(
      { success: false, error: error.message },
      { status: 400 },
    );
});
const BreakthroughErrors = apiErrorFilter(
  (error) =>
    redisLockErrorResponse(error) ??
    Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '肉身进阶失败',
      },
      { status: 400 },
    ),
);
const MarrowWashErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  const qi = qiErrorResponse(error);
  if (qi) return qi;
  const message = error instanceof Error ? error.message : '洗髓破限失败';
  return Response.json(
    { success: false, error: message },
    { status: message === '角色不存在' ? 404 : 400 },
  );
});

@Controller('api/cultivator')
@Access('active')
export class ConditionController {
  constructor(
    @Inject(ConditionService) private readonly condition: ConditionService,
  ) {}

  @Post('consume')
  @HttpCode(200)
  @UseFilters(ConsumeErrors)
  consume(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(ConsumeSchema)) input: z.infer<typeof ConsumeSchema>,
  ) {
    return this.condition.consume(actor, input);
  }

  @Post('inn-recovery')
  @HttpCode(200)
  @UseFilters(InnErrors)
  recover(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.condition.recover(actor);
  }

  @Get('body-cultivation/breakthrough')
  readiness(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.condition.readiness(actor);
  }

  @Post('body-cultivation/breakthrough')
  @HttpCode(200)
  @UseFilters(BreakthroughErrors)
  breakthrough(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: {} }, new ZodPipe(BreakthroughSchema))
    _input: z.infer<typeof BreakthroughSchema>,
  ) {
    void _input;
    return this.condition.breakthrough(actor);
  }

  @Post('marrow-wash/breakthrough')
  @HttpCode(200)
  @UseFilters(MarrowWashErrors)
  marrowWash(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.condition.marrowWash(actor);
  }
}
