import { consumeConsumableById } from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import { resourceEngine } from '@server/lib/services/resource/ResourceEngine';
import { rollManualDrawQualities } from '@shared/config/manualDrawConfig';
import { MaterialGenerator } from '@shared/engine/material/creation/MaterialGenerator';
import type { MaterialSkeleton } from '@shared/engine/material/creation/types';
import type { Consumable, Material } from '@shared/types/cultivator';
import {
  MANUAL_DRAW_CONFIG,
  type ManualDrawCount,
  type ManualDrawKind,
  type ManualDrawResultDTO,
  type ManualDrawStatusDTO,
  type ManualDrawTalismanCounts,
} from '@shared/types/manualDraw';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '../drizzle/db';
import { findBagTalisman } from './BagConsumables';
type ConsumableRow = Consumable & { id: string };

const ALLOWED_DRAW_COUNTS = new Set<ManualDrawCount>([1, 5]);

function validateDrawCount(count: number): asserts count is ManualDrawCount {
  if (!ALLOWED_DRAW_COUNTS.has(count as ManualDrawCount)) {
    throw new ManualDrawServiceError(400, '当前仅支持抽 1 次或 5 连抽');
  }
}

async function loadMatchingTalismanRows(
  cultivatorId: string,
  kind: ManualDrawKind,
  executor?: DbExecutor | DbTransaction,
): Promise<ConsumableRow[]> {
  const config = MANUAL_DRAW_CONFIG[kind];
  const q = executor ?? getExecutor();
  const rows = await findBagTalisman(cultivatorId, config.talismanScenario, q);

  return rows;
}

function buildSpendPlan(rows: ConsumableRow[], count: number) {
  const plan: Array<{ consumableId: string; quantity: number }> = [];
  let remaining = count;

  for (const row of rows) {
    if (remaining <= 0 || !row.id) break;
    const quantity = Math.min(row.quantity, remaining);
    if (quantity <= 0) continue;
    plan.push({ consumableId: row.id, quantity });
    remaining -= quantity;
  }

  return { plan, remaining };
}

async function buildDrawRewards(
  kind: ManualDrawKind,
  count: ManualDrawCount,
): Promise<Material[]> {
  const config = MANUAL_DRAW_CONFIG[kind];
  const qualities = rollManualDrawQualities(kind, count);
  const skeletons: MaterialSkeleton[] = qualities.map((rank) => ({
    type: config.materialType,
    rank,
    quantity: 1,
  }));
  const generated = await MaterialGenerator.generateFromSkeletons(skeletons);

  return generated.slice(0, count).map((material) => ({
    ...material,
    quantity: 1,
    details: {
      ...(material.details ?? {}),
      source: 'manual_draw',
      kind,
      talismanName: config.talismanName,
    },
  }));
}

export class ManualDrawServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ManualDrawServiceError';
  }
}

export type PreparedManualDraw = {
  kind: ManualDrawKind;
  count: ManualDrawCount;
  rewards: Material[];
};

export const ManualDrawService = {
  async getAvailableTalismanCount(
    cultivatorId: string,
    kind: ManualDrawKind,
    executor?: DbExecutor | DbTransaction,
  ): Promise<number> {
    const rows = await loadMatchingTalismanRows(cultivatorId, kind, executor);
    return rows.reduce((sum, row) => sum + row.quantity, 0);
  },

  async getStatus(
    cultivatorId: string,
    executor?: DbExecutor | DbTransaction,
  ): Promise<ManualDrawStatusDTO> {
    const gongfa = await this.getAvailableTalismanCount(
      cultivatorId,
      'gongfa',
      executor,
    );
    const skill = await this.getAvailableTalismanCount(
      cultivatorId,
      'skill',
      executor,
    );

    const talismanCounts: ManualDrawTalismanCounts = { gongfa, skill };
    return { talismanCounts };
  },

  async prepareDraw(
    cultivatorId: string,
    kind: ManualDrawKind,
    count: number,
    executor: DbExecutor | DbTransaction = getExecutor(),
  ): Promise<PreparedManualDraw> {
    validateDrawCount(count);

    const config = MANUAL_DRAW_CONFIG[kind];
    const rows = await loadMatchingTalismanRows(cultivatorId, kind, executor);
    const totalCount = rows.reduce((sum, row) => sum + row.quantity, 0);
    if (totalCount < count) {
      throw new ManualDrawServiceError(
        400,
        `${config.talismanName}不足，无法进行${count === 5 ? '5 连抽' : '抽取'}`,
      );
    }

    const rewards = await buildDrawRewards(kind, count);
    if (rewards.length !== count) {
      throw new ManualDrawServiceError(500, '秘籍抽取失败，请稍后再试');
    }

    return { kind, count, rewards };
  },

  async commitPreparedDraw(
    userId: string,
    cultivatorId: string,
    prepared: PreparedManualDraw,
    tx: DbTransaction,
  ): Promise<ManualDrawResultDTO> {
    const config = MANUAL_DRAW_CONFIG[prepared.kind];
    const rows = await loadMatchingTalismanRows(
      cultivatorId,
      prepared.kind,
      tx,
    );
    const { plan, remaining } = buildSpendPlan(rows, prepared.count);
    if (remaining > 0) {
      throw new ManualDrawServiceError(
        400,
        `${config.talismanName}数量已经变化，无法完成本次抽取`,
      );
    }

    const gains = prepared.rewards.map((reward) => ({
      type: 'material' as const,
      value: reward.quantity,
      name: reward.name,
      data: reward,
    }));
    for (const step of plan) {
      await consumeConsumableById(
        userId,
        cultivatorId,
        step.consumableId,
        step.quantity,
        tx,
      );
    }
    const result = await resourceEngine.applyInTransaction({
      userId,
      cultivatorId,
      gain: gains,
      tx,
    });

    if (!result.success) {
      throw new ManualDrawServiceError(
        400,
        result.errors?.[0] || '秘籍发放失败，请稍后再试',
      );
    }

    const status = await this.getStatus(cultivatorId, tx);

    return {
      kind: prepared.kind,
      drawCount: prepared.count,
      rewards: prepared.rewards,
      talismanCounts: status.talismanCounts,
    };
  },
};
