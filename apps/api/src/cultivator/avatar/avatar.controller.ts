import {
  CreateAvatarSchema,
  EquipAvatarSchema,
  type CreateAvatarInput,
} from '@daoyou/contracts/player/avatar';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { minutes, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { InventoryError } from '@server/inventory/operations.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { PlayerCommandIdempotencyError } from '@server/player/application/state/CommandExecutors.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import { z, ZodError } from 'zod';
import { Access, CurrentCultivator } from '../../auth/access.js';
import { apiErrorFilter } from '../../http/error-filter.js';
import { FirstQuery } from '../../http/first-query.js';
import { JsonBody } from '../../http/json-body.js';
import { ZodPipe } from '../../http/zod.pipe.js';
import { AvatarService } from './avatar.service.js';

const AvatarErrors = apiErrorFilter((error) => {
  if (error instanceof ZodError) {
    return Response.json(
      {
        success: false,
        error: error.issues[0]?.message ?? '头像请求无效',
      },
      { status: 400 },
    );
  }
  if (
    error instanceof InventoryError ||
    error instanceof PlayerCommandIdempotencyError
  ) {
    return Response.json(
      { success: false, error: error.message },
      { status: 409 },
    );
  }
});

@Controller('api/cultivator/avatars')
@Access('active')
@UseFilters(AvatarErrors)
export class AvatarController {
  constructor(@Inject(AvatarService) private readonly avatars: AvatarService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async collection(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery('before', new ZodPipe(z.uuid().optional())) before?: string,
  ) {
    return {
      success: true,
      data: await this.avatars.collection(actor, before),
    };
  }

  @Post()
  @HttpCode(202)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  async create(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(CreateAvatarSchema))
    input: CreateAvatarInput,
  ) {
    return toPlayerStateMutationResponse(
      await this.avatars.create(actor, input),
    );
  }

  @Put('active')
  async equip(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(EquipAvatarSchema))
    input: z.infer<typeof EquipAvatarSchema>,
  ) {
    return toPlayerStateMutationResponse(
      await this.avatars.equip(actor, input.avatarId),
    );
  }
}
