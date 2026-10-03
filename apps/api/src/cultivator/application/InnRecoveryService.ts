import {
  calculateInnRecoverySpiritStoneCost,
  calculateInnRecoveryLossAmount,
  rollInnRecoveryLossPercent,
} from '@daoyou/shared/config/innRecovery';
import {
  createDefaultCultivationProgress,
  syncBottleneckState,
} from '@daoyou/shared/engine/cultivation/cultivationUtils';
import { evaluateFateContext, getInnSpiritStoneMultiplier } from '@daoyou/shared/lib/fates';
import { ConditionService } from '@server/cultivator/application/ConditionService.js';
import type { CultivatorCondition } from '@daoyou/shared/types/condition';
import type { CultivationProgress, Cultivator } from '@daoyou/shared/types/cultivator';
import type { CultivatorDisplayInput } from '@daoyou/shared/lib/cultivatorDisplay';

export type InnRecoveryFacts = CultivatorDisplayInput &
  Pick<
    Cultivator,
    'pre_heaven_fates' | 'cultivation_progress' | 'spirit_stones'
  >;

export interface InnRecoveryResult {
  spiritStoneCost: number;
  nextCondition: CultivatorCondition;
  nextCultivationProgress: CultivationProgress;
  cultivationLossPercent: number;
  cultivationLossAmount: number;
  clearedStatusCount: number;
}

export const InnRecoveryService = {
  buildRecoveryResult(
    cultivator: InnRecoveryFacts,
    now: Date = new Date(),
    rng: () => number = Math.random,
  ): InnRecoveryResult {
    const condition = ConditionService.normalizeCondition(
      cultivator,
      cultivator.condition,
      now,
    );
    const cultivationProgress =
      cultivator.cultivation_progress ??
      createDefaultCultivationProgress(cultivator.realm, cultivator.realm_stage);
    const fateContext = evaluateFateContext(cultivator.pre_heaven_fates ?? []);
    const { maxHp, maxMp } = ConditionService.getMaxResources(cultivator);
    const cultivationLossPercent = rollInnRecoveryLossPercent(rng);
    const cultivationLossAmount = calculateInnRecoveryLossAmount(
      cultivationProgress.cultivation_exp,
      cultivationLossPercent,
      fateContext.innCultivationLossMultiplier,
    );
    const spiritStoneCost = calculateInnRecoverySpiritStoneCost(
      cultivator.realm,
      getInnSpiritStoneMultiplier(fateContext),
    );

    const nextCondition = ConditionService.normalizeCondition(
      cultivator,
      {
        ...condition,
        resources: {
          hp: { current: maxHp },
          mp: { current: maxMp },
        },
        statuses: [],
        timestamps: {
          ...condition.timestamps,
          lastRecoveryAt: now.toISOString(),
        },
      },
      now,
    );

    const nextCultivationProgress: CultivationProgress = {
      ...cultivationProgress,
      cultivation_exp: Math.max(
        0,
        cultivationProgress.cultivation_exp - cultivationLossAmount,
      ),
    };
    syncBottleneckState(nextCultivationProgress);

    return {
      spiritStoneCost,
      nextCondition,
      nextCultivationProgress,
      cultivationLossPercent,
      cultivationLossAmount,
      clearedStatusCount: condition.statuses.length,
    };
  },
};
