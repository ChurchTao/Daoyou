import type {
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import type { SectTacticId } from '../../../types';
import {
  LINGXIAO_RETURNING_SWALLOW_BUFF,
  LINGXIAO_SHADOW_STEP_BUFF,
  LINGXIAO_SWORD_MARK_BUFF,
  LINGXIAO_SWORD_MOMENTUM,
} from '../combat/shared';
import { findCandidate as find, selectionResult as result } from './shared';

export class LingxiaoSwiftSelectionStrategy implements AbilitySelectionStrategy {
  constructor(private readonly tacticId: SectTacticId) {}

  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const { caster, opponent, candidates } = context;
    if (!opponent || !candidates.length) return null;
    const thresholds =
      this.tacticId === 'aggressive'
        ? { finisher: 3, aegis: 0.25, turning: 0.35 }
        : this.tacticId === 'counter'
          ? { finisher: 5, aegis: 0.45, turning: 0.7 }
          : { finisher: 6, aegis: 0.4, turning: 0.55 };
    const momentum = caster.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM);
    const hasMark = opponent.buffs
      .getAllBuffIds()
      .includes(LINGXIAO_SWORD_MARK_BUFF);
    const aegis = find(candidates, 'sword-aegis');
    if (
      aegis &&
      caster.getCurrentShield() <= 0 &&
      caster.getHpPercent() < thresholds.aegis
    )
      return result(aegis, 600);
    const turning = find(candidates, 'turning-body');
    if (
      turning &&
      !caster.buffs.getAllBuffIds().includes(LINGXIAO_RETURNING_SWALLOW_BUFF) &&
      caster.getHpPercent() < thresholds.turning
    )
      return result(turning, 550);
    const breaking = find(candidates, 'breaking-edge');
    const ultimate = find(candidates, 'sect-ultimate');
    if (momentum >= thresholds.finisher) {
      if (opponent.getHpPercent() < 0.25 && breaking)
        return result(breaking, 500);
      if (momentum >= 6 && ultimate && !hasMark) return result(ultimate, 460);
      if (breaking) return result(breaking, 450);
      if (ultimate) return result(ultimate, 440);
    }
    const linked = find(candidates, 'linked-edge');
    if (!hasMark && linked) return result(linked, 350);
    const guiding = find(candidates, 'guiding-sword');
    const shadow = find(candidates, 'shadow-step');
    const shouldShadow =
      shadow &&
      !caster.buffs.getAllBuffIds().includes(LINGXIAO_SHADOW_STEP_BUFF) &&
      caster.attributes.getValue(AttributeType.SPEED) <=
        opponent.attributes.getValue(AttributeType.SPEED) &&
      momentum <= 2;
    if (shouldShadow) return result(shadow, 300);
    return result(guiding ?? linked ?? shadow ?? candidates[0], 100);
  }
}
