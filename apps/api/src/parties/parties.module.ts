import {
  PartyChatSendSchema,
  PartyCommandSchema,
  PartyRecruitmentIntentSchema,
  PartyRecruitmentSourceSchema,
  type CurrentParty,
  type PartyChatSend,
  type PartyCommand,
  type PartyRecruitmentIntent,
} from '@daoyou/contracts/party';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Module,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { Access, CurrentCultivator } from '@server/auth/access.js';
import { apiErrorFilter } from '@server/http/error-filter.js';
import { FirstQuery } from '@server/http/first-query.js';
import { JsonBody } from '@server/http/json-body.js';
import { ZodPipe } from '@server/http/zod.pipe.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { PresenceModule } from '@server/presence/presence.module.js';
import { PresenceService } from '@server/presence/presence.service.js';
import { publishPartyChanges } from '@server/realtime/infrastructure/partyBroadcaster.js';
import { ChatError } from '@server/social/application/chatError.js';
import { z, ZodError } from 'zod';
import { listPartyRecruitments } from './party-admissions.js';
import {
  applyToParty,
  currentParty,
  expireApplicationsAfterPartyCreation,
  inspectPartyApplicant,
  inspectPartyMember,
  previewPartyApplication,
  readPartyVitals,
  reviewPartyApplication,
} from './party-applications.js';
import { listPartyChat, sendPartyChat } from './party-chat.js';
import {
  publishPartyRecruitment,
  stopPartyRecruitment,
} from './party-recruitments.js';
import { changeParty, createParty, partyForUser } from './party.service.js';

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
  constructor(
    @Inject(PresenceService) private readonly presence: PresenceService,
  ) {}

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
    return currentParty(actor);
  }

  @Get(':partyId/vitals')
  @Header('Cache-Control', 'private, no-store')
  vitals(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('partyId', new ZodPipe(z.uuid())) partyId: string,
  ) {
    return readPartyVitals(actor, partyId, this.presence);
  }

  @Get('recruitments')
  @Header('Cache-Control', 'private, no-store')
  async recruitments(
    @FirstQuery('kind', new ZodPipe(PartyRecruitmentIntentSchema.optional()))
    intent?: PartyRecruitmentIntent,
  ) {
    return { items: await listPartyRecruitments(intent) };
  }

  @Get(':partyId/preview')
  @Header('Cache-Control', 'private, no-store')
  preview(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('partyId', new ZodPipe(z.uuid())) partyId: string,
    @FirstQuery('kind') kind?: string,
    @FirstQuery('eventId') eventId?: string,
    @FirstQuery('week') week?: string,
    @FirstQuery('recruitmentId') recruitmentId?: string,
  ) {
    const source = PartyRecruitmentSourceSchema.parse(
      kind === 'hunt'
        ? { kind, eventId: eventId || null }
        : kind === 'invasion'
          ? { kind, week }
          : kind === 'public'
            ? { kind, recruitmentId }
            : { kind: kind ?? 'invite' },
    );
    return previewPartyApplication(actor, partyId, source);
  }

  @Get('applications/:id/cultivator')
  @Header('Cache-Control', 'private, no-store')
  inspect(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
  ) {
    return inspectPartyApplicant(actor, id);
  }

  @Get('members/:id/cultivator')
  @Header('Cache-Control', 'private, no-store')
  inspectMember(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
  ) {
    return inspectPartyMember(actor, id);
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async command(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(PartyCommandSchema))
    input: PartyCommand,
  ) {
    if (input.type === 'apply') {
      const outcome = await applyToParty(actor, input.partyId, input.source);
      return { ...(await currentParty(actor)), outcome };
    }
    if (
      input.type === 'approve' ||
      input.type === 'reject' ||
      input.type === 'cancel'
    ) {
      const outcome = await reviewPartyApplication(
        actor,
        input.applicationId,
        input.type,
      );
      return { ...(await currentParty(actor)), outcome };
    }
    if (input.type === 'create') {
      await createParty(actor);
      await expireApplicationsAfterPartyCreation(actor);
      publishPartyChanges([actor.userId]);
    } else if (input.type === 'recruit') {
      await publishPartyRecruitment(actor, input.partyId, input.intent);
    } else if (input.type === 'stop-recruiting') {
      await stopPartyRecruitment(actor, input.partyId);
    } else {
      const previous = await partyForUser(actor.userId);
      const next = await changeParty(actor, input.partyId, input);
      publishPartyChanges([
        actor.userId,
        ...(previous?.members.map(({ userId }) => userId) ?? []),
        ...(next?.members.map(({ userId }) => userId) ?? []),
      ]);
    }
    return currentParty(actor);
  }
}

@Module({
  imports: [PresenceModule],
  controllers: [PartiesController],
})
export class PartiesModule {}
