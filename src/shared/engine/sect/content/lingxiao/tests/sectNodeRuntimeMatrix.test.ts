import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import {
  consumeQueuedAction,
  getActionStateViews,
} from '@shared/engine/battle-v5/core/runtimeState';
import type {
  ActionPostEvent,
  BattleInitEvent,
  BuffAppliedEvent,
  CombatResourceChangeEvent,
  CooldownModifyEvent,
  DamageRequestEvent,
  DamageTakenEvent,
  DodgeEvent,
  HealEvent,
  RoundStartEvent,
  ShieldBreakEvent,
  ShieldEvent,
  SkillCastEvent,
} from '@shared/engine/battle-v5/core/events';
import {
  AbilityType,
  AttributeType,
  DamageSource,
  DamageType,
} from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { afterEach, describe, expect, it } from 'vitest';
import { productionSectRuntime } from '../..';
import type { CultivatorSectState } from '../../../core';
import { LINGXIAO_MODULE } from '../LingxiaoSectModule';
import { HEAVY_SWORD_NODES } from '../paths/heavy/nodes';
import { SWIFT_SWORD_NODES } from '../paths/swift/nodes';
import { LINGXIAO_SWORD_MOMENTUM } from '../shared/LingxiaoMechanics';

type PathId = 'swift-sword' | 'heavy-sword';

interface RuntimeFingerprint {
  initialResource: number;
  resourceRule: string;
  damage: string[];
  resources: string[];
  shields: number[];
  heals: number[];
  buffs: string[];
  cooldowns: string[];
  actionStates: string[];
  finalResource: number;
  finalShield: number;
  finalHp: number;
  abilityCooldowns: string[];
}

function sectState(pathId: PathId, nodeId?: string): CultivatorSectState {
  return {
    membershipId: `runtime:${pathId}:${nodeId ?? 'baseline'}`,
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
    paths: [{
      pathId,
      unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
      tacticId: pathId === 'swift-sword' ? 'aggressive' : 'heavy-break',
      activeMeridianSlot: 1,
      meridianLoadouts: [
        { slot: 1, nodeIds: nodeId ? [nodeId] : [], version: 1 },
        { slot: 2, nodeIds: [], version: 1 },
        { slot: 3, nodeIds: [], version: 1 },
      ],
    }],
    abilityLoadout: [
      'guiding-sword',
      'linked-edge',
      'turning-body',
      'sect-ultimate',
    ],
  };
}

function unit(id: string): Unit {
  const value = 100;
  const result = new Unit(id, id, {
    [AttributeType.VITALITY]: value,
    [AttributeType.SPIRIT]: value,
    [AttributeType.WISDOM]: value,
    [AttributeType.SPEED]: value,
    [AttributeType.WILLPOWER]: value,
  });
  result.setMp(result.getMaxMp());
  return result;
}

