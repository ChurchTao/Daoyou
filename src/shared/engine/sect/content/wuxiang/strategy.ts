import type {
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { DefaultAbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { readAbilityMode } from '@shared/engine/battle-v5/core/runtimeState';
import { SectStrategyCandidates, type SectTacticId } from '../../core';
import {
  WUXIANG_FORM_MODE,
  WUXIANG_KARMA_BUFF,
  WUXIANG_SECT_ID,
  WUXIANG_WAR_INTENT,
} from './ids';

abstract class WuxiangSelectionStrategy implements AbilitySelectionStrategy {
  constructor(protected readonly tacticId: SectTacticId) {}

  abstract select(
    context: AbilitySelectionContext,
  ): AbilitySelectionResult | null;

  protected result(
    context: AbilitySelectionContext,
    priorities: readonly string[],
    score = 500,
  ): AbilitySelectionResult | null {
    const index = new SectStrategyCandidates(
      WUXIANG_SECT_ID,
      context.candidates,
    );
    for (const id of priorities) {
      const result = index.result(id, score);
      if (result) return result;
    }
    const fallback = context.candidates[0];
    return fallback
      ? { ability: fallback.ability, target: fallback.target, score: 100 }
      : null;
  }

  protected pickAvailable(
    context: AbilitySelectionContext,
    priorities: readonly string[],
    score = 500,
  ): AbilitySelectionResult | null {
    const index = new SectStrategyCandidates(
      WUXIANG_SECT_ID,
      context.candidates,
    );
    for (const id of priorities) {
      const result = index.result(id, score);
      if (result) return result;
    }
    return null;
  }
}

export class WuxiangBaseSelectionStrategy extends WuxiangSelectionStrategy {
  private readonly fallback = new DefaultAbilitySelectionStrategy();

  constructor() {
    super('base');
  }

  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const mode = readAbilityMode(context.caster, WUXIANG_FORM_MODE);
    const war = context.caster.combatResources.getCurrent(WUXIANG_WAR_INTENT);
    const hp = context.caster.getHpPercent();
    const defensive = ['blood-tide', 'observe-calamity', 'reed-crossing'];
    const offensive = [
      'three-knocks',
      'five-skandhas',
      'blood-tide',
      'observe-calamity',
    ];

    if (mode?.mode === 'demon' || mode?.mode === 'formless') {
      const transformed = this.pickAvailable(
        context,
        hp < 0.5 ? defensive : offensive,
        760,
      );
      if (transformed) return transformed;
    } else {
      if (hp < 0.5) {
        const guard = this.pickAvailable(context, defensive, 780);
        if (guard) return guard;
      }
      if (war >= 6) {
        const transform = this.pickAvailable(context, ['turn-form'], 800);
        if (transform) return transform;
      }
      const builder = this.pickAvailable(
        context,
        [
          'three-knocks',
          'blood-tide',
          'observe-calamity',
          'five-skandhas',
          'reed-crossing',
        ],
        600,
      );
      if (builder) return builder;
    }

    const index = new SectStrategyCandidates(
      WUXIANG_SECT_ID,
      context.candidates,
    );
    const turnForm = index.find('turn-form');
    const fallbackCandidates = turnForm
      ? context.candidates.filter((candidate) => candidate !== turnForm)
      : context.candidates;
    return fallbackCandidates.length > 0
      ? this.fallback.select({ ...context, candidates: fallbackCandidates })
      : null;
  }
}

export class WuxiangMirrorSelectionStrategy extends WuxiangSelectionStrategy {
  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const mode = readAbilityMode(context.caster, WUXIANG_FORM_MODE);
    const war = context.caster.combatResources.getCurrent(WUXIANG_WAR_INTENT);
    const karma =
      context.caster.buffs
        .getAllBuffs()
        .find((buff) => buff.id === WUXIANG_KARMA_BUFF)
        ?.getLayer() ?? 0;
    if (mode?.mode === 'demon') {
      const priorities =
        this.tacticId === 'guard'
          ? ['observe-calamity', 'reed-crossing', 'blood-tide', 'three-knocks']
          : [
              'three-knocks',
              'flower-heart',
              'five-skandhas',
              'observe-calamity',
            ];
      return this.result(context, priorities, 720);
    }
    if (mode?.mode === 'formless') {
      return this.result(
        context,
        ['three-knocks', 'flower-heart', 'observe-calamity', 'blood-tide'],
        760,
      );
    }
    const shouldTurn =
      this.tacticId === 'guard'
        ? war >= 5
        : this.tacticId === 'present'
          ? war >= 3 && karma >= 1
          : war >= 6 || (war >= 3 && context.caster.getHpPercent() < 0.35);
    if (shouldTurn) return this.result(context, ['turn-form'], 800);
    if (this.tacticId === 'guard' && karma < 3) {
      return this.result(context, [
        'blood-tide',
        'observe-calamity',
        'reed-crossing',
        'flower-heart',
      ]);
    }
    return this.result(context, [
      'flower-heart',
      'three-knocks',
      'five-skandhas',
      'blood-tide',
    ]);
  }
}

export class WuxiangDemonSelectionStrategy extends WuxiangSelectionStrategy {
  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const mode = readAbilityMode(context.caster, WUXIANG_FORM_MODE);
    const war = context.caster.combatResources.getCurrent(WUXIANG_WAR_INTENT);
    const hp = context.caster.getHpPercent();
    if (mode?.mode === 'demon') {
      return this.result(
        context,
        hp < 0.3
          ? ['reed-crossing', 'observe-calamity', 'blood-tide', 'five-skandhas']
          : ['three-knocks', 'flower-heart', 'blood-tide', 'observe-calamity'],
        720,
      );
    }
    if (mode?.mode === 'formless') {
      return this.result(
        context,
        hp < 0.3
          ? [
              'reed-crossing',
              'three-knocks',
              'flower-heart',
              'observe-calamity',
            ]
          : ['three-knocks', 'flower-heart', 'blood-tide', 'observe-calamity'],
        760,
      );
    }
    const shouldTurn =
      this.tacticId === 'trial-fire'
        ? war >= 3 && hp < 0.6
        : this.tacticId === 'sink-boat'
          ? war >= 5 && hp < 0.45
          : war >= 6 || (war >= 3 && hp < 0.25);
    if (shouldTurn) return this.result(context, ['turn-form'], 800);
    return this.result(
      context,
      this.tacticId === 'sink-boat'
        ? ['blood-tide', 'three-knocks', 'observe-calamity', 'flower-heart']
        : ['three-knocks', 'blood-tide', 'observe-calamity', 'flower-heart'],
    );
  }
}
