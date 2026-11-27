import {
  EXORCISM_BOSS_IDS,
  type ExorcismBossId,
} from '@daoyou/game-domain/dungeon/exorcism';
import type { ResourceOperation } from '@daoyou/game-domain/resources';
import type { DbClient, DbTransaction } from '@server/lib/drizzle/db.js';
import { dungeonHistories, dungeonRuns } from '@server/lib/drizzle/schema.js';
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { mysteryHistorySnapshot } from '../mystery/mysteryHistory.js';
import type {
  DungeonBattlePayload,
  DungeonEncounterPayload,
} from './combatV6.js';
import { DungeonFlowError, DungeonFlowErrorCode } from './errors.js';
import type { DungeonSettlement, DungeonState } from './types.js';

const RUN_TERMINAL_STATUSES = new Set(['FINISHED']);
export type DungeonRunBattlePayload = DungeonBattlePayload | DungeonEncounterPayload;
function isActiveRunStatus(status: string | null | undefined) {
  return Boolean(status && !RUN_TERMINAL_STATUSES.has(status));
}

/** Durable run records own recovery and settlement. */
export class DungeonRunStore {
  constructor(private readonly database: DbClient) {}
  async loadActiveRun(cultivatorId: string) {
    const rows = await this.database
      .select()
      .from(dungeonRuns)
      .where(
        and(
          eq(dungeonRuns.cultivatorId, cultivatorId),
          isNull(dungeonRuns.endedAt),
        ),
      )
      .orderBy(desc(dungeonRuns.updatedAt))
      .limit(1);

    const row = rows[0];
    if (!row || !isActiveRunStatus(row.status)) return null;
    return row;
  }

  /** 最近几局除祟遇到的首领，用来给首领抽取降权。 */
  async recentExorcismBosses(cultivatorId: string, limit = 3) {
    const rows = await this.database
      .select({
        bossId: sql<
          string | null
        >`${dungeonRuns.runState}->'exorcism'->>'bossId'`,
      })
      .from(dungeonRuns)
      .where(
        and(
          eq(dungeonRuns.cultivatorId, cultivatorId),
          sql`${dungeonRuns.runState} ? 'exorcism'`,
        ),
      )
      .orderBy(desc(dungeonRuns.updatedAt))
      .limit(limit);
    return rows.flatMap((row) =>
      row.bossId &&
      (EXORCISM_BOSS_IDS as readonly string[]).includes(row.bossId)
        ? [row.bossId as ExorcismBossId]
        : [],
    );
  }

  async persistStateRecord(
    cultivatorId: string,
    state: DungeonState,
    battlePayload?: DungeonRunBattlePayload,
    tx?: DbTransaction,
  ) {
    const values = {
      cultivatorId,
      mapNodeId: state.mapNodeId,
      status: state.status,
      currentRound: state.currentRound,
      maxRounds: state.maxRounds,
      dangerScore: state.dangerScore,
      runState: state,
      costLedger: state.costLedger ?? [],
      gainLedger: state.gainLedger ?? [],
      pendingAction: state.pendingAction ?? null,
      activeBattleId: state.activeBattleId ?? null,
      battlePayload: battlePayload ?? null,
    };
    const q = tx ?? this.database;

    if (state.runId) {
      await q
        .update(dungeonRuns)
        .set(values)
        .where(eq(dungeonRuns.id, state.runId));
    } else {
      const inserted = await q
        .insert(dungeonRuns)
        .values(values)
        .returning({ id: dungeonRuns.id });
      state.runId = inserted[0]?.id;
      if (state.runId) {
        await q
          .update(dungeonRuns)
          .set({ runState: state })
          .where(eq(dungeonRuns.id, state.runId));
      }
    }
  }

  recordSettlementGain(
    tx: DbTransaction,
    runId: string,
    state: DungeonState,
    gainLedger: NonNullable<DungeonState['gainLedger']>,
    realGains: ResourceOperation[],
  ) {
    return tx
      .update(dungeonRuns)
      .set({
        runState: { ...state, gainLedger, realGains },
        gainLedger,
      })
      .where(eq(dungeonRuns.id, runId));
  }

