import type {
  AbilitySelectionCandidate,
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import {
  LINGXIAO_ARMOR_REND_BUFF,
  LINGXIAO_HEAVY_GUARD_BUFF,
  LINGXIAO_HEAVY_POSTURE,
  LINGXIAO_RETURNING_SWALLOW_BUFF,
  LINGXIAO_SHADOW_STEP_BUFF,
  LINGXIAO_SWORD_MARK_BUFF,
  LINGXIAO_SWORD_MOMENTUM,
} from './combatProjection';
import type { SectCombatProjection, SectTacticId } from './types';

const slug = (abilityId: string) => `sect.lingxiao.${abilityId}`;

function find(candidates: AbilitySelectionCandidate[], abilityId: string) {
  return candidates.find((candidate) => candidate.ability.id === slug(abilityId));
}

function result(candidate: AbilitySelectionCandidate | undefined, score: number): AbilitySelectionResult | null {
  return candidate ? { ability: candidate.ability, target: candidate.target, score } : null;
}

export class LingxiaoSwiftSelectionStrategy implements AbilitySelectionStrategy {
  constructor(private readonly tacticId: SectTacticId) {}

  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const { caster, opponent, candidates } = context;
    if (!opponent || !candidates.length) return null;
    const thresholds = this.tacticId === 'aggressive'
      ? { finisher: 3, aegis: 0.25, turning: 0.35 }
      : this.tacticId === 'counter'
        ? { finisher: 5, aegis: 0.45, turning: 0.7 }
        : { finisher: 6, aegis: 0.4, turning: 0.55 };
    const momentum = caster.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM);
    const hasMark = opponent.buffs.getAllBuffIds().includes(LINGXIAO_SWORD_MARK_BUFF);
    const aegis = find(candidates, 'sword-aegis');
    if (aegis && caster.getCurrentShield() <= 0 && caster.getHpPercent() < thresholds.aegis) return result(aegis, 600);
    const turning = find(candidates, 'turning-body');
    if (turning && !caster.buffs.getAllBuffIds().includes(LINGXIAO_RETURNING_SWALLOW_BUFF) && caster.getHpPercent() < thresholds.turning) return result(turning, 550);
    const breaking = find(candidates, 'breaking-edge');
    const ultimate = find(candidates, 'sect-ultimate');
    if (momentum >= thresholds.finisher) {
      if (opponent.getHpPercent() < 0.25 && breaking) return result(breaking, 500);
      if (momentum >= 6 && ultimate && !hasMark) return result(ultimate, 460);
      if (breaking) return result(breaking, 450);
      if (ultimate) return result(ultimate, 440);
    }
    const linked = find(candidates, 'linked-edge');
    if (!hasMark && linked) return result(linked, 350);
    const guiding = find(candidates, 'guiding-sword');
    const shadow = find(candidates, 'shadow-step');
    const shouldShadow = shadow
      && !caster.buffs.getAllBuffIds().includes(LINGXIAO_SHADOW_STEP_BUFF)
      && caster.attributes.getValue(AttributeType.SPEED) <= opponent.attributes.getValue(AttributeType.SPEED)
      && momentum <= 2;
    if (shouldShadow) return result(shadow, 300);
    return result(guiding ?? linked ?? shadow ?? candidates[0], 100);
  }
}

export class LingxiaoHeavySelectionStrategy implements AbilitySelectionStrategy {
  constructor(private readonly tacticId: SectTacticId) {}

  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const { caster, opponent, candidates } = context;
    if (!opponent || !candidates.length) return null;
    const posture = caster.combatResources.getCurrent(LINGXIAO_HEAVY_POSTURE);
    const hasRend = opponent.buffs.getAllBuffIds().includes(LINGXIAO_ARMOR_REND_BUFF);
    const guardThreshold = this.tacticId === 'heavy-guard' ? 0.7 : 0.45;
    const aegisThreshold = this.tacticId === 'heavy-guard' ? 0.55 : 0.35;
    const finisherThreshold = this.tacticId === 'heavy-break' ? 3 : this.tacticId === 'heavy-guard' ? 5 : 6;
    const turning = find(candidates, 'turning-body');
    const aegis = find(candidates, 'sword-aegis');
    if (this.tacticId === 'heavy-guard' && aegis && caster.getCurrentShield() <= 0 && caster.getHpPercent() < aegisThreshold) return result(aegis, 620);
    if (turning && caster.getHpPercent() < guardThreshold && !caster.buffs.getAllBuffIds().includes(LINGXIAO_HEAVY_GUARD_BUFF)) return result(turning, 600);
    if (aegis && caster.getCurrentShield() <= 0 && caster.getHpPercent() < aegisThreshold) return result(aegis, 580);
    const ultimate = find(candidates, 'sect-ultimate');
    if (posture >= 6 && ultimate) return result(ultimate, 520);
    const breaking = find(candidates, 'breaking-edge');
    const linked = find(candidates, 'linked-edge');
    if (this.tacticId === 'heavy-break' && opponent.getHpPercent() < 0.25 && posture >= finisherThreshold && breaking) return result(breaking, 510);
    if (!hasRend && linked) return result(linked, 380);
    if (posture >= finisherThreshold && breaking) return result(breaking, opponent.getHpPercent() < 0.25 ? 510 : 470);
    const nurturing = find(candidates, 'nurturing-sword');
    if (nurturing && caster.getHpPercent() < 0.4) return result(nurturing, 360);
    return result(find(candidates, 'guiding-sword') ?? linked ?? candidates[0], 100);
  }
}

export function createSectAbilitySelectionStrategy(projection: SectCombatProjection): AbilitySelectionStrategy | null {
  return projection.selectionStrategy ?? null;
}
