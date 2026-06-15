import {
  getBreakthroughPenaltyPercent,
  getPillToxicityRecoveryMultiplier,
  getPillToxicityStage,
} from '@shared/lib/condition';
import { evaluateFateContext } from '@shared/lib/fates';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import {
  CULTIVATION_BOOST_STATUS_KEY,
  getCultivationBoostDisplayText,
} from '@shared/lib/cultivationBoost';
import {
  BREAKTHROUGH_FOCUS_STATUS_KEY,
  CLEAR_MIND_STATUS_KEY,
  getBreakthroughFocusBonus,
  getProtectMeridiansReductionPercent,
  PROTECT_MERIDIANS_STATUS_KEY,
} from '@shared/lib/pillEffectScaling';
import type {
  ConditionStatusInstance,
  CultivatorCondition,
} from '@shared/types/condition';
import type { PreHeavenFate } from '@shared/types/cultivator';

export function getStatusEffectDetails(
  status: ConditionStatusInstance,
): string[] {
  const template = getConditionStatusTemplate(status.key);
  const details = [...(template?.effectDetails ?? [])];

  if (status.key === 'weakness') {
    const stacks = Math.max(1, Math.floor(status.stacks || 1));
    const penaltyPercent = Math.round(
      (1 - Math.max(0.5, 1 - stacks * 0.05)) * 100,
    );
    return [
      `当前 ${stacks} 层：体魄、灵力、悟性、身法、神识降低 ${penaltyPercent}%。`,
      ...details,
    ];
  }

  if (status.key === CULTIVATION_BOOST_STATUS_KEY) {
    return [
      `${getCultivationBoostDisplayText(status)}。`,
      '该药力只影响闭关修炼获得的修为，不影响闭关感悟。',
      '完成一次闭关修炼后消耗；尝试突破不会消耗。',
      ...details,
    ];
  }

  if (status.key === BREAKTHROUGH_FOCUS_STATUS_KEY) {
    return [
      `下次突破成功率 +${formatPercent(getBreakthroughFocusBonus(status))}。`,
      `剩余 ${status.usesRemaining ?? 1} 次突破尝试。`,
      ...details,
    ];
  }

  if (status.key === PROTECT_MERIDIANS_STATUS_KEY) {
    return [
      `突破失败时修为损失降低 ${formatPercent(
        getProtectMeridiansReductionPercent(status),
      )}。`,
      `剩余 ${status.usesRemaining ?? 1} 次突破尝试。`,
      ...details,
    ];
  }

  if (status.key === CLEAR_MIND_STATUS_KEY) {
    return [
      '突破失败不会滋生心魔；服用时已清除既有心魔。',
      `剩余 ${status.usesRemaining ?? 1} 次突破尝试。`,
      ...details,
    ];
  }

  return details;
}

function formatPercent(value: number): string {
  const percent = Number((value * 100).toFixed(1));
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent}%`;
}

export function getPillToxicityEffectDetails(
  conditionInput: CultivatorCondition | undefined,
  fates: PreHeavenFate[] = [],
): string[] {
  const fateContext = evaluateFateContext(fates);
  const recoveryEfficiency = Math.round(
    getPillToxicityRecoveryMultiplier(
      conditionInput,
      fateContext.toxicityPenaltyMultiplier,
    ) * 100,
  );
  const breakthroughPenalty = getBreakthroughPenaltyPercent(
    conditionInput,
    fateContext.toxicityPenaltyMultiplier,
  );
  const stage = getPillToxicityStage(conditionInput).label;
  const currentToxicity = Math.max(0, conditionInput?.gauges.pillToxicity ?? 0);

  return [
    `当前丹毒阶段：${stage}。`,
    `当前丹毒值为 ${currentToxicity}，会把基础自然恢复效率压到 ${recoveryEfficiency}%。`,
    `丹毒也会压制突破成功率，当前额外降低 ${breakthroughPenalty}%。`,
    currentToxicity > 0
      ? '丹毒不会随自然恢复自行消退，需要靠解毒类丹药或其他专门手段化解。'
      : '当前无明显丹毒压制。服丹累积后，恢复与突破都会受影响。',
  ];
}