  async assertTerminalRunCanCommit(tx: DbTransaction, state: DungeonState) {
    if (!state.runId) {
      return;
    }

    const claimed = await tx
      .update(dungeonRuns)
      .set({
        status: 'FINISHED',
        endedAt: new Date(),
      })
      .where(
        and(
          eq(dungeonRuns.id, state.runId),
          isNull(dungeonRuns.endedAt),
          ne(dungeonRuns.status, 'FINISHED'),
        ),
      )
      .returning({ id: dungeonRuns.id });

    if (claimed.length === 1) {
      return;
    }

    const [run] = await tx
      .select({ id: dungeonRuns.id })
      .from(dungeonRuns)
      .where(eq(dungeonRuns.id, state.runId))
      .limit(1);
    if (!run) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.NOT_FOUND,
        '副本已失效',
        404,
      );
    }

    throw new DungeonFlowError(
      DungeonFlowErrorCode.INVALID_STATE,
      '当前副本已完成，请刷新查看结算',
      409,
    );
  }

  async getState(cultivatorId: string, runId?: string) {
    const run = runId
      ? (
          await this.database
            .select()
            .from(dungeonRuns)
            .where(
              and(
                eq(dungeonRuns.id, runId),
                eq(dungeonRuns.cultivatorId, cultivatorId),
              ),
            )
            .limit(1)
        )[0]
      : await this.loadActiveRun(cultivatorId);
    let state: DungeonState | null;
    if (run) {
      state = run.runState as DungeonState;
      state.runId = run.id;
      state.status = run.status as DungeonState['status'];
      state.currentRound = run.currentRound;
      state.maxRounds = run.maxRounds;
      state.dangerScore = run.dangerScore;
      state.costLedger = (run.costLedger as DungeonState['costLedger']) ?? [];
      state.gainLedger = (run.gainLedger as DungeonState['gainLedger']) ?? [];
      state.pendingAction =
        (run.pendingAction as DungeonState['pendingAction']) ?? undefined;
      state.activeBattleId = run.activeBattleId ?? state.activeBattleId;
    } else {
      state = null;
    }
    if (!state) return null;
    return state;
  }

  async archiveDungeon(
    state: DungeonState,
    settlement: DungeonSettlement,
    realGains?: ResourceOperation[],
    options: { tx?: DbTransaction } = {},
  ) {
    const archive = async (tx: DbTransaction) => {
      if (!state.archiveHistoryCommittedAt) {
        const mystery = state.mystery
          ? mysteryHistorySnapshot(state.mystery)
          : undefined;
        await tx.insert(dungeonHistories).values({
          cultivatorId: state.cultivatorId,
          theme: state.theme,
          result: {
            ...settlement,
            runId: state.runId,
            ...(mystery ? { mystery } : {}),
            ...(state.exorcism
              ? {
                  exorcism: {
                    bossId: state.exorcism.bossId,
                    wins: state.exorcism.wins,
                    countered: state.exorcism.countered,
                    endReason: state.exorcism.endReason,
                    finalHpRatio: state.exorcism.finalHpRatio,
                    grade: state.exorcism.grade ?? null,
                  },
                }
              : {}),
          },
          log: mystery
            ? mystery.log
                .map(
                  (h) =>
                    `[行动 ${h.turn}] ${h.speaker ? `${h.speaker}：` : ''}${h.text}`,
                )
                .join('\n')
            : state.history
                .map(
                  (h) =>
                    `[Round ${h.round}] ${h.scene}${h.choice ? ` -> Choice: ${h.choice}` : ''}`,
                )
                .join('\n'),
          realGains: realGains ?? null,
        });
        state.archiveHistoryCommittedAt = new Date().toISOString();
      }

      if (state.runId) {
        await tx
          .update(dungeonRuns)
          .set({
            status: 'FINISHED',
            runState: state,
            costLedger: state.costLedger ?? [],
            gainLedger: state.gainLedger ?? [],
            pendingAction: null,
            activeBattleId: null,
            battlePayload: null,
            endedAt: new Date(),
          })
          .where(eq(dungeonRuns.id, state.runId));
      }
    };

    if (options.tx) {
      await archive(options.tx);
    } else {
      await this.database.transaction(archive);
    }
  }
}
