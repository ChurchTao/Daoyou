import type { AbilitySelectionCandidate } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { setAbilityMode } from '@shared/engine/battle-v5/core/runtimeState';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { describe, expect, it } from 'vitest';
import {
  WUXIANG_FORM_MODE,
  WUXIANG_WAR_INTENT,
  WuxiangBaseSelectionStrategy,
} from '..';
import { projectSectCombat, resolveSectAbility } from '../..';
import type { CultivatorSectState } from '../../../core';

function state(): CultivatorSectState {
  return {
    membershipId: 'wuxiang-base',
    sectId: 'wuxiang',
    status: 'active',
    contribution: 0,
    configVersion: 2,
    methods: {
      'wuxiang-canon': 5,
      'blood-lotus': 3,
      'white-bone': 3,
      'wrathful-ming': 3,
      'six-senses': 3,
      'reed-crossing-method': 3,
    },
    paths: [],
    abilityLoadout: [
      'turn-form',
      'blood-tide',
      'three-knocks',
      'observe-calamity',
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
    id: WUXIANG_WAR_INTENT,
    name: '心念',
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

describe('无相基础施法策略', () => {
  const strategy = new WuxiangBaseSelectionStrategy();

  it('未选择流派时投影基础策略，三点心念不会提前转相', () => {
    expect(
      projectSectCombat({ sect: state(), realm: '化神' })?.selectionStrategy,
    ).toBeInstanceOf(WuxiangBaseSelectionStrategy);
    const battle = context(['turn-form', 'three-knocks']);
    battle.caster.combatResources.set(WUXIANG_WAR_INTENT, 3);

    expect(strategy.select(battle)?.ability.id).toBe(
      'sect.wuxiang.three-knocks',
    );
  });

  it('心念达到六点时进入无相', () => {
    const battle = context(['three-knocks', 'turn-form']);
    battle.caster.combatResources.set(WUXIANG_WAR_INTENT, 6);

    expect(strategy.select(battle)?.ability.id).toBe('sect.wuxiang.turn-form');
  });

  it('普通状态低血优先防御', () => {
    const battle = context(['three-knocks', 'blood-tide', 'observe-calamity']);
    battle.caster.setHp(Math.floor(battle.caster.getMaxHp() * 0.4));

    expect(strategy.select(battle)?.ability.id).toBe('sect.wuxiang.blood-tide');
  });

  it('无相显化后按血线选择进攻或防御神通', () => {
    const offensive = context(['blood-tide', 'three-knocks']);
    setAbilityMode(offensive.caster, {
      key: WUXIANG_FORM_MODE,
      mode: 'formless',
      remainingUses: 1,
      displayName: '一念无间',
    });
    expect(strategy.select(offensive)?.ability.id).toBe(
      'sect.wuxiang.three-knocks',
    );

    const defensive = context(['three-knocks', 'blood-tide']);
    defensive.caster.setHp(Math.floor(defensive.caster.getMaxHp() * 0.4));
    setAbilityMode(defensive.caster, {
      key: WUXIANG_FORM_MODE,
      mode: 'formless',
      remainingUses: 1,
      displayName: '一念无间',
    });
    expect(strategy.select(defensive)?.ability.id).toBe(
      'sect.wuxiang.blood-tide',
    );
  });
});
