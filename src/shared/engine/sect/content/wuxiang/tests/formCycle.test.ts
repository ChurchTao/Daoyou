import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { BasicAttack } from '@shared/engine/battle-v5/abilities/BasicAttack';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type { DamageRequestEvent, DamageTakenEvent } from '@shared/engine/battle-v5/core/events';
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
import {
  WUXIANG_FORM_MODE,
  WUXIANG_KARMA_BUFF,
  WUXIANG_WAR_INTENT,
} from '..';

type PathId = 'mirror-karma' | 'demon-crossing';

function state(pathId: PathId, nodes: string[] = []): CultivatorSectState {
  return {
    membershipId: 'runtime',
    sectId: 'wuxiang',
    status: 'active',
    contribution: 0,
    configVersion: 2,
    activePathId: pathId,
    methods: {
      'wuxiang-canon': 5,
      'blood-lotus': 3,
      'white-bone': 3,
      'wrathful-ming': 3,
      'six-senses': 3,
      'reed-crossing-method': 3,
    },
    paths: [{
      pathId,
      unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
      tacticId: pathId === 'mirror-karma' ? 'guard' : 'trial-fire',
      activeMeridianSlot: 1,
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
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.WISDOM]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

function install(pathId: PathId, nodes: string[] = []) {
  const projection = projectSectCombat({ sect: state(pathId, nodes), realm: '化神' })!;
  const owner = unit('owner');
  const enemy = unit('enemy');
  for (const resource of projection.resources) owner.combatResources.define(resource);
  const defaultAttack = AbilityFactory.create(projection.defaultAttack!) as ActiveSkill;
  owner.abilities.setDefaultAttack(defaultAttack);
  for (const config of projection.abilities) {
    owner.abilities.addAbility(AbilityFactory.create(config));
  }
  const skill = (id: string) => {
    const installed = owner.abilities.getAbility(`sect.wuxiang.${id}`);
    if (installed) return installed as ActiveSkill;
    const config = resolveSectAbility({ sect: state(pathId, nodes), realm: '化神', abilityId: id }).config;
    const created = AbilityFactory.create(config) as ActiveSkill;
    owner.abilities.addAbility(created);
    return created;
  };
  return { owner, enemy, defaultAttack, skill };
}

function cast(skill: ActiveSkill, caster: Unit, target: Unit, hit = true) {
  skill.prepareCast({ caster, target });
  skill.execute({ caster, target, shouldApplyEffects: hit });
}

function damageSegments(skill: ActiveSkill, action: () => void): number[] {
  const segments: number[] = [];
  const handler = EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
    if (event.ability !== skill) return;
    const segment = event.damageComponents?.find((component) =>
      component.segmentMultiplier !== undefined)?.segmentMultiplier;
    if (segment !== undefined) segments.push(segment);
  });
  action();
  EventBus.instance.unsubscribe('DamageRequestEvent', handler);
  return segments;
}

function addLayeredBuff(
  target: Unit,
  id: string,
  name: string,
  type: BuffType,
  layers: number,
): void {
  const template = BuffFactory.create({
    id,
    name,
    type,
    duration: 4,
    stackRule: StackRule.STACK_LAYER,
    maxLayers: Math.max(layers, 1),
  });
  for (let index = 0; index < layers; index += 1) {
    target.buffs.addBuff(index === 0 ? template : template.clone(), target);
  }
}

describe('无相禅宗三相循环', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it('3至5点战意进入两次魔相；未命中和非宗门技能都不消费次数', () => {
    const { owner, enemy, defaultAttack, skill } = install('demon-crossing');
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 3);
    cast(skill('turn-form'), owner, owner);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({
      mode: 'demon',
      remainingUses: 2,
    });
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);

    cast(defaultAttack, owner, enemy, false);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ remainingUses: 2 });
    const ordinaryAttack = new BasicAttack();
    ordinaryAttack.setOwner(owner);
    ordinaryAttack.setActive(true);
    cast(ordinaryAttack, owner, enemy);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ remainingUses: 2 });

    cast(defaultAttack, owner, enemy);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ remainingUses: 1 });
    cast(skill('three-knocks'), owner, enemy);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toBeUndefined();
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);
  });

  it('6点战意优先进入一次无相，下一门神通执行 A+B+C 后恢复佛相', () => {
    const { owner, enemy, defaultAttack, skill } = install('mirror-karma');
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 6);
    expect(skill('turn-form').name).toBe('一念无间');
    cast(skill('turn-form'), owner, owner);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({
      mode: 'formless',
      remainingUses: 1,
    });
    expect(defaultAttack.name).toBe('心花两忘');

    cast(defaultAttack, owner, enemy);

    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toBeUndefined();
    expect(defaultAttack.name).toBe('拈花叩心');
    expect(owner.combatResources.getCurrent(WUXIANG_WAR_INTENT)).toBe(0);
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === WUXIANG_KARMA_BUFF)?.getLayer())
      .toBe(1);
  });

  it('施法准备后改变形态，不会改变已冻结的本次效果计划', () => {
    const { owner, enemy, defaultAttack } = install('mirror-karma');
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      if (event.ability === defaultAttack) requests.push(event);
    });
    const karma = BuffFactory.create({
      id: WUXIANG_KARMA_BUFF,
      name: '业痕',
      type: BuffType.BUFF,
      duration: -1,
      stackRule: StackRule.STACK_LAYER,
      maxLayers: 3,
    });
    owner.buffs.addBuff(karma, owner);
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE,
      mode: 'demon',
      remainingUses: 2,
      displayName: '魔相',
    });
    defaultAttack.prepareCast({ caster: owner, target: enemy });
    clearAbilityMode(owner, WUXIANG_FORM_MODE);

    defaultAttack.execute({ caster: owner, target: enemy });

    expect(requests.length).toBeGreaterThan(1);
    expect(owner.buffs.getAllBuffIds()).not.toContain(WUXIANG_KARMA_BUFF);
  });

  it('明镜魔相没有业痕时只跳过 B 的消费后效果，A 与完成效果仍完整结算', () => {
    const { owner, enemy, defaultAttack } = install('mirror-karma');
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE,
      mode: 'demon',
      remainingUses: 2,
      displayName: '魔相',
    });

    const segments = damageSegments(defaultAttack, () =>
      cast(defaultAttack, owner, enemy));

    expect(segments).toEqual([0.6]);
    expect(enemy.buffs.getAllBuffIds()).toContain('sect.wuxiang.mirror.heart-vow');
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ remainingUses: 1 });
  });

  it('免费现报不被当作实际消费，不触发照还来处治疗', () => {
    const { owner, enemy, skill } = install('mirror-karma', [
      'mirror-back-demon',
      'mirror-return-source',
    ]);
    owner.setHp(Math.floor(owner.getMaxHp() * 0.5));
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 3);
    const beforeTurn = owner.getCurrentHp();
    cast(skill('turn-form'), owner, owner);
    const afterTurn = beforeTurn - Math.ceil(beforeTurn * 0.04);
    expect(owner.getCurrentHp()).toBe(afterTurn);

    cast(skill('flower-heart'), owner, enemy);

    expect(owner.getCurrentHp()).toBe(afterTurn - Math.ceil(afterTurn * 0.05));
  });

  it('倒叩先原子消费旧业门，随后佛相完成效果再留下全新的业门', () => {
    const { owner, enemy, skill } = install('mirror-karma');
    addLayeredBuff(enemy, 'sect.wuxiang.mirror.karma-door', '旧业门', BuffType.DEBUFF, 2);
    addLayeredBuff(owner, WUXIANG_KARMA_BUFF, '业痕', BuffType.BUFF, 1);
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE,
      mode: 'formless',
      remainingUses: 1,
      displayName: '无相',
    });
    const threeKnocks = skill('three-knocks');

    const segments = damageSegments(threeKnocks, () =>
      cast(threeKnocks, owner, enemy));

    expect(segments).toEqual([0.28, 0.28, 0.28, 0.25, 0.25, 0.35]);
    expect(enemy.buffs.getAllBuffs().find(
      (buff) => buff.id === 'sect.wuxiang.mirror.karma-door',
    )?.getLayer()).toBe(3);
  });

  it('无相观劫的两次直接减伤都生效，并各自触发一次魔相反击', () => {
    const { owner, enemy, skill } = install('mirror-karma');
    addLayeredBuff(owner, WUXIANG_KARMA_BUFF, '业痕', BuffType.BUFF, 1);
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE,
      mode: 'formless',
      remainingUses: 1,
      displayName: '无相',
    });
    cast(skill('observe-calamity'), owner, owner);

    const counters: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      if (event.damageSource === DamageSource.COUNTER) counters.push(event);
    });
    const reductions: number[] = [];
    for (let hit = 0; hit < 2; hit += 1) {
      const request: DamageRequestEvent = {
        type: 'DamageRequestEvent',
        timestamp: Date.now(),
        caster: enemy,
        target: owner,
        damageSource: DamageSource.DIRECT,
        damageType: DamageType.PHYSICAL,
        baseDamage: 100,
        finalDamage: 100,
      };
      EventBus.instance.publish(request);
      reductions.push(request.damageReductionPctBucket ?? 0);
      EventBus.instance.publish<DamageTakenEvent>({
        type: 'DamageTakenEvent',
        timestamp: Date.now(),
        caster: enemy,
        target: owner,
        damageSource: DamageSource.DIRECT,
        damageType: DamageType.PHYSICAL,
        damageTaken: 65,
        beforeHp: owner.getCurrentHp(),
        remainHp: owner.getCurrentHp(),
        isLethal: false,
      });
    }

    expect(reductions).toEqual([0.35, 0.35]);
    expect(counters).toHaveLength(2);
    expect(counters.map((event) => event.damageComponents?.[0]?.segmentMultiplier))
      .toEqual([0.45, 0.45]);
  });

  it('净化没有可选目标仍是合法结算，并消费一次魔相', () => {
    const { owner, skill } = install('demon-crossing');
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE,
      mode: 'demon',
      remainingUses: 2,
      displayName: '魔相',
    });

    cast(skill('five-skandhas'), owner, owner);

    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toMatchObject({ remainingUses: 1 });
  });

  it('明镜仅在佛相响应敌方直接伤害，并按敌方行动首次受击留下业痕', () => {
    const { owner, enemy } = install('mirror-karma');
    const reflected: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      if (event.damageSource === DamageSource.REFLECT) reflected.push(event);
    });
    const hit = (source: DamageSource) => EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster: enemy,
      target: owner,
      damageSource: source,
      damageType: DamageType.PHYSICAL,
      damageTaken: 100,
      beforeHp: owner.getCurrentHp(),
      remainHp: owner.getCurrentHp(),
      isLethal: false,
    });

    beginRuntimeAction(enemy);
    hit(DamageSource.DIRECT);
    hit(DamageSource.DIRECT);
    hit(DamageSource.FOLLOW_UP);
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === WUXIANG_KARMA_BUFF)?.getLayer())
      .toBe(1);
    expect(reflected).toHaveLength(2);

    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE,
      mode: 'demon',
      remainingUses: 2,
      displayName: '魔相',
    });
    beginRuntimeAction(enemy);
    hit(DamageSource.DIRECT);
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === WUXIANG_KARMA_BUFF)?.getLayer())
      .toBe(1);
    expect(reflected).toHaveLength(2);
  });

  it('万业同门让无相明确尝试消费第二层业痕，不使用递归数值缩放', () => {
    const { owner, enemy, defaultAttack } = install('mirror-karma', ['mirror-all-karma']);
    const karma = BuffFactory.create({
      id: WUXIANG_KARMA_BUFF,
      name: '业痕',
      type: BuffType.BUFF,
      duration: -1,
      stackRule: StackRule.STACK_LAYER,
      maxLayers: 3,
    });
    owner.buffs.addBuff(karma, owner);
    owner.buffs.addBuff(karma.clone(), owner);
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE,
      mode: 'formless',
      remainingUses: 1,
      displayName: '无相',
    });
    const segments: number[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
      if (event.ability !== defaultAttack) return;
      const segment = event.damageComponents?.find((component) =>
        component.segmentMultiplier !== undefined)?.segmentMultiplier;
      if (segment !== undefined) segments.push(segment);
    });

    cast(defaultAttack, owner, enemy);

    expect(segments).toEqual([0.6, 0.35, 0.3, 0.6]);
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === WUXIANG_KARMA_BUFF)?.getLayer())
      .toBe(1);
  });

  it('第二岸苦在魔相每门恢复一次，在无相 A+B+C 中也只恢复一次', () => {
    const execute = (mode: 'demon' | 'formless') => {
      const { owner, enemy, defaultAttack } = install('demon-crossing', ['demon-second-shore']);
      owner.setHp(Math.floor(owner.getMaxHp() * 0.5));
      setAbilityMode(owner, {
        key: WUXIANG_FORM_MODE,
        mode,
        remainingUses: mode === 'demon' ? 2 : 1,
        displayName: mode,
      });
      const before = owner.getCurrentHp();
      cast(defaultAttack, owner, enemy);
      const cost = Math.ceil(before * 0.06);
      return owner.getCurrentHp() - (before - cost);
    };

    expect(execute('demon')).toBe(Math.round(unit('sample').getMaxHp() * 0.025));
    expect(execute('formless')).toBe(Math.round(unit('sample').getMaxHp() * 0.025));
  });

  it('三叩低血强化读取支付气血成本后的施法快照', () => {
    const executeAt = (hpRatio: number) => {
      const { owner, enemy, skill } = install('demon-crossing');
      owner.setHp(Math.floor(owner.getMaxHp() * hpRatio));
      const knocks = skill('three-knocks');
      return damageSegments(knocks, () => cast(knocks, owner, enemy));
    };

    expect(executeAt(0.50)).toEqual([0.25, 0.25, 0.25]);
    expect(executeAt(0.48)).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  it('连续两次魔相使用同一 B，不存在第一门与第二门分支', () => {
    const { owner, enemy, defaultAttack } = install('demon-crossing');
    setAbilityMode(owner, {
      key: WUXIANG_FORM_MODE,
      mode: 'demon',
      remainingUses: 2,
      displayName: '魔相',
    });

    const first = damageSegments(defaultAttack, () => cast(defaultAttack, owner, enemy));
    const second = damageSegments(defaultAttack, () => cast(defaultAttack, owner, enemy));

    expect(first).toEqual([0.6, 0.35]);
    expect(second).toEqual([0.6, 0.35]);
    expect(readAbilityMode(owner, WUXIANG_FORM_MODE)).toBeUndefined();
  });

  it('渡厄吸血按宗门直接伤害标签触发，防御神通不会误触发吸血', () => {
    const { owner, enemy, skill } = install('demon-crossing');
    owner.setHp(Math.floor(owner.getMaxHp() * 0.4));
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 3);
    cast(skill('turn-form'), owner, owner);

    const flower = skill('flower-heart');
    const beforeAttack = owner.getCurrentHp();
    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster: owner,
      target: enemy,
      ability: flower,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.PHYSICAL,
      damageTaken: 100,
      beforeHp: enemy.getCurrentHp() + 100,
      remainHp: enemy.getCurrentHp(),
      isLethal: false,
    });
    expect(owner.getCurrentHp()).toBe(beforeAttack + 25);

    const beforeDefense = owner.getCurrentHp();
    cast(skill('blood-tide'), owner, owner);
    expect(owner.getCurrentHp()).toBe(beforeDefense - Math.ceil(beforeDefense * 0.14));
  });

  it('低血节点只响应宗门神通气血成本跨线，且每场只触发一次', () => {
    const { owner, enemy, defaultAttack } = install('demon-crossing', ['demon-three-shores']);
    const maxHp = owner.getMaxHp();
    owner.setHp(Math.floor(maxHp * 0.36));

    cast(defaultAttack, owner, enemy);
    expect(owner.getCurrentShield()).toBe(Math.round(maxHp * 0.08));

    owner.setHp(Math.floor(maxHp * 0.36));
    cast(defaultAttack, owner, enemy);
    expect(owner.getCurrentShield()).toBe(Math.round(maxHp * 0.08));
  });

  it.each([
    {
      node: 'demon-body-breaks',
      ratio: 0.31,
      buffId: 'sect.wuxiang.demon.body-breaks-guard',
    },
    {
      node: 'demon-blood-empty',
      ratio: 0.26,
      buffId: undefined,
    },
  ])('$node 仅在气血成本首次跨线时触发一次', ({ node, ratio, buffId }) => {
    const { owner, enemy, defaultAttack } = install('demon-crossing', [node]);
    const maxHp = owner.getMaxHp();
    owner.setHp(Math.floor(maxHp * ratio));
    const before = owner.getCurrentHp();
    cast(defaultAttack, owner, enemy);
    const paid = Math.ceil(before * 0.06);
    if (buffId) {
      expect(owner.buffs.getAllBuffIds()).toContain(buffId);
    } else {
      expect(owner.getCurrentHp()).toBe(before - paid + Math.round(maxHp * 0.05));
    }

    owner.setHp(Math.floor(maxHp * ratio));
    cast(defaultAttack, owner, enemy);
    if (buffId) {
      expect(owner.buffs.getAllBuffs().filter((buff) => buff.id === buffId)).toHaveLength(1);
    } else {
      expect(owner.getCurrentHp()).toBe(
        Math.floor(maxHp * ratio) - Math.ceil(Math.floor(maxHp * ratio) * 0.06),
      );
    }
  });

  it('技能状态快照显示当前计划名称和稳定的实时气血成本', () => {
    const { owner, skill } = install('mirror-karma');
    owner.combatResources.modify(WUXIANG_WAR_INTENT, 6);
    cast(skill('turn-form'), owner, owner);
    const recorder = new BattleStateRecorder();
    recorder.record('battle_init', 0, [owner]);
    const defaultSkill = recorder.getFrames()[0].units[owner.id].cooldowns
      .find((entry) => entry.skillId === 'sect.wuxiang.flower-heart');

    expect(defaultSkill?.skillName).toBe('心花两忘');
    expect(defaultSkill?.runtimePlanId).toBe('formless');
    expect(defaultSkill?.costs?.[0]).toMatchObject({
      resource: 'hp',
      mode: 'current_hp_ratio',
      ratio: 0.05,
      resolvedAmount: Math.ceil(owner.getCurrentHp() * 0.05),
    });
  });
});
