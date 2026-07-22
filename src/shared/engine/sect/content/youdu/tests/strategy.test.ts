import { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import type { AbilitySelectionContext } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { AbilityType, AttributeType, BuffType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { resolveSectAbility } from '../..';
import {
  YOUDU_FORGETFUL_RIVER,
  YOUDU_SOUL_EROSION,
  YOUDU_SOUL_FIRE,
} from '..';
import { YouduTideSelectionStrategy } from '../strategy';
import { youduState } from './testState';

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.WISDOM]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

function addTargetState(target: Unit, erosionLayers: number): void {
  const erosion = BuffFactory.create({
    id: YOUDU_SOUL_EROSION,
    name: '蚀魂',
    type: BuffType.DEBUFF,
    duration: 3,
    stackRule: StackRule.STACK_LAYER,
    maxLayers: 5,
  });
  erosion.setLayer(erosionLayers);
  target.buffs.addBuff(erosion);
  target.buffs.addBuff(BuffFactory.create({
    id: YOUDU_FORGETFUL_RIVER,
    name: '忘川',
    type: BuffType.DEBUFF,
    duration: 2,
    stackRule: StackRule.REFRESH_DURATION,
  }));
}

function selectionContext(
  abilityIds: string[],
  erosionLayers: number,
): AbilitySelectionContext {
  const caster = unit('caster');
  const opponent = unit('opponent');
  caster.combatResources.define({
    id: YOUDU_SOUL_FIRE,
    name: '魂火',
    initial: 0,
    max: 3,
  });
  addTargetState(opponent, erosionLayers);
  return {
    caster,
    opponent,
    candidates: abilityIds.map((abilityId, order) => ({
      ability: AbilityFactory.create(resolveSectAbility({
        sect: youduState('tide'),
        realm: '化神',
        abilityId,
      }).config) as ActiveSkill,
      target: opponent,
      order,
    })),
  };
}

function addHealingAbility(opponent: Unit, cooldown: number): ActiveSkill {
  const heal = AbilityFactory.create({
    slug: `test.heal.${cooldown}`,
    name: '测试治疗',
    type: AbilityType.ACTIVE_SKILL,
    cooldown,
    targetPolicy: { team: 'self', scope: 'single' },
    selectionProfile: { intents: ['heal_hp'] },
    tags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effects: [{
      type: 'heal',
      params: { value: { base: 100 }, target: 'hp', recipient: 'caster' },
    }],
  }) as ActiveSkill;
  opponent.abilities.addAbility(heal);
  if (cooldown > 0) heal.startCooldown();
  return heal;
}

describe('幽都自动战术', () => {
  it('溺疗只在敌方治疗冷却不超过1回合时优先镇魂', () => {
    const strategy = new YouduTideSelectionStrategy('healer-drown');
    const context = selectionContext(
      ['soul-severing-call', 'seize-soul', 'pin-soul'],
      3,
    );

    expect(strategy.select(context)?.ability.id).toBe(
      'sect.youdu.soul-severing-call',
    );
    const heal = addHealingAbility(context.opponent!, 2);
    expect(strategy.select(context)?.ability.id).toBe(
      'sect.youdu.soul-severing-call',
    );
    heal.tickCooldown();
    expect(strategy.select(context)?.ability.id).toBe('sect.youdu.pin-soul');
  });

  it('长夜在四层时优先照影并在无安全技能时返回普通攻击', () => {
    const strategy = new YouduTideSelectionStrategy('long-night');
    const withShadow = selectionContext(
      ['soul-severing-call', 'reveal-shadow', 'soul-shall-not-return'],
      4,
    );
    expect(strategy.select(withShadow)?.ability.id).toBe(
      'sect.youdu.reveal-shadow',
    );

    const wait = selectionContext(['soul-severing-call'], 4);
    expect(strategy.select(wait)).toBeNull();

    withShadow.caster.combatResources.set(YOUDU_SOUL_FIRE, 3);
    expect(strategy.select(withShadow)?.ability.id).toBe(
      'sect.youdu.soul-shall-not-return',
    );
  });
});
