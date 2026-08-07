import { AttributeType, DamageType, DamageSource } from '@shared/engine/battle-v5/core/types';
import { TeamAbility } from '../TeamAbility';
import type { TeamAbilityContext } from '../TeamAbility';
import type { TeamUnit } from '../TeamUnit';
import type { TeamTargetPolicy } from '../types';

const BASIC_STRIKE_POLICY: TeamTargetPolicy = {
  team: 'enemy',
  scope: 'single',
  filter: 'front_first',
};

/**
 * 普攻：无冷却、无次数限制的兜底技能。
 * 物理伤害，系数 1.0。
 */
export class BasicStrike extends TeamAbility {
  constructor() {
    super({
      id: 'basic_strike',
      name: '普攻',
      kind: 'basic',
      targetPolicy: BASIC_STRIKE_POLICY,
      cooldown: 0,
      maxUsesPerRound: 0,
    });
  }

  execute(ctx: TeamAbilityContext, targets: TeamUnit[]): void {
    if (targets.length === 0) return;
    const target = targets[0];
    ctx.engine.dealDamage(ctx.source, target, this, {
      attribute: AttributeType.ATK,
      coefficient: 1.0,
      damageType: DamageType.PHYSICAL,
      source: DamageSource.DIRECT,
    });
  }
}
