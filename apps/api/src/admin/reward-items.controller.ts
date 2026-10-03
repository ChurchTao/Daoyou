import { Controller, HttpCode, Inject, Post, UseFilters } from '@nestjs/common';
import { AdminItemGenerationSchema } from '@daoyou/shared/contracts/adminItemGeneration';
import type { z } from 'zod';
import { Access } from '../auth/access.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AdminErrors } from './admin-errors.js';
import { AdminRewardItemsService } from './reward-items.service.js';

@Controller('api/admin/reward-items')
@Access('admin')
@UseFilters(AdminErrors)
export class AdminRewardItemsController {
  constructor(
    @Inject(AdminRewardItemsService)
    private readonly rewards: AdminRewardItemsService,
  ) {}

  @Post('generate')
  @HttpCode(200)
  generate(
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(AdminItemGenerationSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof AdminItemGenerationSchema>,
  ) {
    return this.rewards.generate(input);
  }
}
