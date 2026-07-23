import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type {
  ActionPostEvent,
  DamageRequestEvent,
  DodgeEvent,
} from '@shared/engine/battle-v5/core/events';
import { consumeQueuedAction } from '@shared/engine/battle-v5/core/runtimeState';
import {
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
} from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { DamageSystem } from '@shared/engine/battle-v5/systems/DamageSystem';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LINGXIAO_SWORD_MOMENTUM } from '..';
import { projectSectCombat, resolveSectAbility } from '../..';
import type { CultivatorSectState } from '../../../core';

function sectState(
  pathId: 'swift-sword' | 'heavy-sword',
  nodes: string[],
): CultivatorSectState {
  return {
    membershipId: 'membership',
    sectId: 'lingxiao',
    status: 'active',
    contribution: 0,
    configVersion: 4,
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
        unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
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

describe('红尘剑宗参悟运行时语义', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it('留痕使剑荡山河施加两层剑痕', () => {
    const { owner, enemy } = install('swift-sword', ['swift-retained-force']);
    const linked = owner.abilities.getAbility(
      'sect.lingxiao.linked-edge',
    ) as ActiveSkill;
    linked.execute({ caster: owner, target: enemy });
    expect(
      enemy.buffs
        .getAllBuffs()
        .find((buff) => buff.id === 'sect.lingxiao.sword-mark')
        ?.getLayer(),
    ).toBe(2);
  });

  it('守心在开始蓄势时立即获得成长后的护盾', () => {
    const { sect } = install('heavy-sword', ['heavy-retained-frame']);
    const ability = resolveSectAbility({
      sect,
      realm: '化神',
      abilityId: 'turning-body',
    }).config;
    expect(ability.castEffects).toContainEqual(
      expect.objectContaining({ type: 'shield' }),
    );
    const queue = ability.castEffects?.find(
      (effect) => effect.type === 'queue_action',
    );
    expect(
      queue?.type === 'queue_action' ? queue.params : undefined,
    ).toMatchObject({
      interruptPolicy: 'uninterruptible',
      hitPolicy: 'guaranteed',
    });
  });

  it('回风的附加护盾每次藏锋听雷持续期间最多触发一次', () => {
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
    expect(owner.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(1);
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
    expect(owner.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(3);

    const finisher = AbilityFactory.create(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'sect-ultimate' })
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

    expect(request.damageIncreasePctBucket).toBeCloseTo(0.15);
  });

  it('承锋只降低整场战斗第一次直接伤害并获得2点剑意', () => {
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

    expect(first.damageReductionPctBucket).toBeCloseTo(0.15);
    expect(second.damageReductionPctBucket).toBeUndefined();
    expect(first.finalDamage).toBeLessThan(second.finalDamage);
    expect(owner.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(2);
    damageSystem.destroy();
  });

  it('藏锋听雷把减伤与后发登记给施法者而不立即攻击目标', () => {
    const { sect, owner, enemy } = install('heavy-sword', []);
    const turning = AbilityFactory.create(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'turning-body' })
        .config,
    ) as ActiveSkill;

    turning.execute({ caster: owner, target: enemy });

    expect(owner.buffs.getAllBuffIds()).toContain(
      'sect.lingxiao.heavy.hidden-edge',
    );
    expect(owner.getCurrentShield()).toBe(0);
    expect(enemy.getCurrentShield()).toBe(0);
  });

  it('快剑藏锋未命中时整条普通效果链失效', () => {
    const { sect, owner, enemy } = install('swift-sword', []);
    const turning = AbilityFactory.create(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'turning-body' })
        .config,
    ) as ActiveSkill;
    const hpBefore = enemy.getCurrentHp();

    turning.execute({
      caster: owner,
      target: enemy,
      shouldApplyEffects: false,
    });

    expect(enemy.getCurrentHp()).toBe(hpBefore);
    expect(owner.buffs.getAllBuffIds()).not.toContain(
      'sect.lingxiao.returning-swallow',
    );
    expect(owner.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(0);
  });

  it('基础与重剑藏锋不依赖前置命中并正常登记后发', () => {
    for (const pathId of ['heavy-sword'] as const) {
      const { sect, owner, enemy } = install(pathId, []);
      const turning = AbilityFactory.create(
        resolveSectAbility({ sect, realm: '化神', abilityId: 'turning-body' })
          .config,
      ) as ActiveSkill;
      turning.execute({
        caster: owner,
        target: enemy,
        shouldApplyEffects: false,
      });
      expect(consumeQueuedAction(owner)?.ability.name).toBe('听雷');
      expect(owner.buffs.getAllBuffIds()).toContain(
        'sect.lingxiao.heavy.hidden-edge',
      );
    }

    const sect = sectState('heavy-sword', []);
    sect.activePathId = undefined;
    sect.paths = [];
    const projection = projectSectCombat({ sect, realm: '化神' })!;
    const owner = combatUnit('base-owner');
    const enemy = combatUnit('base-enemy');
    for (const resource of projection.resources)
      owner.combatResources.define(resource);
    const turning = AbilityFactory.create(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'turning-body' })
        .config,
    ) as ActiveSkill;
    turning.execute({
      caster: owner,
      target: enemy,
      shouldApplyEffects: false,
    });
    expect(consumeQueuedAction(owner)?.ability.name).toBe('听雷');
  });

  it('重剑攻击未命中时不获得护盾和剑意，一剑破妄也不驱散', () => {
    const { sect, owner, enemy } = install('heavy-sword', []);
    for (const abilityId of ['guiding-sword', 'linked-edge']) {
      const ability = AbilityFactory.create(
        resolveSectAbility({ sect, realm: '化神', abilityId }).config,
      ) as ActiveSkill;
      ability.execute({
        caster: owner,
        target: enemy,
        shouldApplyEffects: false,
      });
    }
    expect(owner.getCurrentShield()).toBe(0);
    expect(owner.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(0);

    enemy.buffs.addBuff(
      BuffFactory.create({
        id: 'test.positive',
        name: '测试增益',
        type: BuffType.BUFF,
        duration: 3,
        stackRule: StackRule.OVERRIDE,
        tags: [GameplayTags.BUFF.TYPE.BUFF],
      }),
      enemy,
    );
    const breaking = AbilityFactory.create(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'breaking-edge' })
        .config,
    ) as ActiveSkill;
    breaking.execute({
      caster: owner,
      target: enemy,
      shouldApplyEffects: false,
    });
    expect(enemy.buffs.getAllBuffIds()).toContain('test.positive');
  });

  it('快剑姿态提前重施会替换旧修改器并重置首次闪避预算', () => {
    for (const abilityId of ['turning-body', 'shadow-step']) {
      const { sect, owner, enemy } = install('swift-sword', []);
      const ability = AbilityFactory.create(
        resolveSectAbility({ sect, realm: '化神', abilityId }).config,
      ) as ActiveSkill;
      const target = abilityId === 'shadow-step' ? owner : enemy;
      const dodge = (): void =>
        EventBus.instance.publish<DodgeEvent>({
          type: 'DodgeEvent',
          timestamp: Date.now(),
          caster: enemy,
          target: owner,
          ability,
        });

      ability.execute({ caster: owner, target });
      const modifiedEvasion = owner.attributes.getValue(
        AttributeType.EVASION_RATE,
      );
      dodge();
      expect(owner.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(1);

      ability.execute({ caster: owner, target });
      expect(owner.attributes.getValue(AttributeType.EVASION_RATE)).toBeCloseTo(
        modifiedEvasion,
      );
      dodge();
      expect(owner.combatResources.getCurrent(LINGXIAO_SWORD_MOMENTUM)).toBe(2);
    }
  });
});
