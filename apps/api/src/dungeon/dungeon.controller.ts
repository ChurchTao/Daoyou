import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  DungeonActionRequestSchema,
  DungeonFlowRequestSchema,
} from '@daoyou/contracts/combat/dungeon';
import {
  DungeonMysteryActRequestSchema,
  DungeonMysteryDeduceRequestSchema,
  DungeonMysteryTalkRequestSchema,
} from '@daoyou/contracts/dungeon/mystery';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import {
  DungeonActionErrors,
  DungeonContinueErrors,
  DungeonEscapeErrors,
  DungeonQuitErrors,
  DungeonRecoverErrors,
  DungeonStartErrors,
} from './dungeon-errors.js';
import { DungeonService } from './dungeon.service.js';

const StartSchema = z.object({ mapNodeId: z.string().min(1) });
const StateSchema = z.object({ runId: z.uuid().optional() }).strict();
const RecoverSchema = DungeonFlowRequestSchema.extend({
  action: z.enum([
    'retry',
    'retry_continue',
    'retry_settle',
    'safe_retreat',
    'force_quit',
  ]),
});

@Controller('api/dungeon')
@Access('active')
export class DungeonController {
  constructor(
    @Inject(DungeonService) private readonly dungeon: DungeonService,
  ) {}

  @Post('start')
  @HttpCode(200)
  @UseFilters(DungeonStartErrors)
  start(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(StartSchema)) input: z.infer<typeof StartSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'start', ...input });
  }

  @Get('state')
  state(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(StateSchema)) query: z.infer<typeof StateSchema>,
  ) {
    return this.dungeon.state(actor.cultivatorId, query.runId);
  }

  @Post('action')
  @HttpCode(200)
  @UseFilters(DungeonActionErrors)
  action(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DungeonActionRequestSchema))
    input: z.infer<typeof DungeonActionRequestSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'action', ...input });
  }

  @Post('mystery/act')
  @HttpCode(200)
  @UseFilters(DungeonActionErrors)
  mysteryAct(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DungeonMysteryActRequestSchema))
    input: z.infer<typeof DungeonMysteryActRequestSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'mystery-act', ...input });
  }

  @Post('mystery/talk')
  @HttpCode(200)
  @UseFilters(DungeonActionErrors)
  mysteryTalk(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DungeonMysteryTalkRequestSchema))
    input: z.infer<typeof DungeonMysteryTalkRequestSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'mystery-talk', ...input });
  }

  @Post('mystery/deduce')
  @HttpCode(200)
  @UseFilters(DungeonActionErrors)
  mysteryDeduce(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DungeonMysteryDeduceRequestSchema))
    input: z.infer<typeof DungeonMysteryDeduceRequestSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'mystery-deduce', ...input });
  }

    @Post('recover')
  @HttpCode(200)
  @UseFilters(DungeonRecoverErrors)
  recover(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(RecoverSchema)) input: z.infer<typeof RecoverSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'recover', ...input });
  }

  @Post('quit')
  @HttpCode(200)
  @UseFilters(DungeonQuitErrors)
  quit(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DungeonFlowRequestSchema))
    input: z.infer<typeof DungeonFlowRequestSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'quit', ...input });
  }

  @Get('history')
  history(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery('page') page?: string,
    @FirstQuery('pageSize') pageSize?: string,
  ) {
    return this.dungeon.history(actor.cultivatorId, page, pageSize);
  }

  @Post('looting/continue')
  @HttpCode(200)
  @UseFilters(DungeonContinueErrors)
  continue(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DungeonFlowRequestSchema))
    input: z.infer<typeof DungeonFlowRequestSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'looting-continue', ...input });
  }

  @Post('looting/escape')
  @HttpCode(200)
  @UseFilters(DungeonEscapeErrors)
  escape(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DungeonFlowRequestSchema))
    input: z.infer<typeof DungeonFlowRequestSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'looting-escape', ...input });
  }
}
