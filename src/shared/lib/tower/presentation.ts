import {
  TOWER_BLESSINGS_PACK,
  towerBlessingRule,
  type TowerBlessingId,
} from './blessing-pack';

export function getTowerBlessingEffectPreview(
  args: {
    blessingId: TowerBlessingId;
    currentStacks: number;
    nextStacks?: number;
  },
  pack = TOWER_BLESSINGS_PACK,
) {
  const rule = towerBlessingRule(args.blessingId, pack);
  const label = (n: number) => {
    const stacks = Number.isFinite(n)
      ? Math.max(0, Math.min(rule.maxStacks, Math.floor(n)))
      : 0;
    return stacks
      ? `${rule.label} +${Math.round(stacks * rule.effect.perStack * 100)}%`
      : '尚未承接';
  };
  return {
    currentLabel: label(args.currentStacks),
    nextLabel:
      args.nextStacks === undefined ? undefined : label(args.nextStacks),
    formulaLabel: `每次${rule.label} +${Math.round(rule.effect.perStack * 100)}%，最多 ${rule.maxStacks} 次，同项加成相加。`,
  };
}
