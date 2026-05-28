import {
  calculateInnRecoverySpiritStoneCost,
  calculateInnRecoveryLossAmount,
  rollInnRecoveryLossPercent,
} from '@shared/config/innRecovery';
import { createDefaultCultivationProgress } from '@server/utils/cultivationUtils';
import { evaluateFateContext, getInnSpiritStoneMultiplier } from '@shared/lib/fates';
import { ConditionService } from './ConditionService';
import type { CultivatorCondition } from '@shared/types/condition';
import type { CultivationProgress, Cultivator } from '@shared/types/cultivator';

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
    cultivator: Cultivator,
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

    return {
      spiritStoneCost,
      nextCondition,
      nextCultivationProgress: {
        ...cultivationProgress,
        cultivation_exp: Math.max(
          0,
          cultivationProgress.cultivation_exp - cultivationLossAmount,
        ),
      },
      cultivationLossPercent,
      cultivationLossAmount,
      clearedStatusCount: condition.statuses.length,
    };
  },
};
