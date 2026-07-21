import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { BasicAttack } from '@shared/engine/battle-v5/abilities/BasicAttack';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type { DamageRequestEvent, DamageTakenEvent, HealEvent } from '@shared/engine/battle-v5/core/events';
import { beginRuntimeAction, readAbilityMode } from '@shared/engine/battle-v5/core/runtimeState';
import { AttributeType, DamageSource, DamageType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BattleStateRecorder } from '@shared/engine/battle-v5/systems/state/BattleStateRecorder';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectSectCombat } from '../..';
import type { CultivatorSectState } from '../../../core';
import { WUXIANG_FORM_MODE, WUXIANG_KARMA_BUFF, WUXIANG_WAR_INTENT } from '..';

function state(pathId: 'mirror-karma' | 'demon-crossing', nodes: string[] = []): CultivatorSectState {
  return {
    membershipId: 'runtime', sectId: 'wuxiang', status: 'active', contribution: 0,
    configVersion: 1, activePathId: pathId,
    methods: {
      'wuxiang-canon': 5, 'blood-lotus': 3, 'white-bone': 3,
      'wrathful-ming': 3, 'six-senses': 3, 'reed-crossing-method': 3,
    },
    paths: [{
      pathId, unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
      tacticId: pathId === 'mirror-karma' ? 'guard' : 'trial-fire', activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds: nodes, version: 1 },
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

function install(pathId: 'mirror-karma' | 'demon-crossing', nodes: string[] = []) {
  const projection = projectSectCombat({ sect: state(pathId, nodes), realm: '化神' })!;
  const owner = unit('owner');
  const enemy = unit('enemy');
  for (const resource of projection.resources) owner.combatResources.define(resource);
  const defaultAttack = AbilityFactory.create(projection.defaultAttack!) as ActiveSkill;
  owner.abilities.setDefaultAttack(defaultAttack);
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
    expect(owner.buffs.getAllBuffs().some((buff) => buff.name === '入魔')).toBe(true);
    const fist = new BasicAttack();
    fist.setOwner(owner);
    fist.setActive(true);
    cast(fist, owner, enemy);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ phase: 1, remainingUses: 2 });
    expect(owner.buffs.getAllBuffs().some((buff) => buff.name === '入魔')).toBe(true);
    cast(defaultAttack, owner, enemy);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ phase: 2, remainingUses: 1 });
    expect(owner.buffs.getAllBuffs().some((buff) => buff.name === '入魔')).toBe(false);
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);
    cast(skill('three-knocks'), owner, enemy);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toBeUndefined();
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);
  });

  it('明镜佛相只在宗门神通成功结算后获得战意', () => {
    const { owner, enemy, defaultAttack } = install('mirror-karma');
    cast(defaultAttack, owner, enemy, false);
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);
    cast(defaultAttack, owner, enemy, true);
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(1);
  });

  it('明镜魔相停止业痕、战意与即时反伤', () => {
    const { owner, enemy, skill } = install('mirror-karma');
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 3);
    cast(skill('turn-form'), owner, owner);
    const reflected: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      if (event.damageSource === DamageSource.REFLECT) reflected.push(event);
    });

    beginRuntimeAction(enemy);
    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent', timestamp: Date.now(), caster: enemy, target: owner,
      damageSource: DamageSource.DIRECT, damageType: DamageType.PHYSICAL,
      damageTaken: 100, beforeHp: owner.getCurrentHp(), remainHp: owner.getCurrentHp(),
      isLethal: false,
    });

    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === WUXIANG_KARMA_BUFF)).toBeUndefined();
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);
    expect(reflected).toHaveLength(0);
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

  it('默认神通进入战斗快照，并显示当前变体名称与实时气血成本', () => {
    const { owner, skill } = install('mirror-karma');
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 6);
    cast(skill('turn-form'), owner, owner);
    const recorder = new BattleStateRecorder();
    recorder.record('battle_init', 0, [owner]);
    const cooldowns = recorder.getFrames()[0].units[owner.id].cooldowns;
    const defaultSkill = cooldowns.find((entry) => entry.skillId === 'sect.wuxiang.flower-heart');

    expect(defaultSkill?.skillName).toBe('心花两忘');
    expect(defaultSkill?.description).toContain('设戒');
    expect(defaultSkill?.costs?.[0]).toMatchObject({
      resource: 'hp', mode: 'current_hp_ratio', ratio: 0.08,
      resolvedAmount: Math.ceil(owner.getCurrentHp() * 0.08),
    });
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

  it('身坏心明在佛相低气血时实时生效，治疗或转相后立即移除', () => {
    const { owner, enemy, skill } = install('demon-crossing', ['demon-body-breaks']);
    const buffId = 'sect.wuxiang.demon.body-breaks';
    owner.setHp(Math.floor(owner.getMaxHp() * 0.25));
    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent', timestamp: Date.now(), caster: enemy, target: owner,
      damageSource: DamageSource.DIRECT, damageType: DamageType.PHYSICAL,
      damageTaken: 1, beforeHp: owner.getCurrentHp() + 1,
      remainHp: owner.getCurrentHp(), isLethal: false,
    });
    expect(owner.buffs.getAllBuffIds()).toContain(buffId);

    owner.setHp(Math.floor(owner.getMaxHp() * 0.5));
    EventBus.instance.publish<HealEvent>({
      type: 'HealEvent', timestamp: Date.now(), caster: owner, target: owner,
      healAmount: 1, appliedAmount: 1, healType: 'hp',
    });
    expect(owner.buffs.getAllBuffIds()).not.toContain(buffId);

    owner.setHp(Math.floor(owner.getMaxHp() * 0.25));
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 3);
    cast(skill('turn-form'), owner, owner);
    expect(owner.buffs.getAllBuffIds()).not.toContain(buffId);
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
