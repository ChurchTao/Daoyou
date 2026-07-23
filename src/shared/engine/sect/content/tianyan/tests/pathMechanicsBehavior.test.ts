import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type {
  ActionPreEvent,
  DamageRequestEvent,
  DamageTakenEvent,
  RoundStartEvent,
  SkillCastEvent,
} from '@shared/engine/battle-v5/core/events';
import { withBattleRandomSource } from '@shared/engine/battle-v5/core/BattleRandom';
import {
  beginRuntimeAction,
  setRuntimeRound,
} from '@shared/engine/battle-v5/core/runtimeState';
import {
  AttributeType,
  BuffType,
  DamageSource,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { DamageSystem } from '@shared/engine/battle-v5/systems/DamageSystem';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectSectCombat, resolveSectAbility } from '../..';
import {
  TIANYAN_DERIVATION,
  TIANYAN_DISPEL_TRUTH_COOLDOWN,
  TIANYAN_ELEMENT_SEAL,
  TIANYAN_HETU_PATH_ID,
  TIANYAN_HIDDEN_EDGE,
  TIANYAN_HIDDEN_FIRE,
  TIANYAN_LUOSHU_PATH_ID,
  TIANYAN_REVERSE_SHIFT,
} from '../ids';
import { createElementSeal } from '../shared/seals';
import { TIANYAN_SEAL_STATE_TAGS } from '../shared/reactions';
import { tianyanState, type TianyanPathId } from './testState';

function unit(id: string): Unit {
  const result = new Unit(id, id, {
    [AttributeType.VITALITY]: 120,
    [AttributeType.SPIRIT]: 120,
    [AttributeType.WISDOM]: 120,
    [AttributeType.SPEED]: 120,
    [AttributeType.WILLPOWER]: 120,
  });
  result.restoreMp(100_000);
  return result;
}

function setup(pathId: TianyanPathId, nodes: string[] = []) {
  const sect = tianyanState(pathId, nodes);
  const projection = projectSectCombat({ sect, realm: '化神' })!;
  const owner = unit('owner');
  const enemy = unit('enemy');
  for (const resource of projection.resources) owner.combatResources.define(resource);
  for (const config of projection.abilities.filter((ability) =>
    ability.type === 'passive_skill')) {
    owner.abilities.addAbility(AbilityFactory.create(config));
  }
  const skill = (abilityId: string) => {
    const config = resolveSectAbility({ sect, realm: '化神', abilityId }).config;
    const result = AbilityFactory.create(config) as ActiveSkill;
    result.setOwner(owner);
    result.setActive(true);
    return result;
  };
  return { owner, enemy, skill };
}

function cast(skill: ActiveSkill, caster: Unit, target: Unit): void {
  skill.prepareCast({ caster, target });
  skill.execute({ caster, target });
}

function castWithRoll(
  skill: ActiveSkill,
  caster: Unit,
  target: Unit,
  roll: number,
): SkillCastEvent {
  const event: SkillCastEvent = {
    type: 'SkillCastEvent',
    timestamp: Date.now(),
    caster,
    target,
    ability: skill,
  };
  skill.prepareCast({ caster, target });
  withBattleRandomSource({ next: () => roll }, () => {
    EventBus.instance.publish(event);
    skill.execute({ caster, target, shouldApplyEffects: event.isHit });
  });
  return event;
}

