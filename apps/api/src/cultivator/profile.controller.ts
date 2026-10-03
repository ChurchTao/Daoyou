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
import { RedeemClaimError } from '@server/admin/application/RedeemCodeApplicationService.js';
import {
  AttributeAllocationSchema,
  type AttributeAllocationRequest,
} from '@daoyou/shared/contracts/characterAttributes';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody, JsonBodyParseError } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { ProfileService } from './profile.service.js';

const TitleSchema = z.object({
  title: z.string().min(2).max(8).optional().nullable(),
});
const RedeemSchema = z.object({ code: z.string().trim().min(1).max(64) });
const AllocateErrors = apiErrorFilter((error) => {
  if (error instanceof JsonBodyParseError) return undefined;
  if (error instanceof z.ZodError)
    return Response.json(
      { error: '参数错误', details: error.flatten() },
      { status: 400 },
    );
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  const message = error instanceof Error ? error.message : '属性分配失败';
  if (
    [
      '角色不存在',
      '未分配属性点不足',
      '属性不能低于基础值',
      '属性总点数超过当前境界预算',
    ].includes(message)
  )
    return Response.json(
      { error: message },
      { status: message === '角色不存在' ? 404 : 400 },
    );
});
const ResetErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof AttributeResetServiceError)
    return Response.json({ error: error.message }, { status: error.status });
});
const RedeemErrors = apiErrorFilter((error) => {
  if (error instanceof JsonBodyParseError) return undefined;
  if (error instanceof z.ZodError)
    return Response.json(
      { error: '参数错误', details: error.flatten() },
      { status: 400 },
    );
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === '23505'
  )
    return Response.json({ error: '该兑换码你已使用过' }, { status: 400 });
  if (error instanceof RedeemClaimError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error('Redeem claim error:', error);
  return Response.json({ error: '兑换失败，请稍后重试' }, { status: 500 });
});

@Controller('api/cultivator')
@Access('active')
export class ProfileController {
  constructor(
    @Inject(ProfileService) private readonly profile: ProfileService,
  ) {}

  @Post('active-reincarnate')
  @HttpCode(200)
  reincarnate(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.profile.reincarnate(actor);
  }


  @Get('qi/logs')
  qiLogs(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery('page') page?: string,
    @FirstQuery('pageSize') pageSize?: string,
  ) {
    return this.profile.qiLogs(actor.cultivatorId, page, pageSize);
  }

  @Post('title')
  @HttpCode(200)
  title(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(TitleSchema)) input: z.infer<typeof TitleSchema>,
  ) {
    return this.profile.title(actor, input.title);
  }

  @Post('attributes/preview')
  @HttpCode(200)
  preview(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(AttributeAllocationSchema))
    input: AttributeAllocationRequest,
  ) {
    return this.profile.preview(actor, input);
  }

  @Post('attributes/allocate')
  @HttpCode(200)
  @UseFilters(AllocateErrors)
  allocate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(AttributeAllocationSchema))
    input: AttributeAllocationRequest,
  ) {
    return this.profile.allocate(actor, input);
  }

  @Post('attributes/reset')
  @HttpCode(200)
  @UseFilters(ResetErrors)
  reset(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.profile.reset(actor);
  }

  @Post('redeem-code/claim')
  @HttpCode(200)
  @UseFilters(RedeemErrors)
  redeem(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(RedeemSchema)) input: z.infer<typeof RedeemSchema>,
  ) {
    return this.profile.redeem(actor, input.code);
  }
}
