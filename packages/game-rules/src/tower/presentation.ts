import { type TowerBlessingId } from '@daoyou/game-domain/tower';
import { TOWER_BLESSINGS_PACK, towerBlessingRule } from '@daoyou/game-content/tower';

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
    if (!stacks) return '尚未承接';
    const percent = Math.round(stacks * rule.effect.perStack * 100);
    if (rule.effect.kind === 'damageTaken')
      return `${rule.label} ${100 - percent}%`;
    return `${rule.label} +${percent}%`;
  };
  return {
    currentLabel: label(args.currentStacks),
    nextLabel:
      args.nextStacks === undefined ? undefined : label(args.nextStacks),
    formulaLabel: rule.description,
  };
}
