import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { IdentityReshapeServiceError } from '@server/reshape/application/IdentityReshapeService.js';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody, JsonBodyParseError } from '../http/json-body.js';
import { IdentityReshapeService } from './identity-reshape.service.js';
const IdentityErrors = apiErrorFilter((error) => {
  // These routes decoded JSON outside their legacy domain error handler.
  if (error instanceof JsonBodyParseError) return undefined;
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  return Response.json(
    {
      success: false,
      error: error instanceof Error ? error.message : '改天换地失败',
    },
    {
      status: error instanceof IdentityReshapeServiceError ? error.status : 400,
    },
  );
});
@Controller('api/identity-reshape')
@Access('active')
@UseFilters(IdentityErrors)
export class IdentityReshapeController {
  constructor(
    @Inject(IdentityReshapeService)
    private readonly identity: IdentityReshapeService,
  ) {}
  @Get('session')
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.identity.read(actor);
  }
  @Post('session')
  @HttpCode(200)
  start(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.identity.start(actor);
  }
  @Patch('session')
  draft(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody() input: unknown,
  ) {
    return this.identity.draft(actor, input);
  }
  @Post('generate')
  @HttpCode(200)
  generate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody() input: unknown,
  ) {
    return this.identity.generate(actor, input);
  }
  @Post('confirm')
  @HttpCode(200)
  confirm(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.identity.confirm(actor);
  }
  @Post('abandon')
  @HttpCode(200)
  abandon(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.identity.abandon(actor);
  }
}
