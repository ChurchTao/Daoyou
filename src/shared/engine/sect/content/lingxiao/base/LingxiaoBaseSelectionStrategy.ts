import {
  DefaultAbilitySelectionStrategy,
  type AbilitySelectionContext,
  type AbilitySelectionResult,
  type AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { AttributeType, BuffType } from '@shared/engine/battle-v5/core/types';
import { SectStrategyCandidates } from '../../../core';
import { LINGXIAO_SECT_ID } from '../ids';
import { LINGXIAO_SWORD_MOMENTUM } from '../shared/LingxiaoMechanics';

const BUFF_IDS = {
  clearHeart: 'sect.lingxiao.clear-heart',
  swordIntent: 'sect.lingxiao.sword-intent',
  tracelessStep: 'sect.lingxiao.traceless-step',
} as const;

export class LingxiaoBaseSelectionStrategy implements AbilitySelectionStrategy {
  private readonly fallback = new DefaultAbilitySelectionStrategy();

  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const { caster, opponent, candidates } = context;
    if (!opponent || candidates.length === 0) return null;

    const index = new SectStrategyCandidates(LINGXIAO_SECT_ID, candidates);
    const momentum = caster.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM);
    const buffs = new Set(caster.buffs.getAllBuffIds());
    const result = (abilityId: string, score: number) =>
      index.result(abilityId, score);

    if (momentum >= 3 && opponent.getHpPercent() < 0.25) {
      const execute = result('sect-ultimate', 900);
      if (execute) return execute;
    }

    if (caster.getHpPercent() < 0.6) {
      const guard =
        result('turning-body', 850) ??
        (!buffs.has(BUFF_IDS.clearHeart) ? result('sword-aegis', 840) : null);
      if (guard) return guard;
    }

    if (momentum >= 6) {
      const finisher = result('sect-ultimate', 800);
      if (finisher) return finisher;
    }

    if (
      opponent.buffs
        .getAllBuffs()
        .some(
          (buff) =>
            buff.type === BuffType.BUFF &&
            buff.countsAsStatus &&
            buff.dispelPolicy === 'normal',
        )
    ) {
      const dispel = result('breaking-edge', 700);
      if (dispel) return dispel;
    }

    if (!buffs.has(BUFF_IDS.swordIntent)) {
      const nurture = result('nurturing-sword', 600);
      if (nurture) return nurture;
    }

    if (
      !buffs.has(BUFF_IDS.tracelessStep) &&
      caster.attributes.getValue(AttributeType.SPEED) <=
        opponent.attributes.getValue(AttributeType.SPEED)
    ) {
      const step = result('shadow-step', 550);
      if (step) return step;
    }

    const standard = result('linked-edge', 450) ?? result('guiding-sword', 400);
    return standard ?? this.fallback.select(context);
  }
}
