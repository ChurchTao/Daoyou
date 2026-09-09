import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import {
  isRedisLockContention,
  redisLockKeys,
  withRedisLock,
  type RedisLeaseContext,
} from '@server/lib/redis/lock';
import { findActiveCultivatorOwnerId } from '@server/lib/repositories/cultivatorRepository';
import { consumeConsumableById } from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import {
  getPlayerPreHeavenFates,
  replacePreHeavenFates,
} from '@server/lib/services/cultivator/CultivatorProfileRepository';
import type { Consumable } from '@shared/types/cultivator';
import type {
  FateReshapeSessionDTO,
  FateReshapeSessionStore,
} from '@shared/types/fateReshape';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '../drizzle/db';
import { findBagTalisman } from './BagConsumables';
import { FATE_RESHAPE_CANDIDATE_COUNT } from './FateConfig';
import { FateEngine } from './FateEngine';
type ConsumableRow = Consumable & { id: string };

const FATE_RESHAPE_SESSION_TTL_SEC = 3600;
const FATE_RESHAPE_SCENARIO = 'fate_reshape';

function buildSessionKey(cultivatorId: string): string {
  return `fate-reshape-session:${cultivatorId}`;
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

async function readRedisSession(
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

async function writeSession(
  cultivatorId: string,
  session: FateReshapeSessionStore | null,
): Promise<void> {
  if (!session) {
    await redis.del(buildSessionKey(cultivatorId));
    return;
  }
  await redis.set(
    buildSessionKey(cultivatorId),
    JSON.stringify(session),
    'EX',
    getRemainingTtlSeconds(session.expiresAt),
  );
}

async function readSession(
  cultivatorId: string,
): Promise<FateReshapeSessionStore | null> {
  return readRedisSession(cultivatorId);
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
  task: (lease: RedisLeaseContext) => Promise<T>,
): Promise<T> {
  try {
    return await withRedisLock(
      {
        key: redisLockKeys.cultivatorMutation(cultivatorId),
        context: 'fate-reshape',
        timeoutMs: 60_000,
        retries: 0,
      },
      task,
    );
  } catch (error) {
    if (isRedisLockContention(error)) {
      throw new FateReshapeServiceError(429, '命格重塑处理中，请稍后再试');
    }
    throw error;
  }
}

async function loadMatchingTalismanRows(
  cultivatorId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<ConsumableRow[]> {
  const rows = await findBagTalisman(cultivatorId, FATE_RESHAPE_SCENARIO, q);

  return rows;
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

export async function prepareFateReshapeStart(
  userId: string,
  cultivatorId: string,
) {
  const existing = await readSession(cultivatorId);
  if (existing) {
    return {
      commit: async () => ({
        session: toSessionDto(existing),
        consumption: null,
        afterCommit: async () => undefined,
      }),
    };
  }

  const currentFates = await getPlayerPreHeavenFates(userId, cultivatorId);
  if (!currentFates) {
    throw new FateReshapeServiceError(404, '当前没有可重塑命格的角色');
  }

  const talismanRows = await loadMatchingTalismanRows(cultivatorId);
  const availableTalisman = talismanRows[0];
  if (!availableTalisman?.id) {
    throw new FateReshapeServiceError(400, '缺少天机逆命符，无法开启命格重塑');
  }

  const currentCandidates = await FateEngine.generateCandidatePool({
    candidateCount: FATE_RESHAPE_CANDIDATE_COUNT,
  });
  const createdAt = Date.now();
  const session: FateReshapeSessionStore = {
    sessionId: crypto.randomUUID(),
    cultivatorId,
    originalFates: FateEngine.normalizeFates(currentFates),
    currentCandidates,
    rerollUsed: false,
    createdAt,
    expiresAt: createdAt + FATE_RESHAPE_SESSION_TTL_SEC * 1000,
  };

  return {
    async commit(tx: DbTransaction) {
      const consumption = await consumeConsumableById(
        userId,
        cultivatorId,
        availableTalisman.id!,
        1,
        tx,
      );
      return {
        session: toSessionDto(session),
        consumption: {
          itemId: availableTalisman.id!,
          ...consumption,
        },
        afterCommit: async () => {
          await writeSession(cultivatorId, session);
        },
      };
    },
  };
}

export async function prepareFateReshapeConfirmation(
  userId: string,
  cultivatorId: string,
  selectedIndices: number[],
) {
  const session = await requireSession(cultivatorId);
  validateSelectedIndices(selectedIndices, session.currentCandidates.length);
  const selectedFates = selectedIndices.map(
    (index) => session.currentCandidates[index],
  );

  return {
    async commit(tx: DbTransaction) {
      await replacePreHeavenFates(userId, cultivatorId, selectedFates, tx);
      return {
        selectedFates: FateEngine.normalizeFates(selectedFates),
        afterCommit: async () => {
          await writeSession(cultivatorId, null);
        },
      };
    },
  };
}

export const FateReshapeService = {
  async getSession(
    cultivatorId: string,
  ): Promise<FateReshapeSessionDTO | null> {
    const session = await readSession(cultivatorId);
    return session ? toSessionDto(session) : null;
  },

  async getAvailableTalismanCount(cultivatorId: string): Promise<number> {
    const rows = await loadMatchingTalismanRows(cultivatorId);
    return rows.reduce((sum, row) => sum + row.quantity, 0);
  },

  async rerollSession(cultivatorId: string): Promise<FateReshapeSessionDTO> {
    return withCultivatorLock(cultivatorId, async (lease) => {
      const session = await requireSession(cultivatorId);
      if (session.rerollUsed) {
        throw new FateReshapeServiceError(400, '本次命格重塑已无法再重抽');
      }

      if (!(await findActiveCultivatorOwnerId(cultivatorId))) {
        throw new FateReshapeServiceError(404, '当前没有可重塑命格的角色');
      }

      const currentCandidates = await FateEngine.generateCandidatePool({
        candidateCount: FATE_RESHAPE_CANDIDATE_COUNT,
      });

      const nextSession: FateReshapeSessionStore = {
        ...session,
        currentCandidates,
        rerollUsed: true,
      };

      lease.assertHeld();
      await writeSession(cultivatorId, nextSession);

      return toSessionDto(nextSession);
    });
  },

  async abandonSession(cultivatorId: string): Promise<void> {
    await withCultivatorLock(cultivatorId, async (lease) => {
      await requireSession(cultivatorId);
      lease.assertHeld();
      await writeSession(cultivatorId, null);
    });
  },
};
