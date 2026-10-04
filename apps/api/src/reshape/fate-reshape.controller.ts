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
import { FateReshapeServiceError } from '@server/reshape/application/FateReshapeService.js';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { FateReshapeService } from './fate-reshape.service.js';
function fateErrors(fallback: string, lockAware = false) {
  return apiErrorFilter((error) => {
    if (lockAware) {
      const lock = redisLockErrorResponse(error);
      if (lock) return lock;
    }
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : fallback,
      },
      { status: error instanceof FateReshapeServiceError ? error.status : 400 },
    );
  });
}
const ReadErrors = apiErrorFilter((error) =>
  Response.json(
    {
      success: false,
      error: error instanceof Error ? error.message : '获取命格重塑状态失败',
    },
    { status: 400 },
  ),
);
@Controller('api/fate-reshape')
@Access('active')
export class FateReshapeController {
  constructor(
    @Inject(FateReshapeService) private readonly fate: FateReshapeService,
  ) {}
  @Get('session')
  @UseFilters(ReadErrors)
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.fate.read(actor);
  }
  @Post('session')
  @HttpCode(200)
  @UseFilters(fateErrors('开启命格重塑失败', true))
  start(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.fate.start(actor);
  }
  @Post('reroll')
  @HttpCode(200)
  @UseFilters(fateErrors('命格重抽失败'))
  reroll(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.fate.reroll(actor);
  }
  @Post('confirm')
  @HttpCode(200)
  @UseFilters(fateErrors('确认命格重塑失败', true))
  confirm(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody() input: unknown,
  ) {
    return this.fate.confirm(actor, input);
  }
  @Post('abandon')
  @HttpCode(200)
  @UseFilters(fateErrors('放弃命格重塑失败'))
  abandon(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.fate.abandon(actor);
  }
}
