import type { CombatV6TrainingCommandRequestSchema } from '@daoyou/contracts/combat';
import type {
  DungeonHistoryDetail,
  DungeonHistoryPage,
} from '@daoyou/contracts/dungeon/history';
import type {
  DungeonHistoryResult,
  DungeonState,
} from '@daoyou/game-domain/dungeon';
import type { ResourceOperation } from '@daoyou/game-domain/resources';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import {
  changeDungeonBattle,
  getDungeonBattle,
} from '@server/dungeon/application/flow/combatV6.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { dungeonHistories, dungeonRuns } from '@server/lib/drizzle/schema.js';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { DungeonApplicationService } from './application/DungeonApplicationService.js';
import { mysteryHistorySnapshot } from './application/mystery/mysteryHistory.js';

@Injectable()
export class DungeonService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(DungeonApplicationService)
    private readonly application: DungeonApplicationService,
  ) {}

  execute(
    actor: ActiveCultivatorRef,
    command: Parameters<
      DungeonApplicationService['executeDungeonCommand']
    >[0]['command'],
  ) {
    return this.application.executeDungeonCommand({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      command,
    });
  }

  async state(owner: string, runId?: string) {
    return { state: await this.application.readDungeonState(owner, runId) };
  }

  async history(owner: string, pageQuery?: string, pageSizeQuery?: string) {
    const page = Math.min(
      10000,
      Math.max(1, parseInt(pageQuery || '1', 10) || 1),
    );
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(pageSizeQuery || '10', 10) || 10),
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
        createdAt: dungeonHistories.createdAt,
      })
      .from(dungeonHistories)
      .where(eq(dungeonHistories.cultivatorId, owner))
      .orderBy(desc(dungeonHistories.createdAt), desc(dungeonHistories.id))
      .limit(pageSize)
      .offset(offset);
    const data: DungeonHistoryPage = {
      records: records.map((record) => {
        const result = record.result as DungeonHistoryResult;
        return {
          id: record.id,
          theme: record.theme,
          title: result.mystery?.title ?? record.theme,
          rewardTier: result.settlement?.reward_tier ?? null,
          score: result.mystery?.result?.total ?? null,
          createdAt: record.createdAt.toISOString(),
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
    return { success: true, data };
  }

  async historyDetail(owner: string, id: string) {
    const [record] = await this.database
      .select()
      .from(dungeonHistories)
      .where(
        and(
          eq(dungeonHistories.id, id),
          eq(dungeonHistories.cultivatorId, owner),
        ),
      )
      .limit(1);
    if (!record)
      throw new HttpException({ error: '探险记录不存在或已过期' }, 404);
    const result = record.result as DungeonHistoryResult;
    // 旧归档未留调查快照；仅从本人的、结算内容完全一致的唯一已结束副本恢复。
    if (!result.mystery) {
      const runs = await this.database
        .select({ state: dungeonRuns.runState })
        .from(dungeonRuns)
        .where(
          and(
            eq(dungeonRuns.cultivatorId, owner),
            eq(dungeonRuns.status, 'FINISHED'),
            isNotNull(dungeonRuns.endedAt),
            sql`${dungeonRuns.runState}->>'theme' = ${record.theme}`,
            ...(result.runId
              ? [eq(dungeonRuns.id, result.runId)]
              : [
                  sql`${dungeonRuns.runState}->'settlement' = ${JSON.stringify(record.result)}::jsonb`,
                ]),
          ),
        )
        .limit(2);
      if (runs.length === 1) {
        const state = runs[0]!.state as DungeonState;
        if (state.mystery)
          result.mystery = mysteryHistorySnapshot(state.mystery);
      }
    }
    const data: DungeonHistoryDetail = {
      id: record.id,
      theme: record.theme,
      result,
      log: record.log,
      realGains: record.realGains as ResourceOperation[] | null,
      createdAt: record.createdAt.toISOString(),
    };
    return { success: true, data };
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
