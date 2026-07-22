import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type {
  DamageRequestEvent,
  ResourceDrainEvent,
  UnitDeadEvent,
} from '@shared/engine/battle-v5/core/events';
import { EventPriorityLevel } from '@shared/engine/battle-v5/core/events';
import {
  beginRuntimeAction,
  shouldTickBuffDuration,
} from '@shared/engine/battle-v5/core/runtimeState';
import {
  AttributeType,
  AbilityType,
  BuffType,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { DamageSystem } from '@shared/engine/battle-v5/systems/DamageSystem';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSectAbility } from '../..';
import {
  YOUDU_FORGETFUL_RIVER,
  YOUDU_RETURNING_SOUL,
  YOUDU_SHADOW_REVEALED,
  YOUDU_SOUL_EROSION,
  YOUDU_SOUL_FIRE,
  YOUDU_SOUL_LOST,
} from '..';
import { youduState, type YouduPathId } from './testState';

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.WISDOM]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

function config(abilityId: string, pathId?: YouduPathId, nodes: string[] = []) {
  return resolveSectAbility({
    sect: youduState(pathId, nodes),
    realm: '化神',
    abilityId,
  }).config;
}

function ability(abilityId: string, pathId?: YouduPathId, nodes: string[] = []) {
  return AbilityFactory.create(config(abilityId, pathId, nodes));
}

function installRuntime(owner: Unit, pathId?: YouduPathId, nodes: string[] = []): void {
  owner.combatResources.define({
    id: YOUDU_SOUL_FIRE,
    name: '魂火',
    initial: 0,
    max: 3,
  });
  owner.abilities.addAbility(ability('youdu-runtime', pathId, nodes));
}

function erosion(target: Unit) {
  return target.buffs.getAllBuffs().find((buff) => buff.id === YOUDU_SOUL_EROSION);
}

function setOverride(owner: Unit, attrType: AttributeType, value: number): void {
  owner.attributes.removeModifier(`test.override.${owner.id}.${attrType}`);
  owner.attributes.addModifier({
    id: `test.override.${owner.id}.${attrType}`,
    attrType,
    type: ModifierType.OVERRIDE,
    value,
    source: 'test',
  });
  owner.updateDerivedStats();
}

function addBuffImmunity(owner: Unit, tags: string[]): void {
  owner.abilities.addAbility(AbilityFactory.create({
    slug: `test.buff-immunity.${owner.id}.${tags.join('.')}`,
    name: '测试状态免疫',
    type: AbilityType.PASSIVE_SKILL,
    tags: [GameplayTags.ABILITY.KIND.PASSIVE],
    listeners: [{
      eventType: GameplayTags.EVENT.BUFF_ADD,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 1_000,
      effects: [{ type: 'buff_immunity', params: { tags } }],
    }],
  }));
}

function addDamageImmunity(owner: Unit, tags: string[]): void {
  owner.abilities.addAbility(AbilityFactory.create({
    slug: `test.damage-immunity.${owner.id}.${tags.join('.')}`,
    name: '测试伤害免疫',
    type: AbilityType.PASSIVE_SKILL,
    tags: [GameplayTags.ABILITY.KIND.PASSIVE],
    listeners: [{
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.DAMAGE_APPLY,
      effects: [{ type: 'damage_immunity', params: { tags } }],
    }],
  }));
}

