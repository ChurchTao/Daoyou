import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { BasicAttack } from '@shared/engine/battle-v5/abilities/BasicAttack';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type {
  AbilityCostPaidEvent,
  DamageRequestEvent,
  DamageTakenEvent,
} from '@shared/engine/battle-v5/core/events';
import {
  beginRuntimeAction,
  clearAbilityMode,
  readAbilityMode,
  setAbilityMode,
} from '@shared/engine/battle-v5/core/runtimeState';
import { AttributeType, BuffType, DamageSource, DamageType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { BattleStateRecorder } from '@shared/engine/battle-v5/systems/state/BattleStateRecorder';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectSectCombat, resolveSectAbility } from '../..';
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

  it('明镜进入魔相后遗留业门不会自动反伤或消耗', () => {
    const { owner, enemy, skill } = install('mirror-karma');
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 3);
    cast(skill('three-knocks'), owner, enemy);
    const doorId = 'sect.wuxiang.mirror.karma-door';
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === doorId)?.getLayer()).toBe(3);
    cast(skill('turn-form'), owner, owner);
    const reflected: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      if (event.damageSource === DamageSource.REFLECT) reflected.push(event);
    });

    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent', timestamp: Date.now(), caster: enemy, target: owner,
      damageSource: DamageSource.DIRECT, damageType: DamageType.PHYSICAL,
      damageTaken: 100, beforeHp: owner.getCurrentHp(), remainHp: owner.getCurrentHp(),
      isLethal: false,
    });

    expect(reflected).toHaveLength(0);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === doorId)?.getLayer()).toBe(3);
  });

  it('焚尽五蕴默认入魔只转移1个减益，五蕴作薪提高至3个', () => {
    const execute = (nodes: string[]) => {
      const sect = state('demon-crossing', nodes);
      const owner = unit(`owner-${nodes.length}`);
      const enemy = unit(`enemy-${nodes.length}`);
      const config = resolveSectAbility({ sect, realm: '化神', abilityId: 'five-skandhas' }).config;
      const skill = AbilityFactory.create(config) as ActiveSkill;
      skill.setOwner(owner);
      skill.setActive(true);
      setAbilityMode(owner, {
        key: WUXIANG_FORM_MODE, mode: 'demon', phase: 1,
        remainingUses: 2, displayName: '魔相',
      });
      for (let index = 0; index < 3; index += 1) {
        owner.buffs.addBuff(BuffFactory.create({
          id: `negative-${index}`, name: `减益${index}`, type: BuffType.DEBUFF,
          duration: 3, stackRule: StackRule.OVERRIDE,
        }), enemy);
      }
      cast(skill, owner, enemy);
      return enemy.buffs.getAllBuffs().filter((buff) => buff.type === BuffType.DEBUFF).length;
    };

    expect(execute([])).toBe(1);
    expect(execute(['demon-skandhas-fuel'])).toBe(3);
  });

  it('万业同门按实际消费两层业痕递归强化业门引爆', () => {
    const { owner, enemy, skill } = install('mirror-karma', ['mirror-all-karma']);
    const knocks = skill('three-knocks');
    cast(knocks, owner, enemy);
    knocks.resetCooldown();
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE, mode: 'demon', phase: 2,
      remainingUses: 1, displayName: '魔相·现报',
    });
    const karma = BuffFactory.create({
      id: WUXIANG_KARMA_BUFF, name: '业痕', type: BuffType.BUFF,
      duration: -1, stackRule: StackRule.STACK_LAYER, maxLayers: 3,
    });
    owner.buffs.addBuff(karma, owner);
    owner.buffs.addBuff(karma.clone(), owner);
    const segments: number[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      const segment = event.damageComponents?.find((component) =>
        component.segmentMultiplier !== undefined)?.segmentMultiplier;
      if (event.caster === owner && segment !== undefined) segments.push(segment);
    });

    cast(knocks, owner, enemy);

    expect(segments).toEqual([0.75, 0.64, 0.64, 0.64]);
    expect(owner.buffs.getAllBuffIds()).not.toContain(WUXIANG_KARMA_BUFF);
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

  it('身坏心明在佛相低气血时实时生效，治疗或进入任一非佛相后立即移除', () => {
    const { owner, enemy, skill } = install('demon-crossing', ['demon-body-breaks']);
    const buffId = 'sect.wuxiang.demon.body-breaks';
    owner.setHp(Math.floor(owner.getMaxHp() * 0.25));
    expect(owner.buffs.getAllBuffIds()).toContain(buffId);

    owner.heal(Math.floor(owner.getMaxHp() * 0.5));
    expect(owner.buffs.getAllBuffIds()).not.toContain(buffId);

    owner.setHp(Math.floor(owner.getMaxHp() * 0.25));
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 3);
    cast(skill('turn-form'), owner, owner);
    expect(owner.buffs.getAllBuffIds()).not.toContain(buffId);

    clearAbilityMode(owner, WUXIANG_FORM_MODE);
    owner.setHp(Math.floor(owner.getMaxHp() * 0.25));
    expect(owner.buffs.getAllBuffIds()).toContain(buffId);
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 6);
    cast(skill('turn-form'), owner, owner);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ mode: 'formless' });
    expect(owner.buffs.getAllBuffIds()).not.toContain(buffId);
  });

  it.each([
    ['mirror-karma', 'mirror-vow-body'],
    ['demon-crossing', 'demon-blood-oil'],
  ] as const)('%s每轮首次佛相成本提高2个百分点且只多得1战意', (pathId, nodeId) => {
    const { owner, enemy, defaultAttack } = install(pathId, [nodeId]);
    const paid: AbilityCostPaidEvent[] = [];
    EventBus.instance.subscribe<AbilityCostPaidEvent>('AbilityCostPaidEvent', (event) => {
      if (event.ability === defaultAttack) paid.push(event);
    });

    const firstHp = owner.getCurrentHp();
    cast(defaultAttack, owner, enemy);
    const secondHp = owner.getCurrentHp();
    cast(defaultAttack, owner, enemy);

    const baseCost = pathId === 'mirror-karma' ? 0.05 : 0.06;
    expect(paid.map((event) => event.hpPaid)).toEqual([
      Math.ceil(firstHp * (baseCost + 0.02)),
      Math.ceil(secondHp * baseCost),
    ]);
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(3);

    EventBus.instance.publish({ type: 'RoundStartEvent', timestamp: Date.now(), turn: 2 });
    const nextRoundHp = owner.getCurrentHp();
    cast(defaultAttack, owner, enemy);
    expect(paid[2].hpPaid).toBe(Math.ceil(nextRoundHp * (baseCost + 0.02)));
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(5);
  });

  it('镜中留客每轮只为首次直接受击额外留下1层业痕', () => {
    const { owner, enemy } = install('mirror-karma', ['mirror-guest-in-mirror']);
    const hit = () => EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent', timestamp: Date.now(), caster: enemy, target: owner,
      damageSource: DamageSource.DIRECT, damageType: DamageType.PHYSICAL,
      damageTaken: 100, beforeHp: owner.getCurrentHp(), remainHp: owner.getCurrentHp(),
      isLethal: false,
    });

    beginRuntimeAction(enemy);
    hit();
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === WUXIANG_KARMA_BUFF)?.getLayer()).toBe(2);
    owner.buffs.removeBuff(WUXIANG_KARMA_BUFF);
    beginRuntimeAction(enemy);
    hit();
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === WUXIANG_KARMA_BUFF)?.getLayer()).toBe(1);
  });

  it('两门同渡只在第二门使用不同神通时将冻结气血成本减半', () => {
    const { owner, enemy, defaultAttack, skill } = install('demon-crossing', ['demon-two-gates']);
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE, mode: 'demon', phase: 1,
      remainingUses: 2, displayName: '魔相·入魔式',
    });
    cast(defaultAttack, owner, enemy);
    const beforeDifferent = owner.getCurrentHp();
    const knocks = skill('three-knocks');
    cast(knocks, owner, enemy);
    expect(beforeDifferent - owner.getCurrentHp()).toBe(Math.ceil(beforeDifferent * 0.04));

    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE, mode: 'demon', phase: 1,
      remainingUses: 2, displayName: '魔相·入魔式',
    });
    cast(defaultAttack, owner, enemy);
    const beforeSame = owner.getCurrentHp();
    cast(defaultAttack, owner, enemy);
    expect(beforeSame - owner.getCurrentHp()).toBe(Math.ceil(beforeSame * 0.05));
  });

  it('渡后留舟令下一门佛相成本减半且不产生战意', () => {
    const { owner, enemy, defaultAttack } = install('demon-crossing', ['demon-leave-boat']);
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE, mode: 'demon', phase: 2,
      remainingUses: 1, displayName: '魔相·渡厄式',
    });
    cast(defaultAttack, owner, enemy);
    const beforeBuddha = owner.getCurrentHp();
    cast(defaultAttack, owner, enemy);

    expect(beforeBuddha - owner.getCurrentHp()).toBe(Math.ceil(beforeBuddha * 0.03));
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);
    expect(owner.buffs.getAllBuffIds()).not.toContain('sect.wuxiang.demon.leave-boat');
  });

  it('回首彼岸只在每次转相的渡厄结算后低血恢复5%', () => {
    const { owner, enemy, defaultAttack } = install('demon-crossing', ['demon-look-back']);
    const maxHp = owner.getMaxHp();
    owner.setHp(Math.floor(maxHp * 0.19));
    const finish = () => {
      setAbilityMode(owner, {
        key: WUXIANG_FORM_MODE, mode: 'demon', phase: 2,
        remainingUses: 1, displayName: '魔相·渡厄式',
      });
      const before = owner.getCurrentHp();
      cast(defaultAttack, owner, enemy);
      return { before, after: owner.getCurrentHp() };
    };

    const first = finish();
    expect(first.after).toBe(first.before - Math.ceil(first.before * 0.05) + Math.round(maxHp * 0.05));
    const beforeBuddha = owner.getCurrentHp();
    cast(defaultAttack, owner, enemy);
    expect(owner.getCurrentHp()).toBe(beforeBuddha - Math.ceil(beforeBuddha * 0.06));

    owner.setHp(Math.floor(maxHp * 0.19));
    const second = finish();
    expect(second.after).toBe(second.before - Math.ceil(second.before * 0.05) + Math.round(maxHp * 0.05));
  });

  it('来去一念在无相后返还2战意，下一门佛相增加3个百分点气血成本', () => {
    const { owner, enemy, defaultAttack } = install('mirror-karma', ['mirror-return-thought']);
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE, mode: 'formless', phase: 1,
      remainingUses: 1, displayName: '无相待发',
    });
    cast(defaultAttack, owner, enemy);
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(2);

    const beforeBuddha = owner.getCurrentHp();
    cast(defaultAttack, owner, enemy);
    expect(beforeBuddha - owner.getCurrentHp()).toBe(Math.ceil(beforeBuddha * 0.08));
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
