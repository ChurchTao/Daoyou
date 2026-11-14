import { DungeonFlowRequestSchema } from '@daoyou/contracts/combat/dungeon';
import {
  DungeonMysteryActRequestSchema,
  DungeonMysteryDeduceRequestSchema,
  DungeonMysteryGuardRequestSchema,
  DungeonMysteryTalkRequestSchema,
} from '@daoyou/contracts/dungeon/mystery';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import {
  DungeonActionErrors,
  DungeonHistoryErrors,
  DungeonQuitErrors,
  DungeonRecoverErrors,
  DungeonStartErrors,
} from './dungeon-errors.js';
import { DungeonService } from './dungeon.service.js';
import { StoryGate } from '../story/story-gate.guard.js';

const StartSchema = z.object({
  mapNodeId: z.string().min(1),
  mode: z.enum(['mystery', 'exorcism']).optional(),
});
const ExorcismSupplySchema = DungeonFlowRequestSchema.extend({
  choice: z.enum(['rest', 'search']),
});
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
@StoryGate('dungeon')
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

  @Post('mystery/guard')
  @HttpCode(200)
  @UseFilters(DungeonActionErrors)
  mysteryGuard(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DungeonMysteryGuardRequestSchema))
    input: z.infer<typeof DungeonMysteryGuardRequestSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'mystery-guard', ...input });
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

  @Post('exorcism/supply')
  @HttpCode(200)
  @UseFilters(DungeonActionErrors)
  exorcismSupply(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(ExorcismSupplySchema))
    input: z.infer<typeof ExorcismSupplySchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'exorcism-supply', ...input });
  }

  @Post('exorcism/retreat')
  @HttpCode(200)
  @UseFilters(DungeonActionErrors)
  exorcismRetreat(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DungeonFlowRequestSchema))
    input: z.infer<typeof DungeonFlowRequestSchema>,
  ) {
    return this.dungeon.execute(actor, { kind: 'exorcism-retreat', ...input });
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
  @Header('Cache-Control', 'private, no-store')
  history(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery('page') page?: string,
    @FirstQuery('pageSize') pageSize?: string,
  ) {
    return this.dungeon.history(actor.cultivatorId, page, pageSize);
  }

  @Get('history/:id')
  @Header('Cache-Control', 'private, no-store')
  @UseFilters(DungeonHistoryErrors)
  historyDetail(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('id', new ZodPipe(z.uuid())) id: string,
  ) {
    return this.dungeon.historyDetail(actor.cultivatorId, id);
  }
}