describe('幽都核心机制实际结算', () => {
  beforeEach(() => {
    EventBus.instance.reset();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    EventBus.instance.reset();
  });

  it('蚀魂一次加层、非线性属性、逐层驱散与受治疗削弱统一生效', () => {
    const caster = unit('caster');
    const target = unit('target');
    installRuntime(caster);
    const baseMagicAttack = target.attributes.getValue(AttributeType.MAGIC_ATK);
    const baseSpeed = target.attributes.getValue(AttributeType.SPEED);
    const sigh = ability('one-sigh');
    const sever = ability('soul-severing-call');

    sigh.execute({ caster, target });
    sever.execute({ caster, target });

    expect(erosion(target)?.getLayer()).toBe(3);
    expect(target.attributes.getValue(AttributeType.MAGIC_ATK)).toBeCloseTo(baseMagicAttack * 0.92);
    expect(target.attributes.getValue(AttributeType.SPEED)).toBeCloseTo(baseSpeed * 0.92);
    expect(caster.combatResources.getCurrent(YOUDU_SOUL_FIRE)).toBe(1);

    target.setHp(target.getMaxHp() - 100);
    expect(target.heal(100)).toBe(70);
    expect(target.buffs.removeBuffDispel(YOUDU_SOUL_EROSION)).toBe(true);
    expect(erosion(target)?.getLayer()).toBe(2);
  });

  it('蚀魂五层完整曲线、满层刷新与全部清除均保持单一状态语义', () => {
    const caster = unit('caster');
    const target = unit('target');
    installRuntime(caster);
    const baseAttack = target.attributes.getValue(AttributeType.MAGIC_ATK);
    const baseDefense = target.attributes.getValue(AttributeType.MAGIC_DEF);
    const baseSpeed = target.attributes.getValue(AttributeType.SPEED);
    const expected = [0.97, 0.95, 0.92, 0.88, 0.88];
    const expectedHealing = [100, 85, 70, 50, 0];
    const sigh = ability('one-sigh');

    setOverride(caster, AttributeType.CONTROL_HIT, 1);
    setOverride(target, AttributeType.CONTROL_RESISTANCE, 0);
    for (let index = 0; index < expected.length; index += 1) {
      sigh.execute({ caster, target });
      const ratio = expected[index];
      expect(erosion(target)?.getLayer()).toBe(index + 1);
      expect(target.attributes.getValue(AttributeType.MAGIC_ATK)).toBeCloseTo(baseAttack * ratio);
      expect(target.attributes.getValue(AttributeType.MAGIC_DEF)).toBeCloseTo(baseDefense * ratio);
      expect(target.attributes.getValue(AttributeType.SPEED)).toBeCloseTo(baseSpeed * ratio);
      target.setHp(target.getMaxHp() - 100);
      expect(target.heal(100)).toBe(expectedHealing[index]);
    }

    expect(target.buffs.getAllBuffIds()).toContain(YOUDU_SOUL_LOST);
    erosion(target)?.tickDuration();
    expect(erosion(target)?.getDuration()).toBe(2);
    sigh.execute({ caster, target });
    expect(erosion(target)?.getLayer()).toBe(5);
    expect(erosion(target)?.getDuration()).toBe(3);

    beginRuntimeAction(target);
    EventBus.instance.publish({
      type: 'ControlledSkipEvent',
      timestamp: Date.now(),
      unit: target,
      controlTag: GameplayTags.STATUS.CONTROL.NO_ACTION,
    });
    expect(erosion(target)?.getLayer()).toBe(3);
    expect(target.buffs.getAllBuffIds()).toContain(YOUDU_RETURNING_SOUL);
    expect(target.buffs.getAllBuffs().find((buff) => buff.id === YOUDU_RETURNING_SOUL)
      ?.getDuration()).toBe(1);
    expect(shouldTickBuffDuration(
      target,
      target.buffs.getAllBuffs().find((buff) => buff.id === YOUDU_RETURNING_SOUL)!,
    )).toBe(false);

    AbilityFactory.createEffect({
      type: 'buff_layer_modify',
      params: {
        match: { id: YOUDU_SOUL_EROSION },
        operation: 'clear',
      },
    })!.execute({ caster, target });
    expect(erosion(target)).toBeUndefined();
  });

  it('五层失魂成功后跳过行动，统一回落三层并进入完整归窍窗口', () => {
    const caster = unit('caster');
    const target = unit('target');
    installRuntime(caster);
    setOverride(caster, AttributeType.CONTROL_HIT, 1);
    setOverride(target, AttributeType.CONTROL_RESISTANCE, 0);
    const sigh = ability('one-sigh');
    const sever = ability('soul-severing-call');

    sigh.execute({ caster, target });
    sever.execute({ caster, target });
    sigh.execute({ caster, target });
    expect(erosion(target)?.getLayer()).toBe(4);
    caster.combatResources.set(YOUDU_SOUL_FIRE, 0);
    beginRuntimeAction(caster);
    sigh.execute({ caster, target });

    expect(erosion(target)?.getLayer()).toBe(5);
    expect(caster.combatResources.getCurrent(YOUDU_SOUL_FIRE)).toBe(1);
    expect(target.buffs.getAllBuffIds()).toContain(YOUDU_SOUL_LOST);
    expect(target.buffs.removeBuffDispel(YOUDU_SOUL_LOST)).toBe(false);
    expect(target.heal(100)).toBe(0);

    EventBus.instance.publish({
      type: 'ControlledSkipEvent',
      timestamp: Date.now(),
      unit: target,
      controlTag: GameplayTags.STATUS.CONTROL.NO_ACTION,
    });
    expect(erosion(target)?.getLayer()).toBe(3);
    expect(target.buffs.getAllBuffIds()).toContain(YOUDU_RETURNING_SOUL);

    target.buffs.removeBuffExpired(YOUDU_SOUL_LOST);
    sever.execute({ caster, target });
    expect(erosion(target)?.getLayer()).toBe(4);
    expect(target.buffs.getAllBuffIds()).not.toContain(YOUDU_SOUL_LOST);
  });

  it('归窍钳制后只按净增加层数获得魂火，且不误触发五层节点', () => {
    const nodes = ['tide-last-ferry'];
    const caster = unit('caster');
    const target = unit('target');
    installRuntime(caster, 'tide', nodes);
    setOverride(caster, AttributeType.CONTROL_HIT, 0);
    setOverride(target, AttributeType.CONTROL_RESISTANCE, 1);
    const forget = ability('forgetful-river-tide', 'tide', nodes);
    const sever = ability('soul-severing-call', 'tide', nodes);
    const sigh = ability('one-sigh', 'tide', nodes);

    for (const next of [forget, sever, sever]) {
      beginRuntimeAction(caster);
      next.execute({ caster, target });
    }
    const mpAfterFirstFifth = target.getCurrentMp();
    expect(mpAfterFirstFifth).toBeLessThan(target.getMaxMp());
    expect(erosion(target)?.getLayer()).toBe(3);
    expect(target.buffs.getAllBuffIds()).toContain(YOUDU_RETURNING_SOUL);
    caster.combatResources.set(YOUDU_SOUL_FIRE, 0);

    beginRuntimeAction(caster);
    sever.execute({ caster, target });
    expect(erosion(target)?.getLayer()).toBe(4);
    expect(target.getCurrentMp()).toBe(mpAfterFirstFifth);
    expect(caster.combatResources.getCurrent(YOUDU_SOUL_FIRE)).toBe(1);

    beginRuntimeAction(caster);
    sigh.execute({ caster, target });
    expect(erosion(target)?.getLayer()).toBe(4);
    expect(target.getCurrentMp()).toBe(mpAfterFirstFifth);
    expect(caster.combatResources.getCurrent(YOUDU_SOUL_FIRE)).toBe(1);
  });

  it('失魂被控制抵抗、控制免疫或心死神活解除时均收束为三层与归窍', () => {
    const runToFive = (caster: Unit, target: Unit) => {
      const sigh = ability('one-sigh');
      const sever = ability('soul-severing-call');
      sigh.execute({ caster, target });
      sever.execute({ caster, target });
      sigh.execute({ caster, target });
      expect(erosion(target)?.getLayer()).toBe(4);
      caster.combatResources.set(YOUDU_SOUL_FIRE, 0);
      beginRuntimeAction(caster);
      sigh.execute({ caster, target });
    };

    const resistCaster = unit('resist-caster');
    const resistTarget = unit('resist-target');
    installRuntime(resistCaster);
    setOverride(resistCaster, AttributeType.CONTROL_HIT, 0);
    setOverride(resistTarget, AttributeType.CONTROL_RESISTANCE, 1);
    runToFive(resistCaster, resistTarget);
    expect(erosion(resistTarget)?.getLayer()).toBe(3);
    expect(resistTarget.buffs.getAllBuffIds()).toContain(YOUDU_RETURNING_SOUL);
    expect(resistTarget.buffs.getAllBuffIds()).not.toContain(YOUDU_SOUL_LOST);
    expect(resistCaster.combatResources.getCurrent(YOUDU_SOUL_FIRE)).toBe(1);

    const immuneCaster = unit('immune-caster');
    const immuneTarget = unit('immune-target');
    installRuntime(immuneCaster);
    setOverride(immuneCaster, AttributeType.CONTROL_HIT, 1);
    setOverride(immuneTarget, AttributeType.CONTROL_RESISTANCE, 0);
    immuneTarget.buffs.addBuff(BuffFactory.create({
      id: 'test.no-action-immunity',
      name: '行动控制免疫',
      type: BuffType.BUFF,
      duration: -1,
      stackRule: StackRule.IGNORE,
      listeners: [{
        eventType: GameplayTags.EVENT.BUFF_ADD,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 1_000,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [{
          type: 'buff_immunity',
          params: { tags: [GameplayTags.STATUS.CONTROL.NO_ACTION] },
        }],
      }],
    }));
    runToFive(immuneCaster, immuneTarget);
    expect(erosion(immuneTarget)?.getLayer()).toBe(3);
    expect(immuneTarget.buffs.getAllBuffIds()).toContain(YOUDU_RETURNING_SOUL);
    expect(immuneTarget.buffs.getAllBuffIds()).not.toContain(YOUDU_SOUL_LOST);
    expect(immuneCaster.combatResources.getCurrent(YOUDU_SOUL_FIRE)).toBe(1);

    const heartCaster = unit('heart-caster');
    const heartTarget = unit('heart-target');
    installRuntime(heartCaster);
    installRuntime(heartTarget);
    setOverride(heartCaster, AttributeType.CONTROL_HIT, 1);
    setOverride(heartTarget, AttributeType.CONTROL_RESISTANCE, 0);
    runToFive(heartCaster, heartTarget);
    expect(erosion(heartTarget)?.getLayer()).toBe(3);
    expect(heartTarget.buffs.getAllBuffIds()).toContain(YOUDU_RETURNING_SOUL);
    expect(heartTarget.buffs.getAllBuffIds()).not.toContain(YOUDU_SOUL_LOST);
    expect(heartCaster.combatResources.getCurrent(YOUDU_SOUL_FIRE)).toBe(1);
  });

  it('心死神活只解除首次成功落地控制，并为同类控制提供短时免疫', () => {
    const enemy = unit('enemy');
    const youdu = unit('youdu');
    installRuntime(youdu);
    const controlEffect = AbilityFactory.createEffect({
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'test.control.no-skill',
          name: '测试封印',
          type: BuffType.CONTROL,
          duration: 2,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.STATUS.CONTROL.NO_SKILL],
          statusTags: [GameplayTags.STATUS.CONTROL.NO_SKILL],
        },
      },
    })!;

    setOverride(enemy, AttributeType.CONTROL_HIT, 0);
    setOverride(youdu, AttributeType.CONTROL_RESISTANCE, 1);
    controlEffect.execute({ caster: enemy, target: youdu });
    expect(youdu.tags.hasTag(GameplayTags.STATUS.SECT.state('youdu', 'heart-dead-used')))
      .toBe(false);

    setOverride(enemy, AttributeType.CONTROL_HIT, 1);
    setOverride(youdu, AttributeType.CONTROL_RESISTANCE, 0);
    controlEffect.execute({ caster: enemy, target: youdu });
    expect(youdu.buffs.getAllBuffIds()).not.toContain('test.control.no-skill');
    expect(youdu.tags.hasTag(GameplayTags.STATUS.CONTROL.NO_SKILL)).toBe(false);
    expect(youdu.tags.hasTag(GameplayTags.STATUS.SECT.state('youdu', 'heart-dead-used'))).toBe(true);
    expect(youdu.buffs.getAllBuffs().find((entry) =>
      entry.id.startsWith('sect.youdu.heart-immunity.'))?.getDuration()).toBe(1);

    controlEffect.execute({ caster: enemy, target: youdu });
    expect(youdu.buffs.getAllBuffIds()).not.toContain('test.control.no-skill');

    for (const buff of youdu.buffs.getAllBuffs().filter((entry) =>
      entry.id.startsWith('sect.youdu.heart-immunity.'))) {
      youdu.buffs.removeBuffExpired(buff.id);
    }
    controlEffect.execute({ caster: enemy, target: youdu });
    expect(youdu.buffs.getAllBuffIds()).toContain('test.control.no-skill');
  });

  it('心死神活主动解除失魂时触发五魄俱散', () => {
    const nodes = ['decree-five-souls-scattered'];
    const caster = unit('caster');
    const target = unit('target');
    installRuntime(target);
    setOverride(caster, AttributeType.CONTROL_HIT, 1);
    setOverride(target, AttributeType.CONTROL_RESISTANCE, 0);
    const sigh = ability('one-sigh', 'decree', nodes);

    for (let index = 0; index < 5; index += 1) sigh.execute({ caster, target });

    expect(target.buffs.getAllBuffIds()).not.toContain(YOUDU_SOUL_LOST);
    expect(target.buffs.getAllBuffIds()).toContain('sect.youdu.five-souls-penalty');
    expect(erosion(target)?.getLayer()).toBe(3);
  });

  it('通用减益免疫阻止蚀魂与忘川，控制免疫只阻止失魂和镇魂钉', () => {
    const debuffCaster = unit('debuff-caster');
    const debuffTarget = unit('debuff-target');
    addBuffImmunity(debuffTarget, [GameplayTags.BUFF.TYPE.DEBUFF]);

    ability('one-sigh').execute({ caster: debuffCaster, target: debuffTarget });
    ability('forgetful-river-tide').execute({
      caster: debuffCaster,
      target: debuffTarget,
    });

    expect(erosion(debuffTarget)).toBeUndefined();
    expect(debuffTarget.buffs.getAllBuffIds()).not.toContain(
      YOUDU_FORGETFUL_RIVER,
    );

    const controlCaster = unit('control-caster');
    const controlTarget = unit('control-target');
    addBuffImmunity(controlTarget, [GameplayTags.BUFF.TYPE.CONTROL]);
    setOverride(controlCaster, AttributeType.CONTROL_HIT, 1);
    setOverride(controlTarget, AttributeType.CONTROL_RESISTANCE, 0);
    ability('one-sigh').execute({ caster: controlCaster, target: controlTarget });
    ability('soul-severing-call').execute({
      caster: controlCaster,
      target: controlTarget,
    });
    ability('one-sigh').execute({ caster: controlCaster, target: controlTarget });
    expect(erosion(controlTarget)?.getLayer()).toBe(4);

    ability('pin-soul').execute({ caster: controlCaster, target: controlTarget });

    expect(erosion(controlTarget)).toBeDefined();
    expect(controlTarget.buffs.getAllBuffIds()).not.toContain(YOUDU_SOUL_LOST);
    expect(controlTarget.buffs.getAllBuffIds()).not.toContain(
      'sect.youdu.soul-pinning-nail',
    );
  });

  it('先定其形在本次伤害后加层，且闪避不会消耗次数', () => {
    const system = new DamageSystem();
    const caster = unit('caster');
    const target = unit('target');
    const nodes = ['decree-fix-form-first'];
    installRuntime(caster, 'decree', nodes);
    ability('reveal-shadow', 'decree', nodes).execute({ caster, target });
    ability('one-sigh', 'decree', nodes).execute({ caster, target });
    ability('one-sigh', 'decree', nodes).execute({ caster, target });
    expect(erosion(target)?.getLayer()).toBe(2);
    const sever = ability('soul-severing-call', 'decree', nodes);
    let soulRequest: DamageRequestEvent | undefined;
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => {
        if (event.damageType === DamageType.TRUE) soulRequest = event;
      },
      -1_000,
    );

    EventBus.instance.publish({
      type: 'HitCheckEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability: sever,
      isHit: false,
      isDodged: true,
      isResisted: false,
    });
    expect(erosion(target)?.getLayer()).toBe(2);

    EventBus.instance.publish({
      type: 'HitCheckEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability: sever,
      isHit: true,
      isDodged: false,
      isResisted: false,
    });
    sever.execute({ caster, target });

    expect(soulRequest?.damageIncreasePctBucket).toBeCloseTo(0.06);
    expect(erosion(target)?.getLayer()).toBe(5);
    system.destroy();
  });

  it('先定其形不会被照影或魂兮不归消费，也不会在终结清层后留下孤立失魂', () => {
    const system = new DamageSystem();
    const nodes = ['decree-fix-form-first'];
    const caster = unit('caster');
    const target = unit('target');
    installRuntime(caster, 'decree', nodes);
    const sigh = ability('one-sigh', 'decree', nodes);

    for (let index = 0; index < 4; index += 1) sigh.execute({ caster, target });
    expect(erosion(target)?.getLayer()).toBe(4);

    ability('reveal-shadow', 'decree', nodes).execute({ caster, target });
    const finish = ability('soul-shall-not-return', 'decree', nodes);
    EventBus.instance.publish({
      type: 'HitCheckEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability: finish,
      isHit: true,
      isDodged: false,
      isResisted: false,
    });
    finish.execute({ caster, target });

    expect(erosion(target)).toBeUndefined();
    expect(target.buffs.getAllBuffIds()).not.toContain(YOUDU_SOUL_LOST);
    expect(caster.buffs.getAllBuffIds()).not.toContain('sect.youdu.first-shadow-pending');
    system.destroy();
  });

  it('幽都铁律同时提高五层失魂的控制命中', () => {
    const run = (nodes: string[]) => {
      const caster = unit(`caster-${nodes.length}`);
      const target = unit(`target-${nodes.length}`);
      setOverride(caster, AttributeType.CONTROL_HIT, 0);
      setOverride(target, AttributeType.CONTROL_RESISTANCE, 0.6);
      const sigh = ability('one-sigh', 'decree', nodes);
      for (let index = 0; index < 5; index += 1) {
        sigh.execute({ caster, target });
      }
      return target;
    };

    const withoutNode = run([]);
    expect(withoutNode.buffs.getAllBuffIds()).not.toContain(YOUDU_SOUL_LOST);
    expect(erosion(withoutNode)?.getLayer()).toBe(3);

    const withNode = run(['decree-iron-law']);
    expect(withNode.buffs.getAllBuffIds()).toContain(YOUDU_SOUL_LOST);
    expect(erosion(withNode)?.getLayer()).toBe(5);
  });

  it('镇魂控制被抵抗时保留伤害与蚀魂，但不产生镇魂钉禁疗', () => {
    const caster = unit('caster');
    const target = unit('target');
    setOverride(caster, AttributeType.CONTROL_HIT, 0);
    setOverride(target, AttributeType.CONTROL_RESISTANCE, 1);
    ability('one-sigh').execute({ caster, target });
    ability('soul-severing-call').execute({ caster, target });
    ability('one-sigh').execute({ caster, target });
    expect(erosion(target)?.getLayer()).toBe(4);

    ability('pin-soul').execute({ caster, target });

    expect(target.buffs.getAllBuffIds()).not.toContain('sect.youdu.soul-pinning-nail');
    expect(erosion(target)?.getLayer()).toBe(3);
    target.setHp(target.getMaxHp() - 100);
    expect(target.heal(100)).toBe(70);
  });

  it('蚀魂自然过期与死亡事件都会移除运行时状态', () => {
    const caster = unit('caster');
    const expiredTarget = unit('expired-target');
    ability('one-sigh').execute({ caster, target: expiredTarget });
    const expiring = erosion(expiredTarget)!;
    expiring.tickDuration();
    expiring.tickDuration();
    expiring.tickDuration();
    expect(expiring.isExpired()).toBe(true);
    expiredTarget.buffs.removeBuffExpired(YOUDU_SOUL_EROSION);
    expect(erosion(expiredTarget)).toBeUndefined();

    const deadTarget = unit('dead-target');
    ability('one-sigh').execute({ caster, target: deadTarget });
    expect(erosion(deadTarget)).toBeDefined();
    const system = new DamageSystem();
    deadTarget.setHp(1);
    AbilityFactory.createEffect({
      type: 'damage',
      params: {
        value: { base: 100 },
        damageType: DamageType.TRUE,
      },
    })!.execute({ caster, target: deadTarget });
    expect(deadTarget.isAlive()).toBe(false);
    expect(erosion(deadTarget)).toBeUndefined();
    system.destroy();
  });

  it('混合技能共享能力命中语义但发布术伤与魂伤两个独立伤害请求', () => {
    const caster = unit('caster');
    const target = unit('target');
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => requests.push(event),
      -1_000,
    );

    ability('seize-soul').execute({ caster, target });

    expect(requests.map((event) => event.damageType)).toEqual([
      DamageType.MAGICAL,
      DamageType.TRUE,
    ]);
    expect(requests[1]).toMatchObject({ canCrit: false, canLifesteal: false });
    expect(erosion(target)?.getLayer()).toBe(2);
  });

  it('混合伤害首段致死时只发布一次死亡事件', () => {
    const system = new DamageSystem();
    const caster = unit('caster');
    const target = unit('target');
    const deaths: UnitDeadEvent[] = [];
    const requests: DamageRequestEvent[] = [];
    target.setHp(1);
    EventBus.instance.subscribe<UnitDeadEvent>(
      'UnitDeadEvent',
      (event) => deaths.push(event),
      -1_000,
    );
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => requests.push(event),
      -1_000,
    );

    ability('seize-soul').execute({ caster, target });

    expect(target.isAlive()).toBe(false);
    expect(requests).toHaveLength(1);
    expect(deaths).toHaveLength(1);
    expect(deaths[0]).toMatchObject({ unit: target, killer: caster });
    system.destroy();
  });

  it('敕魂的直接魂伤增幅只识别带魂伤机制标签的真实伤害', () => {
    const caster = unit('caster');
    const target = unit('target');
    const nodes: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      ability('one-sigh', 'decree', nodes).execute({ caster, target });
    }
    const fake = AbilityFactory.create({
      slug: 'test.decree-true-damage',
      name: '非魂伤真实伤害',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.TRUE,
        GameplayTags.ABILITY.SECT.path('youdu', 'decree'),
      ],
      targetPolicy: { team: 'enemy', scope: 'single' },
      selectionProfile: { intents: ['damage'] },
      effects: [{
        type: 'damage',
        params: { value: { base: 10 }, damageType: DamageType.TRUE },
      }],
    });
    let request: DamageRequestEvent | undefined;
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => {
        if (event.ability === fake) request = event;
      },
      -1_000,
    );

    fake.execute({ caster, target });

    expect(request?.damageIncreasePctBucket ?? 0).toBe(0);
  });

  it('法术伤害回蓝只响应混合技能的术伤包，魂伤仍不可暴击与吸血', () => {
    const system = new DamageSystem();
    const caster = unit('caster');
    const target = unit('target');
    const drainEvents: ResourceDrainEvent[] = [];
    caster.takeMp(100);
    caster.abilities.addAbility(AbilityFactory.create({
      slug: 'test.magic-mana-siphon',
      name: '测试摄魂',
      type: AbilityType.PASSIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.PASSIVE],
      listeners: [{
        eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
        scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
        priority: 0,
        effects: [{
          type: 'resource_drain',
          conditions: [{
            type: 'damage_type_is',
            params: { damageType: DamageType.MAGICAL },
          }],
          params: { sourceType: 'hp', targetType: 'mp', ratio: 1 },
        }],
      }],
    }));
    EventBus.instance.subscribe<ResourceDrainEvent>(
      'ResourceDrainEvent',
      (event) => drainEvents.push(event),
      -1_000,
    );
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => requests.push(event),
      -1_000,
    );

    ability('seize-soul').execute({ caster, target });

    expect(drainEvents).toHaveLength(1);
    expect(requests.filter((event) => event.damageType === DamageType.MAGICAL))
      .toHaveLength(1);
    expect(requests.find((event) => event.damageType === DamageType.TRUE))
      .toMatchObject({
        canCrit: false,
        canLifesteal: false,
      });
    system.destroy();
  });

  it('忘川为单体行动前DOT，逐次读取施术者实时法攻且不额外加层', () => {
    const caster = unit('caster');
    const target = unit('target');
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => requests.push(event),
      -1_000,
    );
    ability('forgetful-river-tide').execute({ caster, target });
    expect(target.buffs.getAllBuffIds()).toContain(YOUDU_FORGETFUL_RIVER);
    expect(erosion(target)?.getLayer()).toBe(1);
    requests.length = 0;

    setOverride(caster, AttributeType.MAGIC_ATK, 100);
    EventBus.instance.publish({ type: 'ActionPreEvent', timestamp: Date.now(), caster: target });
    setOverride(caster, AttributeType.MAGIC_ATK, 200);
    EventBus.instance.publish({ type: 'ActionPreEvent', timestamp: Date.now(), caster: target });

    expect(requests.map((event) => event.baseDamage)).toEqual([14, 28]);
    expect(requests.every((event) => event.canCrit === false)).toBe(true);
    expect(erosion(target)?.getLayer()).toBe(1);
  });

  it('照影按终结前蚀魂层数放大单次魂伤，终结随后清层并施加不归', () => {
    const system = new DamageSystem();
    const caster = unit('caster');
    const target = unit('target');
    installRuntime(caster);
    const sigh = ability('one-sigh');
    const sever = ability('soul-severing-call');
    sigh.execute({ caster, target });
    sever.execute({ caster, target });
    sigh.execute({ caster, target });
    expect(erosion(target)?.getLayer()).toBe(4);
    ability('reveal-shadow').execute({ caster, target });
    expect(target.buffs.getAllBuffIds()).toContain(YOUDU_SHADOW_REVEALED);
    const before = target.getCurrentHp();

    ability('soul-shall-not-return').execute({ caster, target });

    const expected = Math.round(
      Math.round(caster.attributes.getValue(AttributeType.MAGIC_ATK) * 1.5) * 1.08,
    );
    expect(before - target.getCurrentHp()).toBe(expected);
    expect(target.buffs.getAllBuffIds()).not.toContain(YOUDU_SOUL_EROSION);
    expect(target.tags.hasTag(GameplayTags.STATUS.SECT.state('youdu', 'no-return'))).toBe(true);
    system.destroy();
  });

  it('满魂火强化并消费指定魂伤后，本次加层开始下一轮积累', () => {
    const caster = unit('caster');
    const target = unit('target');
    installRuntime(caster);
    caster.combatResources.set(YOUDU_SOUL_FIRE, 3);
    let request: DamageRequestEvent | undefined;
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => {
        if (event.damageType === DamageType.TRUE) request = event;
      },
      -1_000,
    );

    ability('soul-severing-call').execute({ caster, target });

    expect(request?.damageIncreasePctBucket).toBeCloseTo(0.25);
    expect(caster.combatResources.getCurrent(YOUDU_SOUL_FIRE)).toBe(1);
    expect(erosion(target)?.getLayer()).toBe(2);
  });

  it.each(['soul-severing-call', 'seize-soul', 'pin-soul'])(
    '%s 不会消费由本次加层才补满的魂火',
    (abilityId) => {
      const caster = unit(`caster-${abilityId}`);
      const target = unit(`target-${abilityId}`);
      installRuntime(caster);
      caster.combatResources.set(YOUDU_SOUL_FIRE, 2);
      beginRuntimeAction(caster);

      ability(abilityId).execute({ caster, target });

      expect(caster.combatResources.getCurrent(YOUDU_SOUL_FIRE)).toBe(3);
      expect(erosion(target)?.getLayer()).toBe(2);
    },
  );

  it.each([
    ['one-sigh', []],
    ['soul-severing-call', []],
    ['forgetful-river-tide', [YOUDU_FORGETFUL_RIVER]],
    ['seize-soul', ['sect.youdu.seize-soul-attack-down']],
    ['pin-soul', ['sect.youdu.soul-pinning-nail']],
  ] as const)('%s 致死后不在死亡目标上遗留后续幽都状态', (abilityId, extraIds) => {
    const system = new DamageSystem();
    const caster = unit(`caster-${abilityId}`);
    const target = unit(`target-${abilityId}`);
    target.setHp(1);

    ability(abilityId).execute({ caster, target });

    expect(target.isAlive()).toBe(false);
    expect(target.buffs.getAllBuffIds()).not.toContain(YOUDU_SOUL_EROSION);
    for (const id of extraIds) {
      expect(target.buffs.getAllBuffIds()).not.toContain(id);
    }
    system.destroy();
  });
});
