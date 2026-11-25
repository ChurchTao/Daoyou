import {
  PartyChatSendSchema,
  PartyCommandSchema,
  type CurrentParty,
  type PartyChatSend,
  type PartyCommand,
} from '@daoyou/contracts/party';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Module,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { Access, CurrentCultivator } from '@server/auth/access.js';
import { apiErrorFilter } from '@server/http/error-filter.js';
import { JsonBody } from '@server/http/json-body.js';
import { ZodPipe } from '@server/http/zod.pipe.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { ChatError } from '@server/social/application/chatError.js';
import { z, ZodError } from 'zod';
import { listPartyChat, sendPartyChat } from './party-chat.js';
import {
  changeParty,
  createParty,
  joinParty,
  partyForUser,
  partyOwns,
} from './party.service.js';

@Controller('api/parties')
@Access('active')
@UseFilters(
  apiErrorFilter((error) =>
    error instanceof ZodError
      ? Response.json({ error: '组队指令无效' }, { status: 400 })
      : error instanceof ChatError
        ? Response.json(
            { success: false, error: error.message },
            { status: error.status },
          )
        : undefined,
  ),
)
class PartiesController {
  @Get(':partyId/chat')
  @Header('Cache-Control', 'private, no-store')
  async chat(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('partyId', new ZodPipe(z.uuid())) partyId: string,
  ) {
    return {
      success: true,
      data: { messages: await listPartyChat(actor, partyId) },
    };
  }

  @Post(':partyId/chat')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  async sendChat(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('partyId', new ZodPipe(z.uuid())) partyId: string,
    @JsonBody({ fallback: undefined }, new ZodPipe(PartyChatSendSchema))
    input: PartyChatSend,
  ) {
    return { success: true, data: await sendPartyChat(actor, partyId, input) };
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  async current(
    @CurrentCultivator() actor: ActiveCultivatorRef,
  ): Promise<CurrentParty> {
    const party = await partyForUser(actor.userId);
    return { party, roleMismatch: Boolean(party && !partyOwns(party, actor)) };
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async command(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(PartyCommandSchema))
    input: PartyCommand,
  ) {
    if (input.type === 'create') return { party: await createParty(actor) };
    if (input.type === 'join')
      return { party: await joinParty(actor, input.partyId) };
    const party = await changeParty(actor, input.partyId, input);
    return { party: input.type === 'leave' ? null : party };
  }
}

@Module({ controllers: [PartiesController] })
export class PartiesModule {}
