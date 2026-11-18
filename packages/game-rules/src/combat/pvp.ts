import type { BattleState, CombatV6VersionStamp, LineupUnit } from '@daoyou/combat-core/types';
import { PVP_FATIGUE } from '@daoyou/game-content/combat/tuning';

/** Frozen into new PvP snapshots; earlier rulesets retain their original recovery. */
export const PVP_FATIGUE_RULESET_VERSION = 'daoyou_rules_v14_pvp';

export function isPvpLineup(units: readonly LineupUnit[]): boolean {
  return [0, 1].every(side => units.some(unit => unit.side === side && unit.kind === 'player'));
}

export function pvpRecoveryMultiplier(state: {
  round: number;
  versions?: Pick<CombatV6VersionStamp, 'rulesetVersion'>;
}): number {
  if (state.versions?.rulesetVersion !== PVP_FATIGUE_RULESET_VERSION) return 1;
  const reduction = Math.min(PVP_FATIGUE.maxReductionPercent,
    Math.max(0, state.round - PVP_FATIGUE.fullRecoveryRounds) * PVP_FATIGUE.reductionPerRoundPercent);
  return (100 - reduction) / 100;
}

export function pvpFatigueNotice(round: number, versions: BattleState['versions']): string | undefined {
  if (versions.rulesetVersion !== PVP_FATIGUE_RULESET_VERSION) return undefined;
  const percent = Math.round(pvpRecoveryMultiplier({ round, versions }) * 100);
  return percent === 100
    ? '久战衰减：第31回合起，气血恢复每回合降低2个百分点，最低保留40%；包括吸血、被动回血与复活气血。'
    : `久战衰减：气血恢复保留${percent}%，包括吸血、被动回血与复活气血；最低保留40%。`;
}
