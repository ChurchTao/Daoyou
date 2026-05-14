import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import type {
  FateReshapeSessionDTO,
  FateReshapeSessionStore,
} from '@shared/types/fateReshape';
import type { PreHeavenFate } from '@shared/types/cultivator';
import { and, eq, or } from 'drizzle-orm';
import { getExecutor } from '../drizzle/db';
import * as schema from '../drizzle/schema';
import { FateEngine } from './FateEngine';
import {
  consumeConsumableById,
  getCultivatorById,
  getCultivatorByIdUnsafe,
  replacePreHeavenFates,
} from './cultivatorService';

const FATE_RESHAPE_SESSION_TTL_SEC = 3600;
const FATE_RESHAPE_TALISMAN_NAME = '天机逆命符';
const FATE_RESHAPE_MECHANIC_KEY = 'fate_reshape_access';

type ConsumableRow = typeof schema.consumables.$inferSelect;

function buildSessionKey(cultivatorId: string): string {
  return `fate-reshape-session:${cultivatorId}`;
}

function buildLockKey(cultivatorId: string): string {
  return `fate-reshape-lock:${cultivatorId}`;
}

function getRemainingTtlSeconds(expiresAt: number): number {
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
}

function toSessionDto(session: FateReshapeSessionStore): FateReshapeSessionDTO {
  return {
    sessionId: session.sessionId,
    originalFates: session.originalFates,
    currentCandidates: session.currentCandidates,
    rerollUsed: session.rerollUsed,
    canReroll: !session.rerollUsed,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

function validateSelectedIndices(
  selectedIndices: number[],
  candidateCount: number,
): void {
  if (selectedIndices.length !== 3) {
    throw new FateReshapeServiceError(400, '请选择 3 个命格进行替换');
  }

  const uniqueIndices = new Set(selectedIndices);
  if (uniqueIndices.size !== 3) {
    throw new FateReshapeServiceError(400, '请选择 3 个不同的命格进行替换');
  }

  if (selectedIndices.some((index) => index < 0 || index >= candidateCount)) {
    throw new FateReshapeServiceError(400, '命格选择超出当前候选范围');
  }
}

async function readSession(
  cultivatorId: string,
): Promise<FateReshapeSessionStore | null> {
  const key = buildSessionKey(cultivatorId);
  const session = parseRedisJson<FateReshapeSessionStore>(
    await redis.get(key),
    key,
  );
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    await redis.del(key);
    return null;
  }

  return session;
}

async function restoreSession(session: FateReshapeSessionStore): Promise<void> {
  if (session.expiresAt <= Date.now()) {
    return;
  }

  await redis.set(
    buildSessionKey(session.cultivatorId),
    JSON.stringify(session),
    'EX',
    getRemainingTtlSeconds(session.expiresAt),
  );
}

async function requireSession(
  cultivatorId: string,
): Promise<FateReshapeSessionStore> {
  const session = await readSession(cultivatorId);
  if (!session) {
    throw new FateReshapeServiceError(404, '未找到进行中的命格重塑会话');
  }
  return session;
}

async function withCultivatorLock<T>(
  cultivatorId: string,
  task: () => Promise<T>,
): Promise<T> {
  const lockKey = buildLockKey(cultivatorId);
  const acquiredLock = await redis.set(lockKey, 'locked', 'EX', 10, 'NX');
  if (!acquiredLock) {
    throw new FateReshapeServiceError(429, '命格重塑处理中，请稍后再试');
  }

  try {
    return await task();
  } finally {
    await redis.del(lockKey);
  }
}

async function loadMatchingTalismanRows(
  cultivatorId: string,
): Promise<ConsumableRow[]> {
  const rows = await getExecutor()
    .select()
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.cultivatorId, cultivatorId),
        eq(schema.consumables.type, '符箓'),
        or(
          eq(schema.consumables.mechanicKey, FATE_RESHAPE_MECHANIC_KEY),
          eq(schema.consumables.name, FATE_RESHAPE_TALISMAN_NAME),
        ),
      ),
    )
    .limit(100);

  return rows
    .filter((row) => row.quantity > 0)
    .sort((left, right) => {
      const leftPriority =
        left.mechanicKey === FATE_RESHAPE_MECHANIC_KEY ? 1 : 0;
      const rightPriority =
        right.mechanicKey === FATE_RESHAPE_MECHANIC_KEY ? 1 : 0;
      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }
      return (
        (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0)
      );
    });
}

