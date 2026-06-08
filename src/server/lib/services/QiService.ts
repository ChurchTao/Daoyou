import {
  QI_ACTION_COSTS,
  QI_DAILY_RESTORE_ITEM_LIMIT,
  QI_MAX,
  QI_OVERFLOW_MAX,
  QI_REFRESH_TIMEZONE,
  type QiAction,
} from '@shared/config/qiSystem';
import type { QiLogEntry, QiLogsResponse, QiState } from '@shared/contracts/qi';
import type {
  QiLogMetadata,
  QiLogStatus,
  QiReservationResult,
  QiRestoreResult,
  QiRestoreSource,
} from '@shared/types/qi';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getExecutor, type DbTransaction } from '../drizzle/db';
import { cultivators, qiLogs } from '../drizzle/schema';

const RESTORE_STATUS: QiLogStatus = 'restore_committed';

function isQiEnabled() {
  return process.env.QI_SYSTEM_ENABLED !== 'false';
}

function getDateInTimezone(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: QI_REFRESH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function shouldRefresh(lastRefreshedAt: Date | null, now = new Date()) {
  if (!lastRefreshedAt) return true;
  return getDateInTimezone(lastRefreshedAt) !== getDateInTimezone(now);
}

function normalizeMetadata(metadata?: QiLogMetadata): QiLogMetadata {
  return metadata && typeof metadata === 'object' ? metadata : {};
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

export class QiInsufficientError extends Error {
  readonly code = 'QI_INSUFFICIENT';
  readonly action: QiAction;
  readonly required: number;
  readonly current: number;

  constructor(args: { action: QiAction; required: number; current: number }) {
    super('天地灵气不足');
    this.action = args.action;
    this.required = args.required;
    this.current = args.current;
  }
}

export class QiServiceError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export class QiService {
  private static async refreshLockedCultivator(
    tx: DbTransaction,
    cultivatorId: string,
  ) {
    const [row] = await tx
      .select({
        id: cultivators.id,
        qi: cultivators.qi,
        qiLastRefreshedAt: cultivators.qiLastRefreshedAt,
      })
      .from(cultivators)
      .where(eq(cultivators.id, cultivatorId))
      .for('update')
      .limit(1);

    if (!row) {
      throw new QiServiceError('角色不存在', 404);
    }

    const now = new Date();
    const refreshed = shouldRefresh(row.qiLastRefreshedAt, now);
    const qi = refreshed && row.qi < QI_MAX ? QI_MAX : row.qi;
    const qiLastRefreshedAt = refreshed ? now : row.qiLastRefreshedAt;

    if (refreshed) {
      await tx
        .update(cultivators)
        .set({
          qi,
          qiLastRefreshedAt,
        })
        .where(eq(cultivators.id, cultivatorId));
    }

    return {
      qi,
      qiLastRefreshedAt,
    };
  }

  static getCost(action: QiAction): number {
    return QI_ACTION_COSTS[action];
  }

  static async getQiState(cultivatorId: string): Promise<QiState> {
    const [row] = await getExecutor()
      .select({
        qi: cultivators.qi,
        qiLastRefreshedAt: cultivators.qiLastRefreshedAt,
      })
      .from(cultivators)
      .where(eq(cultivators.id, cultivatorId))
      .limit(1);

    if (!row) {
      throw new QiServiceError('角色不存在', 404);
    }

    const current =
      shouldRefresh(row.qiLastRefreshedAt) && row.qi < QI_MAX
        ? QI_MAX
        : row.qi;

    return {
      current,
      max: QI_MAX,
    };
  }

  private static async getRawQi(cultivatorId: string): Promise<number> {
    const [row] = await getExecutor()
      .select({ qi: cultivators.qi })
      .from(cultivators)
      .where(eq(cultivators.id, cultivatorId))
      .limit(1);

    if (!row) {
      throw new QiServiceError('角色不存在', 404);
    }

    return row.qi;
  }

  static async listLogs(
    cultivatorId: string,
    options: { page?: number; pageSize?: number } = {},
  ): Promise<QiLogsResponse> {
    const page = normalizePositiveInteger(options.page, 1);
    const pageSize = Math.min(
      100,
      normalizePositiveInteger(options.pageSize, 20),
    );
    const offset = (page - 1) * pageSize;
    const q = getExecutor();

    const [totalRow] = await q
      .select({ total: sql<number>`COUNT(*)` })
      .from(qiLogs)
      .where(eq(qiLogs.cultivatorId, cultivatorId));

    const rows = await q
      .select()
      .from(qiLogs)
      .where(eq(qiLogs.cultivatorId, cultivatorId))
      .orderBy(desc(qiLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    const total = Number(totalRow?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      logs: rows.map((row) => ({
        id: row.id,
        action: row.action,
        actionInstanceId: row.actionInstanceId,
        status: row.status as QiLogStatus,
        qiCost: row.qiCost,
        qiGain: row.qiGain,
        qiBefore: row.qiBefore,
        qiAfter: row.qiAfter,
        source: row.source,
        metadata: normalizeMetadata(row.metadata as QiLogMetadata),
        createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
        updatedAt: row.updatedAt?.toISOString() ?? new Date(0).toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  static async reserveQi(input: {
    cultivatorId: string;
    action: QiAction;
    actionInstanceId: string;
    cost?: number;
    metadata?: QiLogMetadata;
  }): Promise<QiReservationResult> {
    const cost = input.cost ?? this.getCost(input.action);

    if (!isQiEnabled()) {
      const current = await this.getRawQi(input.cultivatorId);
      return {
        success: true,
        action: input.action,
        actionInstanceId: input.actionInstanceId,
        qiBefore: current,
        qiAfter: current,
        consumed: 0,
      };
    }

    return getExecutor().transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(qiLogs)
        .where(eq(qiLogs.actionInstanceId, input.actionInstanceId))
        .for('update')
        .limit(1);

      if (existing) {
        if (
          existing.status === 'reserved' ||
          existing.status === 'committed' ||
          existing.status === 'failed_no_refund'
        ) {
          return {
            success: true,
            action: input.action,
            actionInstanceId: input.actionInstanceId,
            qiBefore: existing.qiBefore,
            qiAfter: existing.qiAfter,
            consumed: existing.qiCost,
          };
        }
        throw new QiServiceError('该灵气预扣已退款，不能重复使用。', 409);
      }

      const row = await this.refreshLockedCultivator(tx, input.cultivatorId);
      if (row.qi < cost) {
        throw new QiInsufficientError({
          action: input.action,
          required: cost,
          current: row.qi,
        });
      }

      const qiAfter = row.qi - cost;
      await tx
        .update(cultivators)
        .set({ qi: qiAfter })
        .where(eq(cultivators.id, input.cultivatorId));

      await tx.insert(qiLogs).values({
        cultivatorId: input.cultivatorId,
        action: input.action,
        actionInstanceId: input.actionInstanceId,
        status: 'reserved',
        qiCost: cost,
        qiGain: 0,
        qiBefore: row.qi,
        qiAfter,
        metadata: normalizeMetadata(input.metadata),
      });

      return {
        success: true,
        action: input.action,
        actionInstanceId: input.actionInstanceId,
        qiBefore: row.qi,
        qiAfter,
        consumed: cost,
      };
    });
  }

  static async commitReservation(input: {
    actionInstanceId: string;
    metadata?: QiLogMetadata;
  }): Promise<void> {
    if (!isQiEnabled()) return;

    await getExecutor().transaction(async (tx) => {
      const log = await this.lockReservation(tx, input.actionInstanceId);
      if (log.status === 'committed') return;
      if (log.status !== 'reserved') {
        throw new QiServiceError('只有预扣中的灵气日志可以提交。', 409);
      }

      await tx
        .update(qiLogs)
        .set({
          status: 'committed',
          metadata: {
            ...normalizeMetadata(log.metadata as QiLogMetadata),
            ...normalizeMetadata(input.metadata),
          },
          updatedAt: new Date(),
        })
        .where(eq(qiLogs.id, log.id));
    });
  }

  static async markNoRefund(input: {
    actionInstanceId: string;
    reason: string;
    metadata?: QiLogMetadata;
  }): Promise<void> {
    if (!isQiEnabled()) return;

    await getExecutor().transaction(async (tx) => {
      const log = await this.lockReservation(tx, input.actionInstanceId);
      if (log.status === 'failed_no_refund') return;
      if (log.status !== 'reserved') {
        throw new QiServiceError('只有预扣中的灵气日志可以标记为不退款。', 409);
      }

      await tx
        .update(qiLogs)
        .set({
          status: 'failed_no_refund',
          metadata: {
            ...normalizeMetadata(log.metadata as QiLogMetadata),
            ...normalizeMetadata(input.metadata),
            noRefundReason: input.reason,
          },
          updatedAt: new Date(),
        })
        .where(eq(qiLogs.id, log.id));
    });
  }

  static async refundReservation(input: {
    actionInstanceId: string;
    reason: string;
    metadata?: QiLogMetadata;
  }): Promise<void> {
    if (!isQiEnabled()) return;

    await getExecutor().transaction(async (tx) => {
      const log = await this.lockReservation(tx, input.actionInstanceId);
      if (log.status === 'refunded') return;
      if (log.status !== 'reserved') {
        throw new QiServiceError('只有预扣中的灵气日志可以退款。', 409);
      }

      const row = await this.refreshLockedCultivator(tx, log.cultivatorId);
      const qiAfter = row.qi + log.qiCost;
      await tx
        .update(cultivators)
        .set({ qi: qiAfter })
        .where(eq(cultivators.id, log.cultivatorId));

      await tx
        .update(qiLogs)
        .set({
          status: 'refunded',
          qiGain: log.qiCost,
          qiAfter,
          metadata: {
            ...normalizeMetadata(log.metadata as QiLogMetadata),
            ...normalizeMetadata(input.metadata),
            refundReason: input.reason,
          },
          updatedAt: new Date(),
        })
        .where(eq(qiLogs.id, log.id));
    });
  }

  static async restoreQi(input: {
    cultivatorId: string;
    amount: number | 'fill_to_max';
    source: QiRestoreSource;
    actionInstanceId: string;
    action?: string;
    metadata?: QiLogMetadata;
    tx?: DbTransaction;
  }): Promise<QiRestoreResult> {
    if (!isQiEnabled()) {
      throw new QiServiceError('天地灵气系统维护中，暂不可使用恢复符箓。', 503);
    }

    const run = async (tx: DbTransaction) => {
      const [existing] = await tx
        .select()
        .from(qiLogs)
        .where(eq(qiLogs.actionInstanceId, input.actionInstanceId))
        .for('update')
        .limit(1);

      if (existing) {
        return {
          success: true,
          qiBefore: existing.qiBefore,
          qiAfter: existing.qiAfter,
          restored: existing.qiGain,
          overflowMax: QI_OVERFLOW_MAX,
        };
      }

      if (input.source === 'talisman') {
        const today = getDateInTimezone();
        const [usesRow] = await tx
          .select({ uses: sql<number>`COUNT(*)` })
          .from(qiLogs)
          .where(
            and(
              eq(qiLogs.cultivatorId, input.cultivatorId),
              eq(qiLogs.status, RESTORE_STATUS),
              eq(qiLogs.source, 'talisman'),
              sql`DATE(${qiLogs.createdAt} AT TIME ZONE ${QI_REFRESH_TIMEZONE}) = ${today}::date`,
            ),
          );
        if (Number(usesRow?.uses ?? 0) >= QI_DAILY_RESTORE_ITEM_LIMIT) {
          throw new QiServiceError('今日聚灵符使用次数已达上限。', 409);
        }
      }

      const row = await this.refreshLockedCultivator(tx, input.cultivatorId);
      if (row.qi >= QI_OVERFLOW_MAX) {
        throw new QiServiceError('天地灵气已达溢出上限，暂不可继续补充。', 409);
      }

      const rawAmount =
        input.amount === 'fill_to_max'
          ? Math.max(0, QI_MAX - row.qi)
          : Math.floor(input.amount);
      const restored = Math.max(
        0,
        Math.min(rawAmount, QI_OVERFLOW_MAX - row.qi),
      );
      if (restored <= 0) {
        throw new QiServiceError('没有可恢复的天地灵气。', 409);
      }

      const qiAfter = row.qi + restored;
      await tx
        .update(cultivators)
        .set({ qi: qiAfter })
        .where(eq(cultivators.id, input.cultivatorId));

      await tx.insert(qiLogs).values({
        cultivatorId: input.cultivatorId,
        action: input.action ?? 'qi_restore',
        actionInstanceId: input.actionInstanceId,
        status: RESTORE_STATUS,
        qiCost: 0,
        qiGain: restored,
        qiBefore: row.qi,
        qiAfter,
        source: input.source,
        metadata: normalizeMetadata(input.metadata),
      });

      return {
        success: true,
        qiBefore: row.qi,
        qiAfter,
        restored,
        overflowMax: QI_OVERFLOW_MAX,
      };
    };

    if (input.tx) {
      return run(input.tx);
    }
    return getExecutor().transaction(run);
  }

  private static async lockReservation(
    tx: DbTransaction,
    actionInstanceId: string,
  ) {
    const [log] = await tx
      .select()
      .from(qiLogs)
      .where(eq(qiLogs.actionInstanceId, actionInstanceId))
      .for('update')
      .limit(1);

    if (!log) {
      throw new QiServiceError('未找到灵气预扣日志。', 404);
    }

    return log;
  }
}
