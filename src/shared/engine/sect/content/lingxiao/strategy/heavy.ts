import type {
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { SectTacticId } from '../../../types';
import {
  LINGXIAO_ARMOR_REND_BUFF,
  LINGXIAO_HEAVY_GUARD_BUFF,
  LINGXIAO_HEAVY_POSTURE,
} from '../combat/shared';
import { findCandidate as find, selectionResult as result } from './shared';

export class LingxiaoHeavySelectionStrategy implements AbilitySelectionStrategy {
  constructor(private readonly tacticId: SectTacticId) {}

  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const { caster, opponent, candidates } = context;
    if (!opponent || !candidates.length) return null;
    const posture = caster.combatResources.getCurrent(LINGXIAO_HEAVY_POSTURE);
    const hasRend = opponent.buffs
      .getAllBuffIds()
      .includes(LINGXIAO_ARMOR_REND_BUFF);
    const guardThreshold = this.tacticId === 'heavy-guard' ? 0.7 : 0.45;
    const aegisThreshold = this.tacticId === 'heavy-guard' ? 0.55 : 0.35;
    const finisherThreshold =
      this.tacticId === 'heavy-break'
        ? 3
        : this.tacticId === 'heavy-guard'
          ? 5
          : 6;
    const turning = find(candidates, 'turning-body');
    const aegis = find(candidates, 'sword-aegis');
    if (
      this.tacticId === 'heavy-guard' &&
      aegis &&
      caster.getCurrentShield() <= 0 &&
      caster.getHpPercent() < aegisThreshold
    )
      return result(aegis, 620);
    if (
      turning &&
      caster.getHpPercent() < guardThreshold &&
      !caster.buffs.getAllBuffIds().includes(LINGXIAO_HEAVY_GUARD_BUFF)
    )
      return result(turning, 600);
    if (
      aegis &&
      caster.getCurrentShield() <= 0 &&
      caster.getHpPercent() < aegisThreshold
    )
      return result(aegis, 580);
    const ultimate = find(candidates, 'sect-ultimate');
    if (posture >= 6 && ultimate) return result(ultimate, 520);
    const breaking = find(candidates, 'breaking-edge');
    const linked = find(candidates, 'linked-edge');
    if (
      this.tacticId === 'heavy-break' &&
      opponent.getHpPercent() < 0.25 &&
      posture >= finisherThreshold &&
      breaking
    )
      return result(breaking, 510);
    if (!hasRend && linked) return result(linked, 380);
    if (posture >= finisherThreshold && breaking)
      return result(breaking, opponent.getHpPercent() < 0.25 ? 510 : 470);
    const nurturing = find(candidates, 'nurturing-sword');
    if (nurturing && caster.getHpPercent() < 0.4) return result(nurturing, 360);
    return result(
      find(candidates, 'guiding-sword') ?? linked ?? candidates[0],
      100,
    );
  }
}
