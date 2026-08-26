import type { AbilitySelectionContext } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { readAbilityMode } from '@shared/engine/battle-v5/core/runtimeState';
import {
  SectStrategyCandidates,
  SectTacticalSelectionStrategy,
  type SectTacticId,
} from '../../core';
import {
  WUXIANG_FORM_MODE,
  WUXIANG_KARMA_BUFF,
  WUXIANG_SECT_ID,
  WUXIANG_WAR_INTENT,
} from './ids';

abstract class WuxiangSelectionStrategy extends SectTacticalSelectionStrategy {
  constructor(protected readonly tacticId: SectTacticId) {
    super(WUXIANG_SECT_ID);
  }

  protected ranked(
    _context: AbilitySelectionContext,
    priorities: readonly string[],
    score = 500,
  ) {
    return this.rankedFallback(priorities, undefined, score);
  }

  protected pickAvailable(
    context: AbilitySelectionContext,
    priorities: readonly string[],
    score = 500,
  ) {
    return this.firstAvailable(context, priorities, score);
  }
}

export class WuxiangBaseSelectionStrategy extends WuxiangSelectionStrategy {
  constructor() {
    super('base');
  }

  protected decide(context: AbilitySelectionContext) {
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
      if (transformed) return this.cast(transformed);
    } else {
      if (hp < 0.5) {
        const guard = this.pickAvailable(context, defensive, 780);
        if (guard) return this.cast(guard);
      }
      if (war >= 6) {
        const transform = this.pickAvailable(context, ['turn-form'], 800);
        if (transform) return this.cast(transform);
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
      if (builder) return this.cast(builder);
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
      ? this.fallback(fallbackCandidates)
      : this.defaultAttack();
  }
}

export class WuxiangMirrorSelectionStrategy extends WuxiangSelectionStrategy {
  protected decide(context: AbilitySelectionContext) {
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
      return this.ranked(context, priorities, 720);
    }
    if (mode?.mode === 'formless') {
      return this.ranked(
        context,
        ['three-knocks', 'flower-heart', 'observe-calamity', 'blood-tide'],
        760,
      );
    }
    const shouldTurn =
      war >= 6 ||
      (this.tacticId === 'guard'
        ? war >= 5 || (war >= 3 && karma >= 3)
        : this.tacticId === 'present'
          ? war >= 3 && karma >= 1
          : war >= 3 && context.caster.getHpPercent() < 0.35);
    if (shouldTurn) return this.ranked(context, ['turn-form'], 800);
    if (this.tacticId === 'guard' && karma < 3) {
      return this.ranked(context, [
        'blood-tide',
        'observe-calamity',
        'reed-crossing',
        'flower-heart',
      ]);
    }
    return this.ranked(context, [
      'flower-heart',
      'three-knocks',
      'five-skandhas',
      'blood-tide',
    ]);
  }
}

export class WuxiangDemonSelectionStrategy extends WuxiangSelectionStrategy {
  protected decide(context: AbilitySelectionContext) {
    const mode = readAbilityMode(context.caster, WUXIANG_FORM_MODE);
    const war = context.caster.combatResources.getCurrent(WUXIANG_WAR_INTENT);
    const hp = context.caster.getHpPercent();
    if (mode?.mode === 'demon') {
      return this.ranked(
        context,
        hp < 0.2
          ? ['reed-crossing', 'blood-tide', 'three-knocks', 'observe-calamity']
          : hp < 0.3
            ? [
                'three-knocks',
                'reed-crossing',
                'flower-heart',
                'observe-calamity',
              ]
            : [
                'three-knocks',
                'flower-heart',
                'blood-tide',
                'observe-calamity',
              ],
        720,
      );
    }
    if (mode?.mode === 'formless') {
      return this.ranked(
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
      war >= 6 ||
      (this.tacticId === 'trial-fire'
        ? war >= 3 && hp < 0.65
        : this.tacticId === 'sink-boat'
          ? war >= 5 && hp < 0.5
          : war >= 3 && hp < 0.3);
    if (shouldTurn) return this.ranked(context, ['turn-form'], 800);
    return this.ranked(
      context,
      this.tacticId === 'sink-boat'
        ? ['blood-tide', 'three-knocks', 'observe-calamity', 'flower-heart']
        : ['three-knocks', 'blood-tide', 'observe-calamity', 'flower-heart'],
    );
  }
}
