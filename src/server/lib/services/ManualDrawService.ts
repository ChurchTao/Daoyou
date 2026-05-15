import { rollManualDrawQualities } from '@shared/config/manualDrawConfig';
import type { MaterialSkeleton } from '@shared/engine/material/creation/types';
import { MaterialGenerator } from '@shared/engine/material/creation/MaterialGenerator';
import { resourceEngine } from '@shared/engine/resource/ResourceEngine';
import { isTalismanConsumable } from '@shared/lib/consumables';
import type { Material } from '@shared/types/cultivator';
import {
  MANUAL_DRAW_CONFIG,
  type ManualDrawCount,
  type ManualDrawKind,
  type ManualDrawResultDTO,
  type ManualDrawStatusDTO,
  type ManualDrawTalismanCounts,
} from '@shared/types/manualDraw';
import { and, eq } from 'drizzle-orm';
import { getExecutor } from '../drizzle/db';
import * as schema from '../drizzle/schema';
import { consumeConsumableById } from './cultivatorService';
import { mapConsumableRow, type ConsumableRow } from './consumablePersistence';

const ALLOWED_DRAW_COUNTS = new Set<ManualDrawCount>([1, 5]);

function validateDrawCount(count: number): asserts count is ManualDrawCount {
  if (!ALLOWED_DRAW_COUNTS.has(count as ManualDrawCount)) {
    throw new ManualDrawServiceError(400, '当前仅支持抽 1 次或 5 连抽');
  }
}

async function loadMatchingTalismanRows(
  cultivatorId: string,
  kind: ManualDrawKind,
): Promise<ConsumableRow[]> {
  const config = MANUAL_DRAW_CONFIG[kind];
  const rows = await getExecutor()
    .select()
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.cultivatorId, cultivatorId),
        eq(schema.consumables.type, '符箓'),
      ),
    )
    .limit(200);

  return rows
    .filter((row) => {
      if (row.quantity <= 0) return false;
      const consumable = mapConsumableRow(row);
      return (
        isTalismanConsumable(consumable) &&
        consumable.spec.scenario === config.talismanScenario
      );
    })
    .sort(
      (left, right) =>
        (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0),
    );
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

export const ManualDrawService = {
  async getAvailableTalismanCount(
    cultivatorId: string,
    kind: ManualDrawKind,
  ): Promise<number> {
    const rows = await loadMatchingTalismanRows(cultivatorId, kind);
    return rows.reduce((sum, row) => sum + row.quantity, 0);
  },

  async getStatus(cultivatorId: string): Promise<ManualDrawStatusDTO> {
    const [gongfa, skill] = await Promise.all([
      this.getAvailableTalismanCount(cultivatorId, 'gongfa'),
      this.getAvailableTalismanCount(cultivatorId, 'skill'),
    ]);

    const talismanCounts: ManualDrawTalismanCounts = { gongfa, skill };
    return { talismanCounts };
  },

  async draw(
    userId: string,
    cultivatorId: string,
    kind: ManualDrawKind,
    count: number,
  ): Promise<ManualDrawResultDTO> {
    validateDrawCount(count);

    const config = MANUAL_DRAW_CONFIG[kind];
    const rows = await loadMatchingTalismanRows(cultivatorId, kind);
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

    const { plan, remaining } = buildSpendPlan(rows, count);
    if (remaining > 0) {
      throw new ManualDrawServiceError(
        400,
        `${config.talismanName}不足，无法完成本次抽取`,
      );
    }

    const result = await resourceEngine.gain(
      userId,
      cultivatorId,
      rewards.map((reward) => ({
        type: 'material' as const,
        value: reward.quantity,
        name: reward.name,
        data: reward,
      })),
      async (tx) => {
        for (const step of plan) {
          await consumeConsumableById(
            userId,
            cultivatorId,
            step.consumableId,
            step.quantity,
            tx,
          );
        }
      },
    );

    if (!result.success) {
      throw new ManualDrawServiceError(
        400,
        result.errors?.[0] || '秘籍发放失败，请稍后再试',
      );
    }

    const status = await this.getStatus(cultivatorId);

    return {
      kind,
      drawCount: count,
      rewards,
      talismanCounts: status.talismanCounts,
    };
  },
};
