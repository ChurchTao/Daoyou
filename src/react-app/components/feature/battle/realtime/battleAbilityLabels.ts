import type { PlanningAbilityViewV1 } from '@shared/engine/battle-v5/round/types';

export function abilityTargetLabel(
  ability: Pick<PlanningAbilityViewV1, 'targetTeam' | 'targetScope'>,
) {
  if (ability.targetTeam === 'self') return '自身';
  if (ability.targetScope === 'aoe') return '范围';
  if (ability.targetScope === 'random') return '随机';
  return ability.targetTeam === 'ally' ? '友方' : '敌方';
}

export function unavailableAbilityLabel(ability: PlanningAbilityViewV1) {
  switch (ability.unavailableReason) {
    case 'cooldown':
      return '冷却中';
    case 'resource':
      return '资源不足';
    case 'no_target':
      return '没有合法目标';
    case 'condition':
      return '当前条件不满足';
    default:
      return '暂不可用';
  }
}
