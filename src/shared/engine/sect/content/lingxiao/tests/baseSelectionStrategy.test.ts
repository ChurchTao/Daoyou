import type { AbilitySelectionCandidate } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { AttributeType, BuffType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { describe, expect, it } from 'vitest';
import { LINGXIAO_SWORD_MOMENTUM, LingxiaoBaseSelectionStrategy } from '..';
import { projectSectCombat, resolveSectAbility } from '../..';
import type { CultivatorSectState } from '../../../core';

function state(): CultivatorSectState {
  return {
    membershipId: 'lingxiao-base',
    sectId: 'lingxiao',
    status: 'active',
    contribution: 0,
    configVersion: 4,
    methods: {
      'lingxiao-canon': 100,
      'sword-guidance': 100,
      'void-step': 100,
      'edge-cleansing': 100,
      'origin-returning': 100,
      'sword-nurturing': 100,
    },
    paths: [],
    abilityLoadout: [
      'guiding-sword',
      'linked-edge',
      'breaking-edge',
      'sect-ultimate',
    ],
  };
}

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.WISDOM]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

function context(abilityIds: string[]) {
  const caster = unit('caster');
  const opponent = unit('opponent');
  caster.combatResources.define({
    id: LINGXIAO_SWORD_MOMENTUM,
    name: '剑意',
    initial: 0,
    max: 6,
  });
  const candidates: AbilitySelectionCandidate[] = abilityIds.map(
    (abilityId, order) => {
      const ability = AbilityFactory.create(
        resolveSectAbility({
          sect: state(),
          realm: '化神',
          abilityId,
        }).config,
      ) as ActiveSkill;
      ability.setOwner(caster);
      ability.setActive(true);
      return {
        ability,
        target: ability.targetPolicy.team === 'enemy' ? opponent : caster,
        order,
      };
    },
  );
  return { caster, opponent, candidates };
}

describe('凌霄基础施法策略', () => {
  const strategy = new LingxiaoBaseSelectionStrategy();

  it('未选择流派时投影基础策略，并在剑意满时使用终结技', () => {
    expect(
      projectSectCombat({ sect: state(), realm: '化神' })?.selectionStrategy,
    ).toBeInstanceOf(LingxiaoBaseSelectionStrategy);
    const battle = context(['guiding-sword', 'sect-ultimate']);
    battle.caster.combatResources.set(LINGXIAO_SWORD_MOMENTUM, 6);

    expect(strategy.select(battle)?.ability.id).toBe(
      'sect.lingxiao.sect-ultimate',
    );
  });

  it('低血时优先防御，并在普通状态使用连招和起手式攒剑意', () => {
    const lowHp = context(['guiding-sword', 'sword-aegis', 'turning-body']);
    lowHp.caster.setHp(Math.floor(lowHp.caster.getMaxHp() * 0.5));
    expect(strategy.select(lowHp)?.ability.id).toBe(
      'sect.lingxiao.turning-body',
    );

    const standard = context(['guiding-sword', 'linked-edge']);
    expect(strategy.select(standard)?.ability.id).toBe(
      'sect.lingxiao.linked-edge',
    );
  });

  it('敌方存在可驱散增益时优先一剑破妄', () => {
    const battle = context(['guiding-sword', 'breaking-edge']);
    battle.opponent.buffs.addBuff(
      BuffFactory.create({
        id: 'test.dispellable',
        name: '可驱散增益',
        type: BuffType.BUFF,
        duration: 2,
      }),
    );

    expect(strategy.select(battle)?.ability.id).toBe(
      'sect.lingxiao.breaking-edge',
    );
  });

  it('没有可用主动技能时返回默认攻击', () => {
    expect(strategy.select(context([]))).toBeNull();
  });
});
