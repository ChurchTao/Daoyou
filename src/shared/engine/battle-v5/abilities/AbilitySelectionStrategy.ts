import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  DEFAULT_BATTLE_ABILITY_STRATEGY_SETTINGS,
  normalizeBattleAbilityStrategySettings,
  type BattleAbilityStrategyMode,
  type BattleAbilityStrategySettings,
  type BattleAbilityStrategyWeights,
} from '@shared/types/gameSettings';
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

const MODE_WEIGHTS: Record<
  BattleAbilityStrategyMode,
  BattleAbilityStrategyWeights
> = {
  balanced: {
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
  },
  aggressive: {
    damageBase: 45,
    damageExecuteScale: 70,
    healScale: 55,
    emergencyHealBonus: 95,
    restoreMpScale: 45,
    controlBonus: 25,
    controlLowHpPenalty: -35,
    buffBonus: 5,
    defensiveBase: 0,
    defensiveLowHpBonus: 15,
    shieldRepeatPenalty: -45,
  },
  conservative: {
    damageBase: 15,
    damageExecuteScale: 30,
    healScale: 120,
    emergencyHealBonus: 180,
    restoreMpScale: 90,
    controlBonus: 40,
    controlLowHpPenalty: -15,
    buffBonus: 15,
    defensiveBase: 15,
    defensiveLowHpBonus: 60,
    shieldRepeatPenalty: -20,
  },
};

export class DefaultAbilitySelectionStrategy implements AbilitySelectionStrategy {
  private readonly settings: BattleAbilityStrategySettings;
  private readonly weights: BattleAbilityStrategyWeights;

  constructor(settings?: BattleAbilityStrategySettings) {
    this.settings = normalizeBattleAbilityStrategySettings(
      settings ?? DEFAULT_BATTLE_ABILITY_STRATEGY_SETTINGS,
    );
    this.weights = {
      ...MODE_WEIGHTS[this.settings.mode],
      ...this.settings.weights,
    };
  }

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
      if (hpPercent >= this.settings.healHpSkipThreshold) return null;
      score +=
        hpPercent <= this.settings.emergencyHealHpThreshold
          ? this.weights.emergencyHealBonus
          : this.weights.healScale * (1 - hpPercent);
    }

    if (intents.includes('restore_mp')) {
      const mpPercent = caster.getMpPercent();
      if (mpPercent >= this.settings.restoreMpSkipThreshold) return null;
      score += this.weights.restoreMpScale * (1 - mpPercent);
    }

    if (intents.includes('control')) {
      if (
        (this.settings.avoidRepeatControl && this.targetHasControl(target)) ||
        target.tags.hasTag(GameplayTags.STATUS.IMMUNE.CONTROL)
      ) {
        return null;
      }
      score +=
        target.getHpPercent() <= 0.2
          ? this.weights.controlLowHpPenalty
          : this.weights.controlBonus;
    }

    if (intents.includes('damage')) {
      score +=
        this.weights.damageBase +
        (1 - target.getHpPercent()) * this.weights.damageExecuteScale;
    }

    if (intents.includes('buff')) {
      score += this.weights.buffBonus;
    }

    if (intents.includes('defensive')) {
      if (caster.getCurrentShield() > 0) {
        score += this.weights.shieldRepeatPenalty;
      }
      score +=
        caster.getHpPercent() <= 0.5
          ? this.weights.defensiveLowHpBonus
          : this.weights.defensiveBase;
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
