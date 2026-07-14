import type {
  AbilitySelectionCandidate,
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import type { SectCombatProjection, SectTacticId } from './types';
import {
  LINGXIAO_RETURNING_SWALLOW_BUFF,
  LINGXIAO_SHADOW_STEP_BUFF,
  LINGXIAO_SWORD_MARK_BUFF,
  LINGXIAO_SWORD_MOMENTUM,
} from './combatProjection';

const ABILITY_SLUG = {
  guiding: 'sect.lingxiao.guiding-sword',
  linked: 'sect.lingxiao.linked-edge',
  turning: 'sect.lingxiao.turning-body',
  breaking: 'sect.lingxiao.breaking-edge',
  aegis: 'sect.lingxiao.sword-aegis',
  shadow: 'sect.lingxiao.shadow-step',
  instant: 'sect.lingxiao.instant-traceless',
} as const;

const CONDITIONAL_ONLY_ABILITIES = new Set<string>([
  ABILITY_SLUG.aegis,
  ABILITY_SLUG.turning,
  ABILITY_SLUG.breaking,
  ABILITY_SLUG.instant,
]);

const TACTIC_THRESHOLDS: Record<
  SectTacticId,
  { finisher: number; aegisHp: number; turningHp: number }
> = {
  aggressive: { finisher: 3, aegisHp: 0.25, turningHp: 0.35 },
  steady: { finisher: 6, aegisHp: 0.4, turningHp: 0.55 },
  counter: { finisher: 5, aegisHp: 0.45, turningHp: 0.7 },
};

function findCandidate(
  candidates: AbilitySelectionCandidate[],
  abilityId: string,
): AbilitySelectionCandidate | undefined {
  return candidates.find((candidate) => candidate.ability.id === abilityId);
}

function toResult(
  candidate: AbilitySelectionCandidate | undefined,
  score: number,
): AbilitySelectionResult | null {
  if (!candidate) return null;
  return {
    ability: candidate.ability,
    target: candidate.target,
    score,
  };
}

export class LingxiaoSwordSelectionStrategy implements AbilitySelectionStrategy {
  constructor(private readonly tacticId: SectTacticId) {}

  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const { caster, opponent, candidates } = context;
    if (!opponent || candidates.length === 0) return null;

    const thresholds = TACTIC_THRESHOLDS[this.tacticId];
    const momentum = caster.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM);
    const resourceMax = caster.combatResources.getMax(LINGXIAO_SWORD_MOMENTUM);
    const finisherThreshold = Math.min(thresholds.finisher, resourceMax || thresholds.finisher);
    const hasSwordMark = opponent.buffs.getAllBuffIds().includes(LINGXIAO_SWORD_MARK_BUFF);
    const hasReturningSwallow = caster.buffs
      .getAllBuffIds()
      .includes(LINGXIAO_RETURNING_SWALLOW_BUFF);
    const hasShadowStep = caster.buffs
      .getAllBuffIds()
      .includes(LINGXIAO_SHADOW_STEP_BUFF);

    const aegis = findCandidate(candidates, ABILITY_SLUG.aegis);
    if (
      aegis &&
      caster.getCurrentShield() <= 0 &&
      caster.getHpPercent() < thresholds.aegisHp
    ) {
      return toResult(aegis, 600);
    }

    const turning = findCandidate(candidates, ABILITY_SLUG.turning);
    if (
      turning &&
      !hasReturningSwallow &&
      caster.getHpPercent() < thresholds.turningHp
    ) {
      return toResult(turning, 550);
    }

    const breaking = findCandidate(candidates, ABILITY_SLUG.breaking);
    const instant = findCandidate(candidates, ABILITY_SLUG.instant);
    const canFinish = momentum >= finisherThreshold;

    if (canFinish && opponent.getHpPercent() < 0.25 && breaking) {
      return toResult(breaking, 500);
    }

    if (canFinish) {
      if (momentum >= 6 && breaking && instant) {
        return hasSwordMark
          ? toResult(breaking, 450)
          : toResult(instant, 450);
      }
      if (breaking) return toResult(breaking, 440);
      if (instant) return toResult(instant, 440);
    }

    const linked = findCandidate(candidates, ABILITY_SLUG.linked);
    if (momentum < finisherThreshold && !hasSwordMark && linked) {
      return toResult(linked, 350);
    }

    const guiding = findCandidate(candidates, ABILITY_SLUG.guiding);
    const shadow = findCandidate(candidates, ABILITY_SLUG.shadow);
    const isSlowerOrEqual =
      caster.attributes.getValue(AttributeType.SPEED) <=
      opponent.attributes.getValue(AttributeType.SPEED);
    const shouldPrepareShadow =
      shadow &&
      !hasShadowStep &&
      isSlowerOrEqual &&
      momentum <= 2 &&
      (this.tacticId === 'counter' ||
        (this.tacticId === 'steady' && !guiding && !linked));

    if (shouldPrepareShadow) {
      return toResult(shadow, 300);
    }

    if (guiding) return toResult(guiding, 250);
    if (linked) return toResult(linked, 240);
    if (shadow) return toResult(shadow, 230);

    const fallback = candidates.find(
      (candidate) => !CONDITIONAL_ONLY_ABILITIES.has(candidate.ability.id),
    );
    return toResult(fallback, 100);
  }
}

export function createSectAbilitySelectionStrategy(
  projection: SectCombatProjection,
): AbilitySelectionStrategy | null {
  switch (projection.selectionStrategyId) {
    case 'sect.lingxiao.sword.v1':
      return new LingxiaoSwordSelectionStrategy(projection.tacticId);
    default:
      return null;
  }
}
