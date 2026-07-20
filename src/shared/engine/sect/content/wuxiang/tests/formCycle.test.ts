import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type { DamageRequestEvent, DamageTakenEvent } from '@shared/engine/battle-v5/core/events';
import { beginRuntimeAction, readAbilityMode } from '@shared/engine/battle-v5/core/runtimeState';
import { AttributeType, DamageSource, DamageType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectSectCombat } from '../..';
import type { CultivatorSectState } from '../../../core';
import { WUXIANG_FORM_MODE, WUXIANG_KARMA_BUFF, WUXIANG_WAR_INTENT } from '..';

function state(pathId: 'mirror-karma' | 'demon-crossing'): CultivatorSectState {
  return {
    membershipId: 'runtime', sectId: 'wuxiang', status: 'active', contribution: 0,
    configVersion: 1, activePathId: pathId,
    methods: {
      'wuxiang-canon': 100, 'blood-lotus': 100, 'white-bone': 100,
      'wrathful-ming': 100, 'six-senses': 100, 'reed-crossing-method': 100,
    },
    paths: [{
      pathId, unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
      tacticId: pathId === 'mirror-karma' ? 'guard' : 'trial-fire', activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds: [], version: 1 },
        { slot: 2, nodeIds: [], version: 1 },
        { slot: 3, nodeIds: [], version: 1 },
      ],
    }],
    abilityLoadout: ['turn-form', 'blood-tide', 'three-knocks', 'observe-calamity'],
  };
}

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100, [AttributeType.SPIRIT]: 100,
    [AttributeType.WISDOM]: 100, [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

function install(pathId: 'mirror-karma' | 'demon-crossing') {
  const projection = projectSectCombat({ sect: state(pathId), realm: '化神' })!;
  const owner = unit('owner');
  const enemy = unit('enemy');
  for (const resource of projection.resources) owner.combatResources.define(resource);
  const defaultAttack = AbilityFactory.create(projection.defaultAttack!) as ActiveSkill;
  defaultAttack.setOwner(owner);
  defaultAttack.setActive(true);
  for (const config of projection.abilities) owner.abilities.addAbility(AbilityFactory.create(config));
  const skill = (id: string) => owner.abilities.getAbility(`sect.wuxiang.${id}`) as ActiveSkill;
  return { owner, enemy, defaultAttack, skill };
}

function cast(skill: ActiveSkill, caster: Unit, target: Unit, hit = true) {
  skill.prepareCast({ caster, target });
  skill.execute({ caster, target, shouldApplyEffects: hit });
}

describe('无相禅宗三相循环', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it('魔相只推进成功的两门宗门神通，期间停止获得战意', () => {
    const { owner, enemy, defaultAttack, skill } = install('demon-crossing');
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 3);
    cast(skill('turn-form'), owner, owner);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ mode: 'demon', phase: 1, remainingUses: 2 });
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);

    cast(defaultAttack, owner, enemy, false);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ phase: 1, remainingUses: 2 });
    cast(defaultAttack, owner, enemy);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ phase: 2, remainingUses: 1 });
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);
    cast(skill('three-knocks'), owner, enemy);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toBeUndefined();
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);
  });

  it('6点战意优先进入无相且只消费下一门神通一次', () => {
    const { owner, enemy, defaultAttack, skill } = install('mirror-karma');
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 6);
    expect(skill('turn-form').name).toBe('一念无间');
    cast(skill('turn-form'), owner, owner);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ mode: 'formless', remainingUses: 1 });
    expect(defaultAttack.name).toBe('心花两忘');
    cast(defaultAttack, owner, enemy);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toBeUndefined();
    expect(defaultAttack.name).toBe('拈花叩心');
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === WUXIANG_KARMA_BUFF)?.getLayer()).toBe(1);
  });

  it('魔心的70%气血线只奖励一次，治疗后重复跨越不再获益', () => {
    const { owner, skill } = install('demon-crossing');
    const blood = skill('blood-tide');
    const startingHp = Math.floor(owner.getMaxHp() * 0.71);
    owner.setHp(startingHp);
    cast(blood, owner, owner);
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(2);

    owner.setHp(startingHp);
    blood.resetCooldown();
    cast(blood, owner, owner);
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(3);
  });

  it('明镜只响应敌方直接伤害，并按敌方行动共享反伤上限', () => {
    const { owner, enemy } = install('mirror-karma');
    const reflected: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      if (event.damageSource === DamageSource.REFLECT) reflected.push(event);
    });
    const hit = (source: DamageSource) => EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent', timestamp: Date.now(), caster: enemy, target: owner,
      damageSource: source, damageType: DamageType.PHYSICAL,
      damageTaken: owner.getMaxHp(), beforeHp: owner.getCurrentHp(),
      remainHp: owner.getCurrentHp(), isLethal: false,
    });

    beginRuntimeAction(enemy);
    hit(DamageSource.DIRECT);
    hit(DamageSource.DIRECT);
    hit(DamageSource.FOLLOW_UP);
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === WUXIANG_KARMA_BUFF)?.getLayer()).toBe(1);
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(1);
    expect(reflected.reduce((sum, event) => sum + event.finalDamage, 0)).toBe(Math.round(owner.getMaxHp() * 0.12));
  });
});