function runtimeFingerprint(pathId: PathId, nodeId?: string): RuntimeFingerprint {
  EventBus.instance.reset();
  const projection = productionSectRuntime.compiler.compile(
    LINGXIAO_MODULE,
    { sect: sectState(pathId, nodeId), realm: '化神' },
  );
  const owner = unit('owner');
  const enemy = unit('enemy');
  enemy.setHp(Math.floor(enemy.getMaxHp() * 0.2));
  owner.setHp(Math.floor(owner.getMaxHp() * 0.5));
  for (const resource of projection.resources) owner.combatResources.define(resource);
  owner.abilities.setDefaultAttack(
    AbilityFactory.create(projection.abilities[projection.defaultAbilityId].config),
  );
  for (const ability of Object.values(projection.abilities)) {
    owner.abilities.addAbility(AbilityFactory.create(ability.config));
  }
  for (const passive of projection.passives) {
    owner.abilities.addAbility(AbilityFactory.create(passive));
  }
  const initialResource = owner.combatResources.getCurrent(
    LINGXIAO_SWORD_MOMENTUM,
  );
  const resourceDefinition = projection.resources[0];
  const trace: RuntimeFingerprint = {
    initialResource,
    resourceRule: [
      resourceDefinition.decayOnNoDirectDamage ?? '',
      resourceDefinition.decayOnControlledSkip ?? '',
      resourceDefinition.pauseDecayWhenCounterAtLeast?.key ?? '',
      resourceDefinition.pauseDecayWhenCounterAtLeast?.value ?? '',
    ].join('|'),
    damage: [],
    resources: [],
    shields: [],
    heals: [],
    buffs: [],
    cooldowns: [],
    actionStates: [],
    finalResource: 0,
    finalShield: 0,
    finalHp: 0,
    abilityCooldowns: [],
  };
  const bus = EventBus.instance;
  bus.subscribe<DamageRequestEvent>('DamageRequestEvent', (event) => {
    trace.damage.push([
      event.caster?.id,
      event.target.id,
      event.damageSource,
      Math.round(event.baseDamage * 100) / 100,
      event.forceCritical ? 'crit' : '',
      Math.round((event.damageReductionPctBucket ?? 0) * 100),
      Math.round((event.damageIncreasePctBucket ?? 0) * 100),
      (event.damageComponents ?? [])
        .map((component) => `${component.mitigation}:${Math.round(component.amount * 100) / 100}`)
        .join(','),
    ].join('|'));
  }, -1_000);
  bus.subscribe<CombatResourceChangeEvent>('CombatResourceChangeEvent', (event) => {
    trace.resources.push(
      `${event.operation}:${event.reason}:${event.applied}:${event.after}`,
    );
  }, -1_000);
  bus.subscribe<ShieldEvent>('ShieldEvent', (event) => {
    trace.shields.push(Math.round(event.shieldAmount));
  }, -1_000);
  bus.subscribe<HealEvent>('HealEvent', (event) => {
    trace.heals.push(Math.round(event.healAmount));
  }, -1_000);
  bus.subscribe<BuffAppliedEvent>('BuffAppliedEvent', (event) => {
    trace.buffs.push(`${event.buff.name}:${event.buff.getMaxDuration()}`);
  }, -1_000);
  bus.subscribe<CooldownModifyEvent>('CooldownModifyEvent', (event) => {
    trace.cooldowns.push(`${event.affectedAbilityName}:${event.cdModifyValue}`);
  }, -1_000);

  const enemyAttack = AbilityFactory.create({
    slug: 'runtime.enemy.attack',
    name: '测试攻击',
    type: AbilityType.ACTIVE_SKILL,
    tags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
    ],
    effects: [],
  });
  bus.publish<BattleInitEvent>({
    type: 'BattleInitEvent',
    timestamp: Date.now(),
    player: owner,
    opponent: enemy,
  });

  const execute = (abilityId: string, target: Unit): ActiveSkill => {
    const ability = owner.abilities.getAbility(
      `sect.lingxiao.${abilityId}`,
    ) as ActiveSkill;
    ability.execute({ caster: owner, target });
    return ability;
  };

  const turning = execute('turning-body', enemy);
  const queued = consumeQueuedAction(owner);
  if (queued) {
    (AbilityFactory.create(queued.ability) as ActiveSkill).execute({
      caster: owner,
      target: enemy,
    });
  }
  execute('shadow-step', owner);
  execute('sword-aegis', owner);
  execute('nurturing-sword', owner);
  bus.publish<DodgeEvent>({
    type: 'DodgeEvent',
    timestamp: Date.now(),
    caster: enemy,
    target: owner,
    ability: turning,
  });

  owner.setShield(Math.max(owner.getCurrentShield(), 1_000));
  const incomingRequest: DamageRequestEvent = {
    type: 'DamageRequestEvent',
    timestamp: Date.now(),
    caster: enemy,
    target: owner,
    ability: enemyAttack,
    damageSource: DamageSource.DIRECT,
    damageType: DamageType.PHYSICAL,
    baseDamage: 1_000,
    finalDamage: 1_000,
  };
  bus.publish(incomingRequest);
  bus.publish<DamageTakenEvent>({
    type: 'DamageTakenEvent',
    timestamp: Date.now(),
    caster: enemy,
    target: owner,
    ability: enemyAttack,
    damageSource: DamageSource.DIRECT,
    damageType: DamageType.PHYSICAL,
    damageTaken: 0,
    beforeHp: owner.getCurrentHp(),
    remainHp: owner.getCurrentHp(),
    shieldAbsorbed: 300,
    remainShield: 700,
    isLethal: false,
  });
  bus.publish<ShieldBreakEvent>({
    type: 'ShieldBreakEvent',
    timestamp: Date.now(),
    caster: enemy,
    target: owner,
    ability: enemyAttack,
    damageSource: DamageSource.DIRECT,
    brokenShieldAmount: 300,
    overflowDamage: 0,
  });

  bus.publish({
    type: 'ControlledSkipEvent',
    timestamp: Date.now(),
    unit: owner,
    controlTag: GameplayTags.STATUS.CONTROL.STUNNED,
  });
  const plain = owner.abilities.getAbility(
    'sect.lingxiao.plain-sword',
  ) as ActiveSkill;
  for (let index = 0; index < 2; index += 1) {
    bus.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      timestamp: Date.now(),
      caster: owner,
      target: enemy,
      ability: plain,
      isHit: true,
      isDodged: false,
    });
  }
  for (let index = 0; index < 2; index += 1) {
    bus.publish<ActionPostEvent>({
      type: 'ActionPostEvent',
      timestamp: Date.now(),
      caster: owner,
    });
  }

  execute('linked-edge', enemy);
  owner.combatResources.set(LINGXIAO_SWORD_MOMENTUM, 6);
  execute('sect-ultimate', enemy);
  execute('guiding-sword', enemy);
  plain.execute({ caster: owner, target: enemy });
  bus.publish<RoundStartEvent>({
    type: 'RoundStartEvent',
    timestamp: Date.now(),
    turn: 2,
  });

  trace.actionStates = getActionStateViews(owner).map(
    (state) => `${state.type}:${state.ability?.name ?? state.name}`,
  );
  trace.finalResource = owner.combatResources.getCurrent(
    LINGXIAO_SWORD_MOMENTUM,
  );
  trace.finalShield = owner.getCurrentShield();
  trace.finalHp = owner.getCurrentHp();
  trace.abilityCooldowns = owner.abilities
    .getAllAbilities()
    .filter((ability): ability is ActiveSkill => 'getCurrentCooldown' in ability)
    .map((ability) => `${ability.name}:${ability.getCurrentCooldown()}`)
    .sort();
  return trace;
}

const NODE_CASES = [
  ...SWIFT_SWORD_NODES.map((node) => ({
    pathId: 'swift-sword' as const,
    id: node.definition.id,
    name: node.definition.name,
  })),
  ...HEAVY_SWORD_NODES.map((node) => ({
    pathId: 'heavy-sword' as const,
    id: node.definition.id,
    name: node.definition.name,
  })),
];

describe('凌霄36参悟节点运行时矩阵', () => {
  afterEach(() => EventBus.instance.reset());

  it('节点清单保持快重各18个', () => {
    expect(NODE_CASES).toHaveLength(36);
    expect(new Set(NODE_CASES.map((node) => node.id)).size).toBe(36);
  });

  it.each(NODE_CASES)(
    '$pathId / $name（$id）产生可观测运行时语义',
    ({ pathId, id }) => {
      const baseline = runtimeFingerprint(pathId);
      const actual = runtimeFingerprint(pathId, id);
      expect(actual).not.toEqual(baseline);
    },
  );
});
