import type { CombatV6TrainingCommandRequestSchema } from '@daoyou/shared/contracts/combatV6';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import {
  executeDungeonCommand,
  readDungeonState,
} from '@server/dungeon/application/DungeonApplicationService.js';
import {
  changeDungeonBattle,
  getDungeonBattle,
} from '@server/dungeon/application/flow/combatV6.js';
import {
  checkDungeonLimit,
  getDungeonLimitConfig,
} from '@server/dungeon/application/flow/dungeonLimiter.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { dungeonHistories } from '@server/lib/drizzle/schema.js';
import { desc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { DungeonFlowService } from './application/flow/DungeonFlowService.js';

@Injectable()
export class DungeonService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(DungeonFlowService) private readonly flow: DungeonFlowService,
  ) {}

  execute(
    actor: ActiveCultivatorRef,
    command: Parameters<typeof executeDungeonCommand>[1]['command'],
  ) {
    return executeDungeonCommand(this.flow, {
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      command,
    });
  }

  async state(owner: string, runId?: string) {
    return { state: await readDungeonState(this.flow, owner, runId) };
  }

  async history(owner: string, pageQuery?: string, pageSizeQuery?: string) {
    const page = Math.max(1, parseInt(pageQuery || '1', 10));
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(pageSizeQuery || '10', 10)),
    );
    const offset = (page - 1) * pageSize;
    const countResult = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(dungeonHistories)
      .where(eq(dungeonHistories.cultivatorId, owner));
    const total = Number(countResult[0]?.count || 0);
    const records = await this.database
      .select({
        id: dungeonHistories.id,
        theme: dungeonHistories.theme,
        result: dungeonHistories.result,
        log: dungeonHistories.log,
        realGains: dungeonHistories.realGains,
        createdAt: dungeonHistories.createdAt,
      })
      .from(dungeonHistories)
      .where(eq(dungeonHistories.cultivatorId, owner))
      .orderBy(desc(dungeonHistories.createdAt))
      .limit(pageSize)
      .offset(offset);
    return {
      success: true,
      data: {
        records,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async limit(owner: string) {
    const limit = await checkDungeonLimit(owner);
    return {
      success: true,
      data: { ...limit, dailyLimit: getDungeonLimitConfig().dailyLimit },
    };
  }

  async current(owner: string) {
    return { success: true, data: await getDungeonBattle(owner) };
  }

  async read(owner: string, id: string, after: number) {
    const data = await getDungeonBattle(owner, id, after);
    if (!data) throw new HttpException({ error: '战斗不存在' }, 404);
    return { success: true, data };
  }

  async submit(
    actor: ActiveCultivatorRef,
    id: string,
    unitId: string,
    input: z.infer<typeof CombatV6TrainingCommandRequestSchema>,
  ) {
    return {
      success: true,
      data: await changeDungeonBattle(actor, id, input.expectedRevision, {
        unitId,
        commands: input.commands,
      }),
    };
  }

  async resolve(
    actor: ActiveCultivatorRef,
    id: string,
    revision: number,
    round?: number,
  ) {
    return {
      success: true,
      data: await changeDungeonBattle(actor, id, revision, undefined, round),
    };
  }
}
