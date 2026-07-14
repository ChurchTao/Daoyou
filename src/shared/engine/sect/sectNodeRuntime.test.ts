import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSkill } from '../battle-v5/abilities/ActiveSkill';
import { EventBus } from '../battle-v5/core/EventBus';
import type {
  ActionPostEvent,
  DamageRequestEvent,
  DodgeEvent,
} from '../battle-v5/core/events';
import {
  AttributeType,
  DamageSource,
  DamageType,
} from '../battle-v5/core/types';
import { AbilityFactory } from '../battle-v5/factories/AbilityFactory';
import { DamageSystem } from '../battle-v5/systems/DamageSystem';
import { Unit } from '../battle-v5/units/Unit';
import {
  LINGXIAO_HEAVY_POSTURE,
  LINGXIAO_SWORD_MOMENTUM,
} from './combatProjection';
import { projectSectCombat, resolveSectAbility } from './runtime';
import type { CultivatorSectState } from './types';

function sectState(
  pathId: 'swift-sword' | 'heavy-sword',
  nodes: string[],
): CultivatorSectState {
  return {
    membershipId: 'membership',
    sectId: 'lingxiao',
    status: 'active',
    contribution: 0,
    configVersion: 2,
    activePathId: pathId,
    methods: {
      'lingxiao-canon': 100,
      'sword-guidance': 100,
      'void-step': 100,
      'edge-cleansing': 100,
      'origin-returning': 100,
      'sword-nurturing': 100,
    },
    paths: [
      {
        pathId,
        level: 100,
        tacticId: pathId === 'swift-sword' ? 'aggressive' : 'heavy-break',
        activeMeridianSlot: 1,
        meridianLoadouts: [
          { slot: 1, nodeIds: nodes, version: 1 },
          { slot: 2, nodeIds: [], version: 1 },
          { slot: 3, nodeIds: [], version: 1 },
        ],
      },
    ],
    abilityLoadout: [
      'guiding-sword',
      'linked-edge',
      'breaking-edge',
      'sect-ultimate',
    ],
  };
}

function combatUnit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.WISDOM]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

function install(pathId: 'swift-sword' | 'heavy-sword', nodes: string[]) {
  const sect = sectState(pathId, nodes);
  const projection = projectSectCombat({ sect, realm: '化神' })!;
  const owner = combatUnit('owner');
  const enemy = combatUnit('enemy');
  for (const resource of projection.resources)
    owner.combatResources.define(resource);
  if (projection.defaultAttack) {
    owner.abilities.setDefaultAttack(
      AbilityFactory.create(projection.defaultAttack),
    );
  }
  for (const config of projection.abilities) {
    owner.abilities.addAbility(AbilityFactory.create(config));
  }
  return { sect, projection, owner, enemy };
}

describe('凌霄经脉运行时语义', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it('留势只记录实际溢出且在下一次收束后返还', () => {
    const { owner, enemy } = install('swift-sword', ['swift-retained-force']);
    owner.combatResources.set(LINGXIAO_SWORD_MOMENTUM, 5);
    owner.combatResources.modify(LINGXIAO_SWORD_MOMENTUM, 3);

    const finisher = owner.abilities.getAbility(
      'sect.lingxiao.breaking-edge',
    ) as ActiveSkill;
    finisher.execute({ caster: owner, target: enemy });

    expect(owner.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(2);
  });

  it('留架每次行动最多把2点实际溢出转换为护盾', () => {
    const { owner } = install('heavy-sword', ['heavy-retained-frame']);
    owner.combatResources.set(LINGXIAO_HEAVY_POSTURE, 6);
    owner.combatResources.modify(LINGXIAO_HEAVY_POSTURE, 3);
    const firstShield = owner.getCurrentShield();
    owner.combatResources.modify(LINGXIAO_HEAVY_POSTURE, 3);

    expect(firstShield).toBeGreaterThan(0);
    expect(owner.getCurrentShield()).toBe(firstShield);
  });

  it('回风不息的附加护盾每次回燕姿态最多触发一次', () => {
    const { sect, owner, enemy } = install('swift-sword', [
      'swift-unending-wind',
    ]);
    const turning = resolveSectAbility({
      sect,
      realm: '化神',
      abilityId: 'turning-body',
    }).config;
    const stance = turning.effects?.find(
      (effect) => effect.type === 'apply_buff',
    );
    AbilityFactory.createEffect(stance!)?.execute({
      caster: owner,
      target: enemy,
    });
    const dodge = (): void =>
      EventBus.instance.publish<DodgeEvent>({
        type: 'DodgeEvent',
        timestamp: Date.now(),
        caster: enemy,
        target: owner,
        ability: AbilityFactory.create(turning),
      });

    dodge();
    const firstShield = owner.getCurrentShield();
    dodge();

    expect(firstShield).toBeGreaterThan(0);
    expect(owner.getCurrentShield()).toBe(firstShield);
    expect(owner.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(2);
  });

  it('静潮在连续两个自身行动未收束后暂停衰减并强化下一次收束', () => {
    const { sect, owner, enemy } = install('swift-sword', ['swift-still-tide']);
    owner.combatResources.set(LINGXIAO_SWORD_MOMENTUM, 3);
    const actionPost = (): void =>
      EventBus.instance.publish<ActionPostEvent>({
        type: 'ActionPostEvent',
        timestamp: Date.now(),
        caster: owner,
      });

    owner.combatResources.beginAction();
    actionPost();
    owner.combatResources.finishAction(false, false);
    owner.combatResources.beginAction();
    actionPost();
    owner.combatResources.finishAction(false, false);
    expect(owner.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(2);

    const finisher = AbilityFactory.create(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'breaking-edge' })
        .config,
    );
    const request: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: owner,
      target: enemy,
      ability: finisher,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.PHYSICAL,
      baseDamage: 100,
      finalDamage: 100,
    };
    EventBus.instance.publish(request);

    expect(request.damageIncreasePctBucket).toBeCloseTo(0.2);
  });

  it('藏重只降低整场战斗第一次直接伤害并获得3点剑架', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { owner, enemy } = install('heavy-sword', ['heavy-hidden-weight']);
    const damageSystem = new DamageSystem();
    const request = (): DamageRequestEvent => ({
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: enemy,
      target: owner,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.PHYSICAL,
      baseDamage: 1000,
      finalDamage: 1000,
    });
    const first = request();
    const second = request();

    EventBus.instance.publish(first);
    EventBus.instance.publish(second);

    expect(first.damageReductionPctBucket).toBeCloseTo(0.1);
    expect(second.damageReductionPctBucket).toBeUndefined();
    expect(first.finalDamage).toBeLessThan(second.finalDamage);
    expect(owner.combatResources.getCurrent(LINGXIAO_HEAVY_POSTURE)).toBe(3);
    damageSystem.destroy();
  });

  it('横岳式把护盾施加给施法者而不是敌方目标', () => {
    const { sect, owner, enemy } = install('heavy-sword', []);
    const turning = AbilityFactory.create(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'turning-body' })
        .config,
    ) as ActiveSkill;

    turning.execute({ caster: owner, target: enemy });

    expect(owner.getCurrentShield()).toBeGreaterThan(0);
    expect(enemy.getCurrentShield()).toBe(0);
  });
});
