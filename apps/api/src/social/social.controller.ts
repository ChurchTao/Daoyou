import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef, AuthUser } from '@server/lib/auth/types.js';
import { z } from 'zod';
import { Access, CurrentCultivator, CurrentUser } from '../auth/access.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { socialErrors } from './social-errors.js';
import { SocialService } from './social.service.js';

@Controller('api/social')
@Access('user')
@UseFilters(socialErrors)
export class SocialController {
  constructor(@Inject(SocialService) private readonly social: SocialService) {}
  @Get('summary')
  @Header('Cache-Control', 'private, no-store')
  summary(@CurrentUser() user: AuthUser) {
    return this.social.summary(user.id);
  }
  @Get('blocks')
  @Header('Cache-Control', 'private, no-store')
  blocks(@CurrentUser() user: AuthUser) {
    return this.social.blocks(user.id);
  }
  @Post('blocks/:targetCultivatorId')
  @Access('active')
  @HttpCode(200)
  block(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(z.object({ targetCultivatorId: z.string().uuid() })))
    params: { targetCultivatorId: string },
  ) {
    return this.social.block(actor, params.targetCultivatorId);
  }
  @Delete('blocks/:blockId')
  unblock(
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(z.object({ blockId: z.string().uuid() })))
    params: { blockId: string },
  ) {
    return this.social.unblock(user.id, params.blockId);
  }
}
