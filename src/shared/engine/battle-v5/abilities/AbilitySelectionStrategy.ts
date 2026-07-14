import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { AbilitySelectionIntent } from '../core/configs';
import { checkConditions } from '../core/conditionEvaluator';
import { BuffType } from '../core/types';
import { Unit } from '../units/Unit';
import { ActiveSkill } from './ActiveSkill';

export interface AbilitySelectionCandidate {
  ability: ActiveSkill;
  target: Unit;
  order: number;
}

export interface AbilitySelectionContext {
  caster: Unit;
  opponent: Unit | null;
  candidates: AbilitySelectionCandidate[];
}

export interface AbilitySelectionResult {
  ability: ActiveSkill;
  target: Unit;
  score: number;
}

export interface AbilitySelectionStrategy {
  select(context: AbilitySelectionContext): AbilitySelectionResult | null;
}

const DEFAULT_THRESHOLDS = {
  healHpSkip: 0.85,
  emergencyHealHp: 0.35,
  restoreMpSkip: 0.75,
} as const;

const DEFAULT_WEIGHTS = {
  damageBase: 25,
  damageExecuteScale: 45,
  healScale: 90,
  emergencyHealBonus: 140,
  restoreMpScale: 70,
  controlBonus: 35,
  controlLowHpPenalty: -25,
  buffBonus: 10,
  defensiveBase: 5,
  defensiveLowHpBonus: 35,
  shieldRepeatPenalty: -35,
};

export class DefaultAbilitySelectionStrategy implements AbilitySelectionStrategy {
  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const scored = context.candidates
      .map((candidate) => this.scoreCandidate(candidate, context))
      .filter(
        (result): result is AbilitySelectionResult & { order: number } =>
          result !== null,
      );

    if (scored.length === 0) {
      return null;
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.ability.priority !== a.ability.priority) {
        return b.ability.priority - a.ability.priority;
      }
      return a.order - b.order || a.ability.id.localeCompare(b.ability.id);
    });

    const best = scored[0];
    return {
      ability: best.ability,
      target: best.target,
      score: best.score,
    };
  }

  private scoreCandidate(
    candidate: AbilitySelectionCandidate,
    context: AbilitySelectionContext,
  ): (AbilitySelectionResult & { order: number }) | null {
    const intents = this.resolveIntents(candidate.ability);
    const caster = context.caster;
    const target = candidate.target;
    let score = candidate.ability.priority;

    for (const rule of candidate.ability.selectionProfile?.rules ?? []) {
      if (
        checkConditions(
          { caster, target, ability: candidate.ability },
          rule.conditions,
        )
      ) {
        if (rule.disqualify) return null;
        score += rule.scoreDelta ?? 0;
      }
    }

    if (intents.includes('heal_hp')) {
      const hpPercent = caster.getHpPercent();
      if (hpPercent >= DEFAULT_THRESHOLDS.healHpSkip) return null;
      score +=
        hpPercent <= DEFAULT_THRESHOLDS.emergencyHealHp
          ? DEFAULT_WEIGHTS.emergencyHealBonus
          : DEFAULT_WEIGHTS.healScale * (1 - hpPercent);
    }

    if (intents.includes('restore_mp')) {
      const mpPercent = caster.getMpPercent();
      if (mpPercent >= DEFAULT_THRESHOLDS.restoreMpSkip) return null;
      score += DEFAULT_WEIGHTS.restoreMpScale * (1 - mpPercent);
    }

    if (intents.includes('control')) {
      if (
        this.targetHasControl(target) ||
        target.tags.hasTag(GameplayTags.STATUS.IMMUNE.CONTROL)
      ) {
        return null;
      }
      score +=
        target.getHpPercent() <= 0.2
          ? DEFAULT_WEIGHTS.controlLowHpPenalty
          : DEFAULT_WEIGHTS.controlBonus;
    }

    if (intents.includes('damage')) {
      score +=
        DEFAULT_WEIGHTS.damageBase +
        (1 - target.getHpPercent()) * DEFAULT_WEIGHTS.damageExecuteScale;
    }

    if (intents.includes('buff')) {
      score += DEFAULT_WEIGHTS.buffBonus;
    }

    if (intents.includes('defensive')) {
      if (caster.getCurrentShield() > 0) {
        score += DEFAULT_WEIGHTS.shieldRepeatPenalty;
      }
      score +=
        caster.getHpPercent() <= 0.5
          ? DEFAULT_WEIGHTS.defensiveLowHpBonus
          : DEFAULT_WEIGHTS.defensiveBase;
    }

    return {
      ability: candidate.ability,
      target,
      score,
      order: candidate.order,
    };
  }

  private resolveIntents(ability: ActiveSkill): AbilitySelectionIntent[] {
    const explicit = ability.selectionProfile?.intents;
    if (explicit?.length) {
      return explicit;
    }

    const intents: AbilitySelectionIntent[] = [];
    if (ability.tags.hasTag(GameplayTags.ABILITY.FUNCTION.HEAL)) {
      intents.push('heal_hp');
    }
    if (ability.tags.hasTag(GameplayTags.ABILITY.FUNCTION.CONTROL)) {
      intents.push('control');
    }
    if (ability.tags.hasTag(GameplayTags.ABILITY.FUNCTION.DAMAGE)) {
      intents.push('damage');
    }
    if (ability.tags.hasTag(GameplayTags.ABILITY.FUNCTION.BUFF)) {
      intents.push('buff');
    }

    if (intents.length === 0 && ability.targetPolicy.team === 'self') {
      intents.push('buff');
    }
    if (intents.length === 0) {
      intents.push('damage');
    }

    return intents;
  }

  private targetHasControl(target: Unit): boolean {
    if (target.tags.hasTag(GameplayTags.STATUS.CONTROL.ROOT)) {
      return true;
    }

    return target.buffs
      .getAllBuffs()
      .some(
        (buff) =>
          buff.type === BuffType.CONTROL ||
          buff.tags.hasTag(GameplayTags.BUFF.TYPE.CONTROL),
      );
  }
}
