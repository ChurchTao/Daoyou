import {
  Controller,
  Delete,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import type { Request } from 'express';
import { Access } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { readRequestBody } from '../http/json-body.js';
import { DevToolsService } from './dev-tools.service.js';

const DevToolsErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  console.error('Dev tools API error:', error);
  return Response.json(
    { success: false, error: '服务器内部错误' },
    { status: 500 },
  );
});

@Controller('api/dev')
@Access('public')
@UseFilters(DevToolsErrors)
export class DevToolsController {
  constructor(
    @Inject(DevToolsService) private readonly service: DevToolsService,
  ) {}

  @Post('resources')
  @HttpCode(200)
  async grant(@Req() request: Request) {
    return this.service.grant(await readRequestBody(request));
  }

  @Delete('cultivators/:id/inventory/bag')
  clearBag(@Param('id') id: string) {
    return this.service.clearBag(id);
  }

  @Delete('cultivators/:id/divination')
  resetDivination(@Param('id') id: string) {
    return this.service.resetDivination(id);
  }

  @Patch('cultivators/:id')
  async patch(@Param('id') id: string, @Req() request: Request) {
    return this.service.patch(id, await readRequestBody(request));
  }
}
