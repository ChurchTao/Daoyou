import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import { Access } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AdminErrors } from './admin-errors.js';
import { TowerQuerySchema, TowerRegenerateSchema } from './tower-input.js';
import { AdminTowerService } from './tower.service.js';

@Controller('api/admin/tower-enemy-sets')
@Access('admin')
@UseFilters(AdminErrors)
export class AdminTowerController {
  constructor(
    @Inject(AdminTowerService) private readonly tower: AdminTowerService,
  ) {}

  @Get()
  async read(
    @FirstQuery(new ZodPipe(TowerQuerySchema, 'legacy-unhandled'))
    query: z.infer<typeof TowerQuerySchema>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.tower.read(query);
    response.setHeader('Cache-Control', 'no-store');
    return result;
  }

  @Post('regenerate')
  @HttpCode(200)
  regenerate(
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(TowerRegenerateSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof TowerRegenerateSchema>,
  ) {
    return this.tower.regenerate(input);
  }
}