export class FateReshapeServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'FateReshapeServiceError';
  }
}

export const FateReshapeService = {
  async getSession(cultivatorId: string): Promise<FateReshapeSessionDTO | null> {
    const session = await readSession(cultivatorId);
    return session ? toSessionDto(session) : null;
  },

  async getAvailableTalismanCount(cultivatorId: string): Promise<number> {
    const rows = await loadMatchingTalismanRows(cultivatorId);
    return rows.reduce((sum, row) => sum + row.quantity, 0);
  },

  async startSession(
    userId: string,
    cultivatorId: string,
  ): Promise<FateReshapeSessionDTO> {
    return withCultivatorLock(cultivatorId, async () => {
      const existing = await readSession(cultivatorId);
      if (existing) {
        return toSessionDto(existing);
      }

      const cultivator = await getCultivatorById(userId, cultivatorId);
      if (!cultivator) {
        throw new FateReshapeServiceError(404, '当前没有可重塑命格的角色');
      }

      const talismanRows = await loadMatchingTalismanRows(cultivatorId);
      const availableTalisman = talismanRows[0];
      if (!availableTalisman?.id) {
        throw new FateReshapeServiceError(400, '缺少天机逆命符，无法开启命格重塑');
      }

      const currentCandidates = await FateEngine.generateCandidatePool(cultivator, {
        strategy: 'root_restricted',
      });
      const createdAt = Date.now();
      const session: FateReshapeSessionStore = {
        sessionId: crypto.randomUUID(),
        cultivatorId,
        originalFates: FateEngine.normalizeFates(cultivator.pre_heaven_fates),
        currentCandidates,
        rerollUsed: false,
        createdAt,
        expiresAt: createdAt + FATE_RESHAPE_SESSION_TTL_SEC * 1000,
      };

      try {
        await getExecutor().transaction(async (tx) => {
          await consumeConsumableById(
            userId,
            cultivatorId,
            availableTalisman.id!,
            1,
            tx,
          );
          await redis.set(
            buildSessionKey(cultivatorId),
            JSON.stringify(session),
            'EX',
            FATE_RESHAPE_SESSION_TTL_SEC,
          );
        });
      } catch (error) {
        await redis.del(buildSessionKey(cultivatorId));
        throw error;
      }

      return toSessionDto(session);
    });
  },

  async rerollSession(cultivatorId: string): Promise<FateReshapeSessionDTO> {
    return withCultivatorLock(cultivatorId, async () => {
      const session = await requireSession(cultivatorId);
      if (session.rerollUsed) {
        throw new FateReshapeServiceError(400, '本次命格重塑已无法再重抽');
      }

      const bundle = await getCultivatorByIdUnsafe(cultivatorId);
      if (!bundle?.cultivator) {
        throw new FateReshapeServiceError(404, '当前没有可重塑命格的角色');
      }

      const currentCandidates = await FateEngine.generateCandidatePool(
        bundle.cultivator,
        {
          strategy: 'root_restricted',
        },
      );

      const nextSession: FateReshapeSessionStore = {
        ...session,
        currentCandidates,
        rerollUsed: true,
      };

      await redis.set(
        buildSessionKey(cultivatorId),
        JSON.stringify(nextSession),
        'EX',
        getRemainingTtlSeconds(session.expiresAt),
      );

      return toSessionDto(nextSession);
    });
  },

  async confirmSession(
    userId: string,
    cultivatorId: string,
    selectedIndices: number[],
  ): Promise<PreHeavenFate[]> {
    return withCultivatorLock(cultivatorId, async () => {
      const session = await requireSession(cultivatorId);
      validateSelectedIndices(selectedIndices, session.currentCandidates.length);

      const selectedFates = selectedIndices.map(
        (index) => session.currentCandidates[index],
      );

      try {
        await getExecutor().transaction(async (tx) => {
          await replacePreHeavenFates(userId, cultivatorId, selectedFates, tx);
          await redis.del(buildSessionKey(cultivatorId));
        });
      } catch (error) {
        await restoreSession(session);
        throw error;
      }

      return FateEngine.normalizeFates(selectedFates);
    });
  },

  async abandonSession(cultivatorId: string): Promise<void> {
    await withCultivatorLock(cultivatorId, async () => {
      await requireSession(cultivatorId);
      await redis.del(buildSessionKey(cultivatorId));
    });
  },
};