describe('天衍衍数与双道途实际结算', () => {
  let damageSystem: DamageSystem;

  beforeEach(() => {
    EventBus.instance.reset();
    damageSystem = new DamageSystem();
  });
  afterEach(() => {
    damageSystem.destroy();
    EventBus.instance.reset();
  });

  it('第三次反应触发河图周天：主伤增幅、回复、延长新印并清空衍数', () => {
    const { owner, enemy, skill } = setup(TIANYAN_HETU_PATH_ID);
    owner.combatResources.set(TIANYAN_DERIVATION, 2);
    owner.setHp(Math.floor(owner.getMaxHp() * 0.6));
    owner.takeMp(Math.floor(owner.getMaxMp() * 0.3));
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('wood', 2)), owner);
    const hpBefore = owner.getCurrentHp();
    const mpBefore = owner.getCurrentMp();
    let directRequest: DamageRequestEvent | undefined;
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => {
        if (event.damageSource === DamageSource.DIRECT) directRequest = event;
      },
      -1_000,
    );

    cast(skill('flowing-flame'), owner, enemy);

    expect(directRequest?.damageIncreasePctBucket).toBeCloseTo(0.20, 8);
    expect(owner.getCurrentHp()).toBeGreaterThan(hpBefore);
    expect(owner.getCurrentMp()).toBeGreaterThan(mpBefore - 28);
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(0);
    expect(
      enemy.buffs.getAllBuffs().find((buff) => buff.id === TIANYAN_ELEMENT_SEAL)
        ?.getDuration(),
    ).toBe(3);
  });

  it('第三次反应触发洛书断局，与冲克追伤按两个cause分别结算', () => {
    const { owner, enemy, skill } = setup(TIANYAN_LUOSHU_PATH_ID);
    owner.combatResources.set(TIANYAN_DERIVATION, 2);
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);
    const followUps: DamageTakenEvent[] = [];
    EventBus.instance.subscribe<DamageTakenEvent>(
      'DamageTakenEvent',
      (event) => {
        if (event.damageSource === DamageSource.FOLLOW_UP) followUps.push(event);
      },
      -1_000,
    );

    cast(skill('dark-water-return'), owner, enemy);

    expect(followUps.map((event) => event.cause?.displayName)).toEqual([
      '冲克·蒸发',
      '洛书断局',
    ]);
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(0);
  });

  it('第一变只在首次命中无印目标时返还实付法力并留下3回合法印', () => {
    const { owner, enemy, skill } = setup(TIANYAN_LUOSHU_PATH_ID, [
      'luoshu-first-change',
    ]);
    const before = owner.getCurrentMp();
    const water = skill('dark-water-return');

    cast(water, owner, enemy);

    expect(owner.getCurrentMp()).toBe(before);
    expect(
      enemy.buffs.getAllBuffs().find((buff) => buff.id === TIANYAN_ELEMENT_SEAL)
        ?.getDuration(),
    ).toBe(3);

    enemy.buffs.removeBuff(TIANYAN_ELEMENT_SEAL);
    cast(skill('flowing-flame'), owner, enemy);

    expect(owner.getCurrentMp()).toBeLessThan(before);
    expect(
      enemy.buffs.getAllBuffs().find((buff) => buff.id === TIANYAN_ELEMENT_SEAL)
        ?.getDuration(),
    ).toBe(2);
  });

  it('第一变在闪避时不消费首次机会，后续首次命中仍全额返还', () => {
    const { owner, enemy, skill } = setup(TIANYAN_LUOSHU_PATH_ID, [
      'luoshu-first-change',
    ]);
    const water = skill('dark-water-return');
    const before = owner.getCurrentMp();

    const miss = castWithRoll(water, owner, enemy, 0);
    const afterMiss = owner.getCurrentMp();

    expect(miss.isHit).toBe(false);
    expect(afterMiss).toBeLessThan(before);
    expect(enemy.buffs.getAllBuffIds()).not.toContain(TIANYAN_ELEMENT_SEAL);

    const hit = castWithRoll(water, owner, enemy, 0.99);
    expect(hit.isHit).toBe(true);
    expect(owner.getCurrentMp()).toBe(afterMiss);
    expect(
      enemy.buffs.getAllBuffs().find((buff) => buff.id === TIANYAN_ELEMENT_SEAL)
        ?.getDuration(),
    ).toBe(3);
  });

  it('太初留白同一回合只在首次命中带印目标时回复法力', () => {
    const { owner, enemy, skill } = setup(TIANYAN_HETU_PATH_ID, [
      'hetu-blank-breath',
    ]);
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('earth', 2)), owner);
    owner.takeMp(Math.floor(owner.getMaxMp() * 0.5));
    setRuntimeRound(owner, 1);
    const before = owner.getCurrentMp();

    cast(skill('primordial-ray'), owner, enemy);
    const afterFirst = owner.getCurrentMp();
    enemy.setHp(enemy.getMaxHp());
    cast(skill('primordial-ray'), owner, enemy);

    expect(afterFirst - before).toBe(Math.round(owner.getMaxMp() * 0.04));
    expect(owner.getCurrentMp()).toBe(afterFirst);

    setRuntimeRound(owner, 2);
    enemy.setHp(enemy.getMaxHp());
    cast(skill('primordial-ray'), owner, enemy);
    expect(owner.getCurrentMp()).toBe(afterFirst + Math.round(owner.getMaxMp() * 0.04));
  });

  it('移宫承流同一回合最多获得一次衍数', () => {
    const { owner, enemy, skill } = setup(TIANYAN_HETU_PATH_ID, [
      'hetu-shift-carries',
    ]);
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('wood', 2)), owner);
    setRuntimeRound(owner, 1);

    cast(skill('shift-palace'), owner, enemy);
    cast(skill('shift-palace'), owner, enemy);

    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(1);
    setRuntimeRound(owner, 2);
    cast(skill('shift-palace'), owner, enemy);
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(2);
  });

  it('倒演两宫只强化下一次反应，无反应覆盖不会消费强化', () => {
    const { owner, enemy, skill } = setup(TIANYAN_LUOSHU_PATH_ID, [
      'luoshu-reverse-two',
    ]);
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('water', 2)), owner);
    const directRequests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => {
        if (event.damageSource === DamageSource.DIRECT) directRequests.push(event);
      },
      -1_000,
    );

    cast(skill('shift-palace'), owner, enemy);
    expect(owner.buffs.getAllBuffIds()).toContain(TIANYAN_REVERSE_SHIFT);

    cast(skill('metal-cloud-cutter'), owner, enemy);
    expect(directRequests.at(-1)?.damageIncreasePctBucket ?? 0).toBe(0);
    expect(owner.buffs.getAllBuffIds()).toContain(TIANYAN_REVERSE_SHIFT);

    enemy.setHp(enemy.getMaxHp());
    cast(skill('dark-water-return'), owner, enemy);
    expect(directRequests.at(-1)?.damageIncreasePctBucket).toBeCloseTo(0.20, 8);
    expect(owner.buffs.getAllBuffIds()).not.toContain(TIANYAN_REVERSE_SHIFT);
  });

  it('斩护见真在三回合窗口内仅首次冲克执行驱散', () => {
    const { owner, enemy, skill } = setup(TIANYAN_LUOSHU_PATH_ID, [
      'luoshu-dispel-truth',
    ]);
    const ordinaryBuff = (id: string) => BuffFactory.create({
      id,
      name: id,
      type: BuffType.BUFF,
      duration: 5,
    });
    enemy.buffs.addBuff(ordinaryBuff('test.buff.one'), enemy);
    enemy.buffs.addBuff(ordinaryBuff('test.buff.two'), enemy);
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);

    cast(skill('dark-water-return'), owner, enemy);

    expect(owner.buffs.getAllBuffIds()).toContain(TIANYAN_DISPEL_TRUTH_COOLDOWN);
    expect(
      enemy.buffs.getAllBuffIds().filter((id) => id.startsWith('test.buff.')),
    ).toHaveLength(1);

    enemy.setHp(enemy.getMaxHp());
    cast(skill('earth-bearing-seal'), owner, enemy);
    expect(
      enemy.buffs.getAllBuffIds().filter((id) => id.startsWith('test.buff.')),
    ).toHaveLength(1);
  });

  it('失算犹存每回合只保留首次无反应覆盖，下一回合重新可用', () => {
    const { owner, enemy, skill } = setup(TIANYAN_LUOSHU_PATH_ID, [
      'luoshu-save-error',
    ]);
    const startRound = (turn: number) => EventBus.instance.publish<RoundStartEvent>({
      type: 'RoundStartEvent',
      timestamp: Date.now(),
      turn,
    });
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('water', 2)), owner);
    startRound(1);

    cast(skill('metal-cloud-cutter'), owner, enemy);
    expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.water)).toBe(true);

    enemy.setHp(enemy.getMaxHp());
    cast(skill('metal-cloud-cutter'), owner, enemy);
    expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.metal)).toBe(true);

    enemy.setHp(enemy.getMaxHp());
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('water', 2)), owner);
    startRound(2);
    cast(skill('metal-cloud-cutter'), owner, enemy);
    expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS.water)).toBe(true);
  });

  it('秘法把衍数加到3时不自行触发周天，等待下一次反应', () => {
    const { owner, enemy, skill } = setup(TIANYAN_HETU_PATH_ID, [
      'hetu-repository-remnant',
    ]);
    owner.combatResources.set(TIANYAN_DERIVATION, 2);
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('wood', 2)), owner);

    cast(skill('five-qi-repository'), owner, enemy);
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(3);

    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('wood', 2)), owner);
    cast(skill('flowing-flame'), owner, enemy);
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(0);
  });

  it('碎印夺机在低血反应后粉碎新印并以主伤害记忆追伤，冷却内不重复', () => {
    const { owner, enemy, skill } = setup(TIANYAN_LUOSHU_PATH_ID, [
      'luoshu-shatter-seal',
    ]);
    enemy.attributes.addModifier({
      id: 'test.large-hp',
      attrType: AttributeType.MAX_HP,
      type: ModifierType.OVERRIDE,
      value: 10_000,
    });
    enemy.updateDerivedStats();
    enemy.setHp(3_500);
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);
    const followUps: DamageTakenEvent[] = [];
    EventBus.instance.subscribe<DamageTakenEvent>(
      'DamageTakenEvent',
      (event) => {
        if (event.damageSource === DamageSource.FOLLOW_UP) followUps.push(event);
      },
      -1_000,
    );

    cast(skill('dark-water-return'), owner, enemy);

    expect(followUps.map((event) => event.cause?.displayName)).toContain('碎印夺机');
    expect(enemy.buffs.getAllBuffIds()).not.toContain(TIANYAN_ELEMENT_SEAL);

    enemy.setHp(3_500);
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);
    const beforeSecond = followUps.filter(
      (event) => event.cause?.displayName === '碎印夺机',
    ).length;
    cast(skill('dark-water-return'), owner, enemy);
    expect(followUps.filter(
      (event) => event.cause?.displayName === '碎印夺机',
    )).toHaveLength(beforeSecond);
  });

  it('天机尽处只在施法快照低于35%气血时加入已损气血系数', () => {
    const { owner, enemy, skill } = setup(TIANYAN_LUOSHU_PATH_ID, [
      'luoshu-heaven-ends',
    ]);
    const requests: DamageRequestEvent[] = [];
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      (event) => {
        if (event.damageSource === DamageSource.DIRECT) requests.push(event);
      },
      -1_000,
    );

    enemy.setHp(Math.floor(enemy.getMaxHp() * 0.50));
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);
    cast(skill('dark-water-return'), owner, enemy);
    const aboveThreshold = requests.at(-1)?.baseDamage ?? 0;

    enemy.setHp(Math.ceil(enemy.getMaxHp() * 0.35));
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);
    cast(skill('dark-water-return'), owner, enemy);
    const exactlyThreshold = requests.at(-1)?.baseDamage ?? 0;

    enemy.setHp(Math.floor(enemy.getMaxHp() * 0.30));
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('fire', 2)), owner);
    cast(skill('dark-water-return'), owner, enemy);
    const belowThreshold = requests.at(-1)?.baseDamage ?? 0;

    const expectedBonus = Math.round(
      owner.attributes.getValue(AttributeType.MAGIC_ATK) * 0.60 * 0.70,
    );
    expect(exactlyThreshold).toBe(aboveThreshold);
    expect(belowThreshold - aboveThreshold).toBeCloseTo(expectedBonus, 0);
  });

  it('青华不竭只在木行治疗回满时于同一行动产生一次施术者护盾', () => {
    const { owner, enemy, skill } = setup(TIANYAN_HETU_PATH_ID, [
      'hetu-verdant-endless',
    ]);
    owner.setHp(Math.floor(owner.getMaxHp() * 0.99));
    const beforeShield = owner.getCurrentShield();

    cast(skill('verdant-pulse'), owner, enemy);
    const afterFirst = owner.getCurrentShield();
    enemy.setHp(enemy.getMaxHp());
    cast(skill('verdant-pulse'), owner, enemy);

    expect(afterFirst - beforeShield).toBe(
      Math.round(owner.getMaxHp() * 0.04),
    );
    expect(owner.getCurrentShield()).toBe(afterFirst);
  });

  it('青华不竭也识别回春HOT作为木行来源，并在回满时给予护盾', () => {
    const { owner, skill } = setup(TIANYAN_HETU_PATH_ID, [
      'hetu-verdant-endless',
    ]);
    owner.setHp(Math.floor(owner.getMaxHp() * 0.80));

    cast(skill('myriad-wood-renewal'), owner, owner);
    expect(owner.getCurrentShield()).toBe(0);

    for (let action = 0; action < 2; action += 1) {
      beginRuntimeAction(owner);
      EventBus.instance.publish<ActionPreEvent>({
        type: 'ActionPreEvent',
        timestamp: Date.now(),
        caster: owner,
      });
    }

    expect(owner.getCurrentHp()).toBe(owner.getMaxHp());
    expect(owner.getCurrentShield()).toBe(Math.round(owner.getMaxHp() * 0.04));
  });

  it('遁一归元按主动栏非落印数量统一提高宗门直伤、治疗与护盾', () => {
    const makeSect = (loadout: string[]) => {
      const sect = tianyanState(TIANYAN_HETU_PATH_ID, [
        'hetu-escaped-one-returns',
      ]);
      sect.abilityLoadout = loadout;
      return sect;
    };
    const noUtility = makeSect([
      'verdant-pulse',
      'flowing-flame',
      'earth-bearing-seal',
      'dark-water-return',
    ]);
    const twoUtilities = makeSect([
      'verdant-pulse',
      'myriad-wood-renewal',
      'boundless-earth',
      'dark-water-return',
    ]);
    const config = (sect: ReturnType<typeof makeSect>, abilityId: string) =>
      resolveSectAbility({ sect, realm: '化神', abilityId }).config;
    const directCoefficient = (sect: ReturnType<typeof makeSect>) => {
      const effect = config(sect, 'primordial-ray').effects?.find(
        (entry) => entry.type === 'damage',
      );
      return effect?.type === 'damage' ? effect.params.value.coefficient ?? 0 : 0;
    };
    const healRatio = (sect: ReturnType<typeof makeSect>) => {
      const effect = config(sect, 'myriad-wood-renewal').effects?.find(
        (entry) => entry.type === 'heal',
      );
      return effect?.type === 'heal' ? effect.params.value.targetMaxHpRatio ?? 0 : 0;
    };
    const shieldRatio = (sect: ReturnType<typeof makeSect>) => {
      const effect = config(sect, 'boundless-earth').effects?.find(
        (entry) => entry.type === 'shield',
      );
      return effect?.type === 'shield'
        ? effect.params.value.targetMaxHpRatio ?? 0
        : 0;
    };

    expect(directCoefficient(twoUtilities) / directCoefficient(noUtility))
      .toBeCloseTo(1.16, 8);
    expect(healRatio(twoUtilities) / healRatio(noUtility)).toBeCloseTo(1.16, 8);
    expect(shieldRatio(twoUtilities) / shieldRatio(noUtility)).toBeCloseTo(1.16, 8);
  });

  it('移宫换宿和五气归藏在无印目标上均不可触发且不会支付费用', () => {
    const { owner, enemy, skill } = setup(TIANYAN_HETU_PATH_ID);
    const shift = skill('shift-palace');
    const repository = skill('five-qi-repository');
    const before = owner.getCurrentMp();

    expect(shift.canTrigger({ caster: owner, target: enemy })).toBe(false);
    expect(repository.canTrigger({ caster: owner, target: enemy })).toBe(false);
    expect(owner.getCurrentMp()).toBe(before);
  });

  it('五气归藏消费木印并按印型结算收益，不触发反应或三数效果', () => {
    const { owner, enemy, skill } = setup(TIANYAN_HETU_PATH_ID);
    owner.setHp(Math.floor(owner.getMaxHp() * 0.5));
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal('wood', 2)), owner);
    const hpBefore = owner.getCurrentHp();

    cast(skill('five-qi-repository'), owner, enemy);

    expect(enemy.buffs.getAllBuffIds()).not.toContain(TIANYAN_ELEMENT_SEAL);
    expect(owner.getCurrentHp()).toBeGreaterThan(hpBefore);
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(0);
  });

  it.each([
    ['wood', 'hp'],
    ['fire', TIANYAN_HIDDEN_FIRE],
    ['earth', 'shield'],
    ['metal', TIANYAN_HIDDEN_EDGE],
    ['water', 'mp'],
  ] as const)('五气归藏完整结算%s印收益', (seal, expected) => {
    const { owner, enemy, skill } = setup(TIANYAN_HETU_PATH_ID);
    owner.setHp(Math.floor(owner.getMaxHp() * 0.5));
    owner.takeMp(Math.floor(owner.getMaxMp() * 0.5));
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal(seal, 2)), owner);
    const hpBefore = owner.getCurrentHp();
    const mpBefore = owner.getCurrentMp();
    const shieldBefore = owner.getCurrentShield();

    cast(skill('five-qi-repository'), owner, enemy);

    expect(enemy.buffs.getAllBuffIds()).not.toContain(TIANYAN_ELEMENT_SEAL);
    if (expected === 'hp') expect(owner.getCurrentHp()).toBeGreaterThan(hpBefore);
    else if (expected === 'mp') expect(owner.getCurrentMp()).toBeGreaterThan(mpBefore);
    else if (expected === 'shield') {
      expect(owner.getCurrentShield()).toBeGreaterThan(shieldBefore);
    } else expect(owner.buffs.getAllBuffIds()).toContain(expected);
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(0);
  });

  it.each([
    ['wood', 'fire'],
    ['fire', 'earth'],
    ['earth', 'metal'],
    ['metal', 'water'],
    ['water', 'wood'],
  ] as const)('移宫换宿将%s印沿相生方向转为%s印且不触发反应', (seal, expected) => {
    const { owner, enemy, skill } = setup(TIANYAN_HETU_PATH_ID);
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal(seal, 2)), owner);

    cast(skill('shift-palace'), owner, enemy);

    expect(enemy.tags.hasTag(TIANYAN_SEAL_STATE_TAGS[expected])).toBe(true);
    expect(owner.combatResources.getCurrent(TIANYAN_DERIVATION)).toBe(0);
  });

  it.each([
    ['fire', TIANYAN_HIDDEN_FIRE],
    ['metal', TIANYAN_HIDDEN_EDGE],
  ] as const)('%s印归藏获得的后续强化在闪避时保留、命中后消费', (seal, buffId) => {
    const { owner, enemy, skill } = setup(TIANYAN_HETU_PATH_ID);
    enemy.buffs.addBuff(BuffFactory.create(createElementSeal(seal, 2)), owner);
    cast(skill('five-qi-repository'), owner, enemy);
    expect(owner.buffs.getAllBuffIds()).toContain(buffId);

    const landing = skill('verdant-pulse');
    expect(castWithRoll(landing, owner, enemy, 0).isHit).toBe(false);
    expect(owner.buffs.getAllBuffIds()).toContain(buffId);

    expect(castWithRoll(landing, owner, enemy, 0.99).isHit).toBe(true);
    expect(owner.buffs.getAllBuffIds()).not.toContain(buffId);
  });
});
