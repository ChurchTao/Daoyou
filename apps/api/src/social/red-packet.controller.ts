import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { Access, CurrentCultivator } from '../auth/access.js';
import { RedPacketService } from './application/RedPacketService.js';
import { SendErrors } from './world-chat.controller.js';

@Controller('api/world-chat/red-packets')
@Access('active')
@UseFilters(SendErrors)
export class RedPacketController {
  private readonly packets: RedPacketService;
  constructor(@Inject(DRIZZLE_DATABASE) database: DbClient) {
    this.packets = new RedPacketService(database);
  }

  @Get('refunds')
  async refunds(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return { success: true, data: await this.packets.listRefunds(actor) };
  }

  @Get(':id')
  async detail(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return { success: true, data: await this.packets.detail(actor, id) };
  }

  @Post(':id/claim')
  @HttpCode(200)
  claim(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.packets.claim(actor, id);
  }

  @Post(':id/refund')
  @HttpCode(200)
  refund(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.packets.claimRefund(actor, id);
  }
}
