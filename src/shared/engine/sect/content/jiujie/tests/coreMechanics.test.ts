import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { beginRuntimeAction } from '@shared/engine/battle-v5/core/runtimeState';
import { getBattleRuntimeState } from '@shared/engine/battle-v5/core/runtimeState';
import { createHitResolution } from '@shared/engine/battle-v5/core/resolution';
import type { DamageSegmentAppliedEvent, DamageSegmentRequestedEvent, SkillCastEvent, SkillPreCastEvent } from '@shared/engine/battle-v5/core/events';
import { AbilityType, AttributeType, BuffType, DamageSource, DamageType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { ActionExecutionSystem } from '@shared/engine/battle-v5/systems/ActionExecutionSystem';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectSectCombat, resolveSectAbility } from '../..';
import { JIUJIE_CALAMITY, JIUJIE_CONDEMNATION_PATH_ID, JIUJIE_DAMAGE_SENTENCE, JIUJIE_DEBT, JIUJIE_EYE, JIUJIE_EYE_PATH_ID, JIUJIE_REOFFEND, JIUJIE_SIN_DAMAGE, JIUJIE_SIN_SUPPORT, JIUJIE_THUNDER, jiujieTag } from '../ids';
import type { CultivatorSectState } from '../../../core';

function state(pathId: string = JIUJIE_EYE_PATH_ID, nodeIds: string[] = []): CultivatorSectState {
  return {
    membershipId: 'jiujie-core-runtime', sectId: 'jiujie', status: 'active', contribution: 0, configVersion: 1,
    activePathId: pathId,
    methods: { 'jiujie-canon': 10, 'calamity-eye': 5, 'heavenly-record': 5, 'thunder-prison': 5, 'cause-judgment': 5, 'crossing-calamity': 5 },
    paths: [{ pathId, unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'], tacticId: pathId === JIUJIE_EYE_PATH_ID ? 'bear-and-return' : 'record-and-judge', activeMeridianSlot: 1, meridianLoadouts: [{ slot: 1, nodeIds, version: 1 }, { slot: 2, nodeIds: [], version: 1 }, { slot: 3, nodeIds: [], version: 1 }] }],
    abilityLoadout: ['heaven-hearing', 'receive-calamity', 'thunder-prison-question', 'nine-sky-settlement'],
  };
}

function unit(id: string): Unit {
  const result = new Unit(id, id, { [AttributeType.VITALITY]: 100, [AttributeType.SPIRIT]: 100, [AttributeType.ENDURANCE]: 100, [AttributeType.SPEED]: 100, [AttributeType.WILLPOWER]: 100 });
  result.restoreMp(100_000);
  return result;
}

function setup(pathId: string = JIUJIE_EYE_PATH_ID, nodeIds: string[] = []) {
  const sect = state(pathId, nodeIds);
  const projection = projectSectCombat({ sect, realm: '化神' })!;
  const owner = unit('owner');
  const enemy = unit('enemy');
  for (const resource of projection.resources) owner.combatResources.define(resource);
  for (const config of projection.abilities.filter((ability) => ability.type === AbilityType.PASSIVE_SKILL)) owner.abilities.addAbility(AbilityFactory.create(config));
  const skill = (id: string): ActiveSkill => {
    const result = AbilityFactory.create(resolveSectAbility({ sect, realm: '化神', abilityId: id }).config) as ActiveSkill;
    result.setOwner(owner);
    result.setActive(true);
    return result;
  };
  return { owner, enemy, skill, projection };
}

let testResolutionSequence = 0;

function resolution(caster: Unit, target: Unit, ability: ActiveSkill) {
  const sequence = ++testResolutionSequence;
  return createHitResolution({
    actionId: `${caster.id}:jiujie-test:${sequence}`,
    castId: `${ability.id}:jiujie-test:${sequence}`,
    caster,
    target,
  });
}

function damageResolution(caster: Unit, target: Unit, label: string) {
  const sequence = ++testResolutionSequence;
  return createHitResolution({
    actionId: `${caster.id}:jiujie-${label}:${sequence}`,
    castId: `${caster.id}:jiujie-${label}:${sequence}`,
    caster,
    target,
  });
}

function cast(skill: ActiveSkill, caster: Unit, target: Unit): void {
  skill.prepareCast({ caster, target });
  skill.execute({ caster, target, resolution: resolution(caster, target, skill) });
}

function publishSkill(caster: Unit, target: Unit, ability: ActiveSkill, actionId?: string): void {
  const sequence = ++testResolutionSequence;
  EventBus.instance.publish<SkillCastEvent>({
    type: 'SkillCastEvent', timestamp: Date.now(), caster, target, ability,
    resolution: createHitResolution({
      actionId: actionId ?? `${caster.id}:jiujie-test:${sequence}`,
      castId: `${ability.id}:jiujie-test:${sequence}`,
      caster,
      target,
    }),
  });
}

describe('九劫天宫核心战斗语义', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it('劫雷行动触发只产生一次DOT伤害，普攻不增加劫债或劫数', () => {
    const { owner, enemy, skill, projection } = setup();
    cast(skill('heaven-hearing'), owner, enemy);
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>('DamageSegmentRequestedEvent', (event) => requests.push(event));
    const basic = AbilityFactory.create(projection.defaultAttack!) as ActiveSkill;
    basic.setOwner(enemy);
    beginRuntimeAction(enemy);
    publishSkill(enemy, owner, basic);
    expect(requests.filter((event) => event.damageType === DamageType.DOT)).toHaveLength(1);
    expect(requests.find((event) => event.damageType === DamageType.DOT)?.ability?.tags.hasTag(GameplayTags.ABILITY.ELEMENT.THUNDER)).toBe(true);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)?.getLayer() ?? 0).toBe(0);
    expect(owner.combatResources.getCurrent(JIUJIE_CALAMITY)).toBe(0);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_THUNDER)).toBeDefined();
  });

  it('惊雷指作为fallback时不会施加或刷新劫雷', () => {
    const { owner, enemy, projection } = setup();
    const basic = AbilityFactory.create(projection.defaultAttack!) as ActiveSkill;
    basic.setOwner(owner);
    beginRuntimeAction(owner);
    publishSkill(owner, enemy, basic);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_THUNDER)).toBeUndefined();
  });

  it('劫簿落印只在目标已有劫雷时推进劫债', () => {
    const { owner, enemy, skill } = setup(JIUJIE_CONDEMNATION_PATH_ID);
    cast(skill('calamity-seal'), owner, enemy);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)).toBeUndefined();
    cast(skill('calamity-seal'), owner, enemy);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)?.getLayer()).toBe(1);
  });

  it('多目标主动神通在同一次行动中只触发一次劫雷、劫债与劫数', () => {
    const { owner, enemy, skill } = setup();
    const secondTarget = unit('second-target');
    cast(skill('heaven-hearing'), owner, enemy);
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>('DamageSegmentRequestedEvent', (event) => requests.push(event));
    const active = skill('thunder-prison-question');
    expect(active.tags.hasTag('Ability.Function.Damage')).toBe(true);
    expect(active.tags.hasTag('Ability.Function.Control')).toBe(false);
    expect(active.tags.hasTag('Ability.Function.Heal')).toBe(false);
    active.setOwner(enemy);
    beginRuntimeAction(enemy);
    publishSkill(enemy, owner, active, 'jiujie-test:multi-target');
    publishSkill(enemy, secondTarget, active, 'jiujie-test:multi-target');
    expect(requests.filter((event) => event.damageType === DamageType.DOT)).toHaveLength(1);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)?.getLayer()).toBe(1);
    expect(owner.combatResources.getCurrent(JIUJIE_CALAMITY)).toBe(1);
    beginRuntimeAction(enemy);
    publishSkill(enemy, secondTarget, active);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)?.getLayer()).toBe(2);
    expect(owner.combatResources.getCurrent(JIUJIE_CALAMITY)).toBe(2);
    for (let index = 0; index < 3; index += 1) {
      beginRuntimeAction(enemy);
      publishSkill(enemy, owner, active);
    }
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)?.getLayer()).toBe(3);
    expect(enemy.buffs.removeBuffDispel(JIUJIE_THUNDER)).toBe(false);
    expect(enemy.buffs.removeBuffDispel(JIUJIE_DEBT)).toBe(false);
  });

  it('劫数连续获取时不会超过上限3', () => {
    const { owner, enemy, skill } = setup();
    cast(skill('heaven-hearing'), owner, enemy);
    const active = skill('thunder-prison-question');
    active.setOwner(enemy);
    for (let index = 0; index < 6; index += 1) {
      beginRuntimeAction(enemy);
      publishSkill(enemy, owner, active);
    }
    expect(owner.combatResources.getCurrent(JIUJIE_CALAMITY)).toBe(3);
  });

  it('天宫弟子死亡后不再从劫雷行动获得收益', () => {
    const { owner, enemy, skill } = setup();
    cast(skill('heaven-hearing'), owner, enemy);
    owner.setHp(0);
    const active = skill('thunder-prison-question');
    active.setOwner(enemy);
    beginRuntimeAction(enemy);
    publishSkill(enemy, owner, active);
    expect(owner.combatResources.getCurrent(JIUJIE_CALAMITY)).toBe(0);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)).toBeUndefined();
  });

  it('目标死亡清理劫雷、劫债、主罪与重犯', () => {
    const { owner, enemy, skill } = setup(JIUJIE_CONDEMNATION_PATH_ID);
    cast(skill('heaven-hearing'), owner, enemy);
    const active = skill('thunder-prison-question');
    active.setOwner(enemy);
    beginRuntimeAction(enemy);
    publishSkill(enemy, owner, active);
    beginRuntimeAction(enemy);
    publishSkill(enemy, owner, active);
    expect(enemy.buffs.getAllBuffIds()).toEqual(expect.arrayContaining([
      JIUJIE_THUNDER,
      JIUJIE_DEBT,
      JIUJIE_SIN_DAMAGE,
      JIUJIE_REOFFEND,
    ]));
    enemy.setHp(0);
    enemy.buffs.removeBuffsOnDeath();
    expect(enemy.buffs.getAllBuffIds()).not.toContain(JIUJIE_THUNDER);
    expect(enemy.buffs.getAllBuffIds()).not.toContain(JIUJIE_DEBT);
    expect(enemy.buffs.getAllBuffIds()).not.toContain(JIUJIE_SIN_DAMAGE);
    expect(enemy.buffs.getAllBuffIds()).not.toContain(JIUJIE_REOFFEND);
  });

  it('DOT与延迟伤害事件不会触发劫雷', () => {
    const { owner, enemy, skill } = setup();
    cast(skill('heaven-hearing'), owner, enemy);
    EventBus.instance.publish<DamageSegmentRequestedEvent>({
      type: 'DamageSegmentRequestedEvent',
      timestamp: Date.now(),
      caster: enemy,
      target: owner,
      resolution: damageResolution(enemy, owner, 'delayed'),
      damageSource: DamageSource.DELAYED,
      damageType: DamageType.DOT,
      baseDamage: 25,
      finalDamage: 25,
    });
    expect(owner.combatResources.getCurrent(JIUJIE_CALAMITY)).toBe(0);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)).toBeUndefined();
  });

  it('承天受劫只降低直接伤害，并在一次攻击行动内只获得一点劫数', () => {
    const { owner, enemy, skill } = setup();
    cast(skill('receive-calamity'), owner, owner);
    const request: DamageSegmentRequestedEvent = { type: 'DamageSegmentRequestedEvent', timestamp: Date.now(), caster: enemy, target: owner, resolution: damageResolution(enemy, owner, 'request'), damageSource: DamageSource.DIRECT, damageType: DamageType.PHYSICAL, baseDamage: 100, finalDamage: 100 };
    beginRuntimeAction(enemy);
    EventBus.instance.publish(request);
    const taken: DamageSegmentAppliedEvent = { type: 'DamageSegmentAppliedEvent', timestamp: Date.now(), caster: enemy, target: owner, resolution: request.resolution, damageSource: DamageSource.DIRECT, damageType: DamageType.PHYSICAL, finalDamage: 80, damageTaken: 80, beforeHp: owner.getCurrentHp(), remainHp: owner.getCurrentHp() - 80, shieldAbsorbed: 0, remainShield: 0, hpReachedZeroBeforeReactions: false };
    EventBus.instance.publish(taken);
    EventBus.instance.publish({ ...taken, timestamp: Date.now() });
    expect(request.damageReductionPctBucket).toBeCloseTo(0.2);
    expect(owner.combatResources.getCurrent(JIUJIE_CALAMITY)).toBe(1);
  });

  it('劫眼期间首次直接受击会给攻击者施加劫雷', () => {
    const { owner, enemy, skill } = setup();
    cast(skill('receive-calamity'), owner, owner);
    const taken: DamageSegmentAppliedEvent = { type: 'DamageSegmentAppliedEvent', timestamp: Date.now(), caster: enemy, target: owner, resolution: damageResolution(enemy, owner, 'first-hit'), damageSource: DamageSource.DIRECT, damageType: DamageType.PHYSICAL, finalDamage: 40, damageTaken: 40, beforeHp: owner.getCurrentHp(), remainHp: owner.getCurrentHp() - 40, shieldAbsorbed: 0, remainShield: 0, hpReachedZeroBeforeReactions: false };
    EventBus.instance.publish(taken);
    expect(enemy.tags.hasTag('Buff.Sect.jiujie.thunder')).toBe(true);
  });

  it('借劫续门只把已有劫眼与承天受劫各延长一回合', () => {
    const { owner, skill } = setup(JIUJIE_EYE_PATH_ID, ['eye-return']);
    expect(resolveSectAbility({
      sect: state(JIUJIE_EYE_PATH_ID, ['eye-return']), realm: '化神', abilityId: 'borrow-calamity',
    }).config.effects?.filter((effect) => effect.type === 'apply_buff')).toHaveLength(2);
    cast(skill('receive-calamity'), owner, owner);
    owner.combatResources.set(JIUJIE_CALAMITY, 1);
    cast(skill('borrow-calamity'), owner, owner);
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_EYE)?.getMaxDuration()).toBe(3);
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_EYE)?.getDuration()).toBe(3);
    expect(owner.buffs.getAllBuffs().find((buff) => buff.id === 'sect.jiujie.receive-calamity')?.getDuration()).toBe(3);

    owner.buffs.removeBuff(JIUJIE_EYE);
    owner.buffs.removeBuff('sect.jiujie.receive-calamity');
    owner.combatResources.set(JIUJIE_CALAMITY, 1);
    cast(skill('borrow-calamity'), owner, owner);
    expect(owner.buffs.getAllBuffIds()).not.toContain(JIUJIE_EYE);
    expect(owner.buffs.getAllBuffIds()).not.toContain('sect.jiujie.receive-calamity');
  });

  it('只有劫眼道途记录承劫量，并由九霄清算兑现', () => {
    const eye = setup(JIUJIE_EYE_PATH_ID);
    cast(eye.skill('receive-calamity'), eye.owner, eye.owner);
    const taken: DamageSegmentAppliedEvent = {
      type: 'DamageSegmentAppliedEvent', timestamp: Date.now(), caster: eye.enemy, target: eye.owner,
      resolution: damageResolution(eye.enemy, eye.owner, 'memory'),
      damageSource: DamageSource.DIRECT, damageTaken: 40, beforeHp: eye.owner.getCurrentHp(),
      damageType: DamageType.PHYSICAL, finalDamage: 40, shieldAbsorbed: 0, remainShield: 0,
      remainHp: eye.owner.getCurrentHp() - 40, hpReachedZeroBeforeReactions: false,
    };
    EventBus.instance.publish(taken);
    expect(getBattleRuntimeState(eye.owner).memories.get(JIUJIE_EYE)?.amount).toBe(40);

    eye.owner.combatResources.set(JIUJIE_CALAMITY, 2);
    cast(eye.skill('heaven-hearing'), eye.owner, eye.enemy);
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>('DamageSegmentRequestedEvent', (event) => requests.push(event));
    cast(eye.skill('nine-sky-settlement'), eye.owner, eye.enemy);
    expect(requests.find((event) => event.damageSource === DamageSource.FOLLOW_UP)?.baseDamage).toBe(14);
    expect(getBattleRuntimeState(eye.owner).memories.has(JIUJIE_EYE)).toBe(false);

    EventBus.instance.reset();
    const condemnation = setup(JIUJIE_CONDEMNATION_PATH_ID);
    cast(condemnation.skill('receive-calamity'), condemnation.owner, condemnation.owner);
    EventBus.instance.publish({ ...taken, caster: condemnation.enemy, target: condemnation.owner });
    expect(getBattleRuntimeState(condemnation.owner).memories.has(JIUJIE_EYE)).toBe(false);
  });

  it.each([0, 1, 2, 3])('因果回响在%d层劫债时造成基础追击及逐层追加伤害', (layers) => {
    const { owner, enemy, skill } = setup();
    if (layers > 0) {
      const debt = BuffFactory.create({
        id: JIUJIE_DEBT,
        name: '劫债',
        type: BuffType.DEBUFF,
        duration: 4,
        stackRule: StackRule.STACK_LAYER,
        maxLayers: 3,
        dispelPolicy: 'protected',
      });
      enemy.buffs.addBuff(debt, owner);
      for (let index = 1; index < layers; index += 1) debt.addLayer(1);
    }
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>('DamageSegmentRequestedEvent', (event) => requests.push(event));
    cast(skill('causal-echo'), owner, enemy);
    expect(requests).toHaveLength(1 + layers);
  });

  it('真实行动回退使用BASIC普攻且不推进天宫核心循环', () => {
    const { owner, enemy, skill } = setup();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const actionSystem = new ActionExecutionSystem();
    cast(skill('heaven-hearing'), owner, enemy);
    const unavailable = skill('thunder-prison-question');
    unavailable.setOwner(enemy);
    enemy.setMp(1_000);
    unavailable.prepareCast({ caster: enemy, target: owner });
    enemy.setMp(0);
    let fallbackAbility: ActiveSkill | undefined;
    EventBus.instance.subscribe<SkillCastEvent>('SkillCastEvent', (event) => {
      if (event.caster === enemy) fallbackAbility = event.ability as ActiveSkill;
    });
    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      timestamp: Date.now(),
      caster: enemy,
      target: owner,
      fallbackTarget: owner,
      ability: unavailable,
      isInterrupted: false,
    });
    expect(fallbackAbility?.tags.hasTag(GameplayTags.ABILITY.KIND.BASIC)).toBe(true);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)).toBeUndefined();
    expect(owner.combatResources.getCurrent(JIUJIE_CALAMITY)).toBe(0);
    actionSystem.destroy();
    random.mockRestore();
  });

  it('九霄清算可命中仅有劫债的目标，并按层数消费劫债', () => {
    const { owner, enemy, skill, projection } = setup();
    enemy.buffs.addBuff(BuffFactory.create({ id: JIUJIE_DEBT, name: '劫债', type: BuffType.DEBUFF, duration: 4, stackRule: StackRule.STACK_LAYER, maxLayers: 3, dispelPolicy: 'protected' }), owner);
    const debt = enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)!;
    debt.addLayer(2);
    owner.combatResources.set(JIUJIE_CALAMITY, 2);
    const config = resolveSectAbility({ sect: state(), realm: '化神', abilityId: 'nine-sky-settlement' }).config;
    expect(config.castConditions).toEqual(expect.arrayContaining([{ type: 'has_tag', params: expect.objectContaining({ scope: 'target' }) }]));
    const settlements = config.effects?.filter((effect) => effect.type === 'consume_status_trigger') ?? [];
    expect(settlements.find((effect) => effect.type === 'consume_status_trigger' && effect.params.match.id === JIUJIE_DEBT)).toMatchObject({ params: { scaleEffectsByLayer: true, consume: 'all' } });
    expect(settlements.find((effect) => effect.type === 'consume_status_trigger' && effect.params.match.id === JIUJIE_REOFFEND)).toMatchObject({ params: { scaleEffectsByLayer: true, consume: 'all' } });
    expect(projection.resources[0].max).toBe(3);
    void skill;
  });

  it('天谴加身记录伤害主罪，重复同类行为增加重犯并在终式兑现', () => {
    const { owner, enemy, skill } = setup(JIUJIE_CONDEMNATION_PATH_ID);
    cast(skill('heaven-hearing'), owner, enemy);
    expect(enemy.tags.hasTag('Buff.Sect.jiujie.thunder')).toBe(true);
    const active = skill('thunder-prison-question');
    active.setOwner(enemy);
    beginRuntimeAction(enemy);
    publishSkill(enemy, owner, active);
    beginRuntimeAction(enemy);
    publishSkill(enemy, owner, active);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_SIN_DAMAGE)).toBeDefined();
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_REOFFEND)?.getLayer()).toBe(1);
    const support = skill('calamity-seal');
    support.setOwner(enemy);
    beginRuntimeAction(enemy);
    publishSkill(enemy, owner, support);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_SIN_DAMAGE)).toBeUndefined();
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_SIN_SUPPORT)).toBeDefined();
  });

  it('天谴加身将纯增益主动行为记录为扶持主罪', () => {
    const { owner, enemy, skill } = setup(JIUJIE_CONDEMNATION_PATH_ID);
    cast(skill('heaven-hearing'), owner, enemy);
    const support = skill('calamity-seal');
    support.setOwner(enemy);
    beginRuntimeAction(enemy);
    publishSkill(enemy, owner, support);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_SIN_SUPPORT)).toBeDefined();
  });

  it('庶行有录每回合只延长一次劫雷，两避成罪仍统计连续两次普攻', () => {
    const { owner, enemy, skill, projection } = setup(JIUJIE_CONDEMNATION_PATH_ID, [
      'condemnation-heaven-hearing',
      'condemnation-no-escape',
    ]);
    cast(skill('heaven-hearing'), owner, enemy);
    const basic = AbilityFactory.create(projection.defaultAttack!) as ActiveSkill;
    basic.setOwner(enemy);
    publishSkill(enemy, owner, basic);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_THUNDER)?.getDuration()).toBe(4);
    publishSkill(enemy, owner, basic);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_THUNDER)?.getDuration()).toBe(4);
    expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)?.getLayer()).toBe(1);
  });

  it.each([
    ['eye-true-record', 'eye-nine-gates', 0.60, DamageType.TRUE, false, false],
    ['eye-true-record', 'eye-heavenly-shield', 0.45, DamageType.TRUE, false, true],
    ['eye-true-record', 'eye-calamity-without-end', 0.45, DamageType.TRUE, false, false],
    ['eye-returning-law', 'eye-nine-gates', 1.00, DamageType.MAGICAL, true, false],
    ['eye-returning-law', 'eye-heavenly-shield', 0.35, DamageType.MAGICAL, true, true],
    ['eye-returning-law', 'eye-calamity-without-end', 0.35, DamageType.MAGICAL, true, false],
    ['eye-after-rain', 'eye-nine-gates', 1.00, DamageType.MAGICAL, false, false],
    ['eye-after-rain', 'eye-heavenly-shield', 0.35, DamageType.MAGICAL, false, true],
    ['eye-after-rain', 'eye-calamity-without-end', 0.35, DamageType.MAGICAL, false, false],
  ] as const)('劫眼第五层%s与终极层%s按既定顺序兑现承劫记忆', (
    fifthNode, ultimateNode, damageRatio, damageType, heals, shields,
  ) => {
    const { owner, enemy, skill } = setup(JIUJIE_EYE_PATH_ID, [fifthNode, ultimateNode]);
    cast(skill('receive-calamity'), owner, owner);
    const taken: DamageSegmentAppliedEvent = {
      type: 'DamageSegmentAppliedEvent', timestamp: Date.now(), caster: enemy, target: owner,
      resolution: damageResolution(enemy, owner, `${fifthNode}:${ultimateNode}`),
      damageSource: DamageSource.DIRECT, damageType: DamageType.PHYSICAL,
      finalDamage: 100, damageTaken: 100, beforeHp: owner.getCurrentHp(),
      remainHp: owner.getCurrentHp() - 100, shieldAbsorbed: 0, remainShield: 0,
      hpReachedZeroBeforeReactions: false,
    };
    EventBus.instance.publish(taken);
    owner.buffs.removeBuff(JIUJIE_EYE);
    owner.buffs.removeBuff('sect.jiujie.receive-calamity');
    owner.setHp(owner.getMaxHp() - 500);
    cast(skill('heaven-hearing'), owner, enemy);
    owner.combatResources.set(JIUJIE_CALAMITY, 3);
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>('DamageSegmentRequestedEvent', (event) => requests.push(event));
    const hpBefore = owner.getCurrentHp();
    cast(skill('nine-sky-settlement'), owner, enemy);

    const memoryDamage = requests.find((event) =>
      event.damageComponents?.some((component) => component.kind === 'memory'));
    expect(memoryDamage?.baseDamage).toBe(Math.round(100 * damageRatio));
    expect(memoryDamage?.damageType).toBe(damageType);
    expect(owner.getCurrentHp() - hpBefore).toBe(heals ? 25 : 0);
    expect(owner.getCurrentShield()).toBe(shields ? 60 : 0);
    expect(getBattleRuntimeState(owner).memories.has(JIUJIE_EYE)).toBe(false);

    const reopenedEye = owner.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_EYE);
    if (ultimateNode === 'eye-calamity-without-end') {
      expect(reopenedEye?.getDuration()).toBe(2);
    } else if (fifthNode === 'eye-after-rain') {
      expect(reopenedEye?.getDuration()).toBe(1);
    } else {
      expect(reopenedEye).toBeUndefined();
    }
  });

  it.each([
    ['condemnation-reoffend', 'condemnation-final-verdict'],
    ['condemnation-reoffend', 'condemnation-nine-crimes'],
    ['condemnation-reoffend', 'condemnation-heavenly-punishment'],
    ['condemnation-clear-book', 'condemnation-final-verdict'],
    ['condemnation-clear-book', 'condemnation-nine-crimes'],
    ['condemnation-clear-book', 'condemnation-heavenly-punishment'],
    ['condemnation-no-escape', 'condemnation-final-verdict'],
    ['condemnation-no-escape', 'condemnation-nine-crimes'],
    ['condemnation-no-escape', 'condemnation-heavenly-punishment'],
  ] as const)('天谴第五层%s与终极层%s遵守清算消费和保留优先级', (fifthNode, ultimateNode) => {
    const { owner, enemy, skill } = setup(JIUJIE_CONDEMNATION_PATH_ID, [fifthNode, ultimateNode]);
    const addLayered = (id: string, name: string, maxLayers: number, layers: number) => {
      const buff = BuffFactory.create({
        id, name, type: BuffType.DEBUFF, duration: 4,
        stackRule: StackRule.STACK_LAYER, maxLayers, dispelPolicy: 'protected',
        tags: [jiujieTag(id === JIUJIE_DEBT ? 'debt' : 'reoffend')],
      });
      enemy.buffs.addBuff(buff, owner);
      for (let index = 1; index < layers; index += 1) buff.addLayer(1);
    };
    enemy.buffs.addBuff(BuffFactory.create({
      id: JIUJIE_THUNDER, name: '劫雷', type: BuffType.DEBUFF, duration: 3,
      dispelPolicy: 'protected', tags: [jiujieTag('thunder'), jiujieTag('calamity')],
      statusTags: [jiujieTag('thunder'), jiujieTag('calamity')],
    }), owner);
    addLayered(JIUJIE_DEBT, '劫债', 3, 3);
    addLayered(JIUJIE_REOFFEND, '重犯', 2, 2);
    enemy.buffs.addBuff(BuffFactory.create({
      id: JIUJIE_SIN_DAMAGE, name: '主罪·伤害', type: BuffType.DEBUFF, duration: 4,
      dispelPolicy: 'protected', countsAsStatus: false,
      tags: [JIUJIE_SIN_DAMAGE, jiujieTag('sin')], statusTags: [JIUJIE_SIN_DAMAGE],
    }), owner);
    owner.combatResources.set(JIUJIE_CALAMITY, 3);
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>('DamageSegmentRequestedEvent', (event) => requests.push(event));
    cast(skill('nine-sky-settlement'), owner, enemy);

    expect(owner.combatResources.getCurrent(JIUJIE_CALAMITY)).toBe(
      ultimateNode === 'condemnation-final-verdict' ? 1 : 0,
    );
    expect(requests.filter((event) => event.damageType === DamageType.DOT)).toHaveLength(
      fifthNode === 'condemnation-reoffend' ? 2 : 0,
    );
    expect(enemy.buffs.getAllBuffIds().includes(JIUJIE_SIN_DAMAGE)).toBe(
      fifthNode === 'condemnation-clear-book',
    );
    expect(enemy.buffs.getAllBuffIds().includes(JIUJIE_DAMAGE_SENTENCE)).toBe(
      ultimateNode === 'condemnation-nine-crimes',
    );
    if (ultimateNode === 'condemnation-heavenly-punishment') {
      expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_THUNDER)?.getDuration()).toBe(2);
      expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)?.getLayer()).toBe(1);
    } else {
      expect(enemy.buffs.getAllBuffs().find((buff) => buff.id === JIUJIE_DEBT)).toBeUndefined();
    }
  });

  it('天威裁决以20%概率免疫法术或负面技能，普攻不触发该被动', () => {
    const { owner, enemy } = setup();
    const roll = vi.spyOn(Math, 'random').mockReturnValue(0.19);
    const incoming = AbilityFactory.create({
      slug: 'test.incoming-spell',
      name: '测试法术',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.FUNCTION.DAMAGE, GameplayTags.ABILITY.CHANNEL.MAGIC],
      effects: [],
    }) as ActiveSkill;
    incoming.setOwner(enemy);
    incoming.prepareCast({ caster: enemy, target: owner });
    const preCast: SkillPreCastEvent = {
      type: 'SkillPreCastEvent', timestamp: Date.now(), caster: enemy, target: owner,
      ability: incoming, isInterrupted: false, interruptPolicy: 'uninterruptible',
    };
    EventBus.instance.publish(preCast);
    expect(preCast.isInterrupted).toBe(true);
    expect(preCast.isImmune).toBe(true);

    const debuff = AbilityFactory.create({
      slug: 'test.incoming-debuff', name: '测试负面技能', type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.FUNCTION.DEBUFF], effects: [],
    }) as ActiveSkill;
    debuff.setOwner(enemy);
    debuff.prepareCast({ caster: enemy, target: owner });
    const debuffPreCast: SkillPreCastEvent = {
      type: 'SkillPreCastEvent', timestamp: Date.now(), caster: enemy, target: owner,
      ability: debuff, isInterrupted: false,
    };
    EventBus.instance.publish(debuffPreCast);
    expect(debuffPreCast.isImmune).toBe(true);

    const physical = AbilityFactory.create({
      slug: 'test.incoming-physical', name: '测试物理术', type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.FUNCTION.DAMAGE, GameplayTags.ABILITY.CHANNEL.PHYSICAL], effects: [],
    }) as ActiveSkill;
    physical.setOwner(enemy);
    physical.prepareCast({ caster: enemy, target: owner });
    const physicalPreCast: SkillPreCastEvent = {
      type: 'SkillPreCastEvent', timestamp: Date.now(), caster: enemy, target: owner,
      ability: physical, isInterrupted: false,
    };
    EventBus.instance.publish(physicalPreCast);
    expect(physicalPreCast.isImmune).not.toBe(true);

    const basic = AbilityFactory.create({
      slug: 'test.incoming-basic', name: '测试普攻', type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.BASIC, GameplayTags.ABILITY.FUNCTION.DAMAGE], effects: [],
    }) as ActiveSkill;
    basic.setOwner(enemy);
    basic.prepareCast({ caster: enemy, target: owner });
    const basicPreCast: SkillPreCastEvent = {
      type: 'SkillPreCastEvent', timestamp: Date.now(), caster: enemy, target: owner,
      ability: basic, isInterrupted: false,
    };
    EventBus.instance.publish(basicPreCast);
    expect(basicPreCast.isInterrupted).toBe(false);

    const selfSpell = AbilityFactory.create({
      slug: 'test.self-spell', name: '测试自身法术', type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.FUNCTION.BUFF], effects: [],
    }) as ActiveSkill;
    selfSpell.setOwner(owner);
    selfSpell.prepareCast({ caster: owner, target: owner });
    const selfPreCast: SkillPreCastEvent = {
      type: 'SkillPreCastEvent', timestamp: Date.now(), caster: owner, target: owner,
      ability: selfSpell, isInterrupted: false,
    };
    EventBus.instance.publish(selfPreCast);
    expect(selfPreCast.isInterrupted).toBe(false);
    roll.mockReturnValue(0.19);
    roll.mockRestore();
  });
});
