import type { ResourceOperation } from '@daoyou/game-domain/resources';
import type { DbClient, DbTransaction } from '@server/lib/drizzle/db.js';
import { dungeonHistories, dungeonRuns } from '@server/lib/drizzle/schema.js';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type {
  DungeonBattlePayload,
  DungeonEncounterPayload,
} from './combatV6.js';
import { DungeonFlowError, DungeonFlowErrorCode } from './errors.js';
import type { DungeonSettlement, DungeonState } from './types.js';

const REDIS_TTL = 3600;
const RUN_TERMINAL_STATUSES = new Set(['FINISHED']);
type DungeonBattleCachePayload = DungeonBattlePayload | DungeonEncounterPayload;
function getDungeonKey(cultivatorId: string) {
  return `dungeon:active:${cultivatorId}`;
}
function isActiveRunStatus(status: string | null | undefined) {
  return Boolean(status && !RUN_TERMINAL_STATUSES.has(status));
}

/** Durable run records own recovery; Redis caches only committed flow state. */
export class DungeonRunStore {
  constructor(
    private readonly database: DbClient,
    private readonly cache: Pick<Redis, 'set' | 'del'>,
  ) {}
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

  async persistStateRecord(
    cultivatorId: string,
    state: DungeonState,
    battlePayload?: DungeonBattleCachePayload,
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

  async saveRedisState(cultivatorId: string, state: DungeonState) {
    await this.cache.set(
      getDungeonKey(cultivatorId),
      JSON.stringify(state),
      'EX',
      REDIS_TTL,
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
    options: { tx?: DbTransaction; clearRedis?: boolean } = {},
  ) {
    const archive = async (tx: DbTransaction) => {
      if (!state.archiveHistoryCommittedAt) {
        await tx.insert(dungeonHistories).values({
          cultivatorId: state.cultivatorId,
          theme: state.theme,
          result: settlement,
          log: state.history
            .map((h) => `[Round ${h.round}] ${h.scene} -> Choice: ${h.choice}`)
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

    if (options.clearRedis !== false) {
      await this.clearRedisState(state.cultivatorId);
    }
  }

  clearRedisState(cultivatorId: string) {
    return this.cache.del(getDungeonKey(cultivatorId));
  }
}
