import type { TeamAbilityContext } from '../TeamAbility';
import type { TeamTargetPolicy, TeamUnitRef } from '../types';
import type { TeamUnit } from '../TeamUnit';
import { BasicStrike } from '../abilities/BasicStrike';

const BASIC_STRIKE_POLICY: TeamTargetPolicy = {
  team: 'enemy',
  scope: 'single',
  filter: 'front_first',
};

// BasicStrike 无实例状态，可安全共享
const sharedBasicStrike = new BasicStrike();

/**
 * 选择普攻目标（含敌方嘲讽判定）。
 * 优先级：preferredTarget（若存活）> 敌方嘲讽单位 > 阵型前排优先。
 */
export function selectBasicAttackTarget(
  ctx: TeamAbilityContext,
  attacker: TeamUnit,
  preferredTarget?: TeamUnitRef | null,
): TeamUnitRef | null {
  if (preferredTarget && preferredTarget.isAlive()) return preferredTarget;
  const tauntTarget = ctx.engine.getEnemyTaunt(attacker.side);
  if (tauntTarget && tauntTarget.isAlive()) return tauntTarget;
  const targets = ctx.engine.selectTargets(attacker, BASIC_STRIKE_POLICY);
  return targets[0] ?? null;
}

/**
 * 执行一次普攻（含嘲讽判定、目标选择、伤害结算）。
 *
 * 供技能内部的 fallback / 连击 / 追击使用：
 * - 走 BasicStrike.execute → dealDamage → DamageResolver 全流程
 * - 不设 isFollowUp，因此后续 AfterDealDamage 照常派发（可触发追击/连击）
 */
export function performBasicAttack(
  ctx: TeamAbilityContext,
  attacker: TeamUnit,
  preferredTarget?: TeamUnitRef | null,
): void {
  const target = selectBasicAttackTarget(ctx, attacker, preferredTarget);
  if (!target) return;
  const attackCtx: TeamAbilityContext = {
    ...ctx,
    source: attacker,
  };
  sharedBasicStrike.execute(attackCtx, [target as TeamUnit]);
}
