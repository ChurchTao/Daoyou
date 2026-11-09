import {
  AdminDungeonGenerationSettingsSchema,
  AdminDungeonJobsQuerySchema,
  AdminDungeonRestockSchema,
  AdminDungeonScenarioListQuerySchema,
  AdminDungeonScenarioStatusSchema,
  AdminDungeonSlotsQuerySchema,
  AdminDungeonWarmupSchema,
} from '@daoyou/contracts/admin/dungeon-scenarios';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types.js';
import type { Response } from 'express';
import type { z } from 'zod';
import { Access, CurrentUser } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AdminErrors } from './admin-errors.js';
import { AdminDungeonScenariosService } from './dungeon-scenarios.service.js';

/** 云游剧本管理：仅管理员。 */
@Controller('api/admin/dungeon-scenarios')
@Access('admin')
@UseFilters(AdminErrors)
export class AdminDungeonScenariosController {
  constructor(
    @Inject(AdminDungeonScenariosService)
    private readonly scenarios: AdminDungeonScenariosService,
  ) {}

  @Get('generation-settings')
  async generationSettings(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return { success: true, data: await this.scenarios.generationSettings() };
  }

  @Put('generation-settings')
  async updateGenerationSettings(
    @CurrentUser() user: AuthUser,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(AdminDungeonGenerationSettingsSchema),
    )
    input: z.infer<typeof AdminDungeonGenerationSettingsSchema>,
  ) {
    return {
      success: true,
      data: await this.scenarios.updateGenerationSettings(
        user.id,
        input.enabled,
      ),
    };
  }

  @Get('slots')
  async slots(
    @FirstQuery(new ZodPipe(AdminDungeonSlotsQuerySchema))
    query: z.infer<typeof AdminDungeonSlotsQuerySchema>,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return { success: true, data: await this.scenarios.slots(query) };
  }

  @Get('jobs')
  async jobs(
    @FirstQuery(new ZodPipe(AdminDungeonJobsQuerySchema))
    query: z.infer<typeof AdminDungeonJobsQuerySchema>,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return { success: true, data: await this.scenarios.jobs(query) };
  }

  @Get()
  async list(
    @FirstQuery(new ZodPipe(AdminDungeonScenarioListQuerySchema))
    query: z.infer<typeof AdminDungeonScenarioListQuerySchema>,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return { success: true, data: await this.scenarios.list(query) };
  }

  @Get(':id')
  async detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return { success: true, data: await this.scenarios.detail(id) };
  }

  @Post(':id/status')
  @HttpCode(200)
  async setStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(AdminDungeonScenarioStatusSchema),
    )
    input: z.infer<typeof AdminDungeonScenarioStatusSchema>,
  ) {
    return {
      success: true,
      data: await this.scenarios.setStatus(id, input.status),
    };
  }

  @Post('restock')
  @HttpCode(200)
  async restock(
    @JsonBody({ fallback: undefined }, new ZodPipe(AdminDungeonRestockSchema))
    input: z.infer<typeof AdminDungeonRestockSchema>,
  ) {
    return { success: true, data: await this.scenarios.restock(input) };
  }

  @Post('warmup')
  @HttpCode(200)
  async warmup(
    @JsonBody({ fallback: undefined }, new ZodPipe(AdminDungeonWarmupSchema))
    input: z.infer<typeof AdminDungeonWarmupSchema>,
  ) {
    return { success: true, data: await this.scenarios.warmup(input) };
  }

  @Post('jobs/:id/retry')
  @HttpCode(200)
  async retry(@Param('id', new ParseUUIDPipe()) id: string) {
    return { success: true, data: await this.scenarios.retryJob(id) };
  }
}
