import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Buff, StackRule } from '../buffs/Buff';
import {
  SeededBattleRandomSource,
  withBattleRandomSource,
} from '../core/BattleRandom';
import type { AbilityConfig } from '../core/configs';
import { EventBus } from '../core/EventBus';
import type {
  ActionPostEvent,
  BuffLayerChangedEvent,
  DamageRequestEvent,
} from '../core/events';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  type CombatEvent,
} from '../core/types';
import { AbilityTransformEffect } from '../effects/AbilityTransformEffect';
import { CombatResourceModifyEffect } from '../effects/CombatResourceModifyEffect';
import { DelayedEffect } from '../effects/DelayedEffect';
import {
  EffectExecutionContextV3,
  executeGameplayEffectV3,
} from '../effects/Effect';
import { StatusSpreadEffect } from '../effects/StatusSpreadEffect';
import { AbilityFactory } from '../factories/AbilityFactory';
import { DamageSystem } from '../systems/DamageSystem';
import type { UnitStateSnapshot } from '../systems/state/types';
import { Unit } from '../units/Unit';
import {
  BattleRecordValidatorV3,
  validateBattleRecordV3,
} from './BattleRecordV3';
import { CombatFactNarratorV3 } from './CombatFactNarratorV3';
import { CombatPresenterV3 } from './CombatPresenterV3';
import { CombatFactSinkV3 } from './CombatFactSinkV3';
import type { CombatResultScopeV3 } from './CombatResultEmitterV3';
import { CombatResultEmitterV3 } from './CombatResultEmitterV3';
import type { CombatMechanicPayloadV3 } from './mechanics';
import { CombatAttributionV3, CombatSystemSourceV3 } from './origin';
import type {
  BattleRecordV3,
  CombatFactV3,
  CombatOriginV3,
  CombatSequenceV3,
  CombatStatusApplicationTransitionV3,
  CombatStatusLayerChangeReasonV3,
  CombatStatusRemovalReasonV3,
} from './types';

function unit(id: string, name: string, strength = 100): Unit {
  return new Unit(id, name, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.STRENGTH]: strength,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.ENDURANCE]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

function ownedOrigin(
  owner: Unit,
  carrier: CombatOriginV3 extends infer _T
    ? Extract<CombatOriginV3, { kind: 'owned' }>['carrier']
    : never,
): CombatOriginV3 {
  return {
    kind: 'owned',
    owner: { id: owner.id, name: owner.name },
    carrier,
  };
}

function publishDamage(
  builder: CombatFactSinkV3,
  sequenceId: string,
  caster: Unit,
  target: Unit,
  amount: number,
): void {
  const origin = ownedOrigin(caster, {
    kind: 'ability',
    id: 'test-strike',
    name: '测试攻击',
  });
  builder.runInFrame(
    { id: sequenceId, phase: 'action', turn: 1, actor: caster },
    () => {
      EventBus.instance.publish<DamageRequestEvent>({
        type: 'DamageRequestEvent',
        timestamp: Date.now(),
        caster,
        target,
        damageSource: DamageSource.DIRECT,
        damageType: DamageType.TRUE,
        calculationMode: 'resolved_final',
        baseDamage: amount,
        finalDamage: amount,
        origin,
      });
    },
  );
}

function snapshot(id: string, name: string, alive: boolean): UnitStateSnapshot {
  return {
    id,
    name,
    alive,
    hp: { current: alive ? 1 : 0, max: 100, percent: alive ? 1 : 0 },
    mp: { current: 0, max: 100, percent: 0 },
    shield: 0,
    attrs: {} as UnitStateSnapshot['attrs'],
    baseAttrs: {} as UnitStateSnapshot['baseAttrs'],
    buffs: [],
    combatResources: [],
    cooldowns: [],
    actionStates: [],
    canAct: alive,
  };
}

function fact(
  id: string,
  ordinal: number,
  type: 'death_prevented' | 'unit_died' = 'unit_died',
  resolutionId = 'resolution:1',
): CombatFactV3 {
  return {
    id,
    type,
    trace: {
      eventId: id,
      sequenceId: 'sequence:action',
      ordinal,
      resolutionId,
    },
    origin: {
      kind: 'system',
      carrier: { kind: 'system', id: 'test', name: '测试系统' },
    },
    target: { id: 'loser', name: '败者' },
  };
}

function damageFact(
  id: string,
  ordinal: number,
  resolutionId = 'resolution:1',
): CombatFactV3 {
  return {
    id,
    type: 'damage',
    trace: {
      eventId: id,
      sequenceId: 'sequence:action',
      ordinal,
      resolutionId,
    },
    origin: {
      kind: 'system',
      carrier: { kind: 'system', id: 'test', name: '测试系统' },
    },
    target: { id: 'loser', name: '败者' },
    amount: 1,
    beforeHp: 1,
    afterHp: 0,
    damageType: DamageType.TRUE,
    shieldAbsorbed: 0,
    critical: false,
    damageSource: DamageSource.DIRECT,
  };
}

function recordWithFacts(facts: CombatFactV3[]): BattleRecordV3 {
  const loserAlive = !facts.some((entry) => entry.type === 'unit_died');
  const winner = snapshot('winner', '胜者', true);
  const loser = snapshot('loser', '败者', loserAlive);
  return {
    participants: {
      player: { id: 'winner', name: '胜者' },
      opponent: { id: 'loser', name: '败者' },
    },
    outcome: {
      winner: { id: 'winner', name: '胜者' },
      loser: { id: 'loser', name: '败者' },
      turns: 1,
    },
    sequences: [
      {
        id: 'sequence:action',
        turn: 1,
        phase: 'action',
        actor: { id: 'winner', name: '胜者' },
        facts,
      },
      {
        id: 'sequence:end',
        turn: 1,
        phase: 'battle_end',
        actor: { id: 'winner', name: '胜者' },
        facts: [],
      },
    ],
    stateTimeline: {
      unitIds: ['winner', 'loser'],
      unitNames: { winner: '胜者', loser: '败者' },
      frames: [
        {
          frameId: 1,
          turn: 1,
          phase: 'battle_end',
          sourceSequenceId: 'sequence:end',
          units: { winner, loser },
        },
      ],
    },
    finalSnapshots: { winner, loser },
  };
}

describe('combat facts V3', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it('inherits sequence, parent event, and monotonic ordinal', () => {
    const events: CombatEvent[] = [];
    EventBus.instance.subscribe('NestedEventV3', (event) => events.push(event));
    EventBus.instance.subscribe('RootEventV3', (event) => {
      events.push(event);
      EventBus.instance.publish({
        type: 'NestedEventV3',
        timestamp: Date.now(),
      });
    });

    EventBus.instance.runInSequence(
      { id: 'sequence:nested', phase: 'action', turn: 3 },
      () =>
        EventBus.instance.publish({
          type: 'RootEventV3',
          timestamp: Date.now(),
        }),
    );

    expect(events[1].trace).toMatchObject({
      sequenceId: 'sequence:nested',
      parentEventId: events[0].trace?.eventId,
    });
    expect(events[1].trace!.ordinal).toBeGreaterThan(events[0].trace!.ordinal);
  });

  it('constructs active, passive, buff, and system attribution explicitly', () => {
    const attacker = unit('attacker', '进攻者');
    const defender = unit('defender', '防守者');
    const skill = AbilityFactory.create({
      slug: 'active-skill',
      name: '主动术',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.BUFF,
      ],
      effects: [],
    });
    const gongfa = AbilityFactory.create({
      slug: 'defense-gongfa',
      name: '护体功法',
      type: AbilityType.PASSIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.GONGFA,
        GameplayTags.ABILITY.FUNCTION.BUFF,
      ],
      listeners: [],
    });
    const buff = new Buff('guard-buff', '护体', BuffType.BUFF, 2);
    buff.setCombatAttributionV3(
      CombatAttributionV3.fromAbility(defender, gongfa),
    );
    const trace = EventBus.instance.reserveTrace();

    const contexts = [
      EffectExecutionContextV3.activeAbility({
        owner: attacker,
        caster: attacker,
        target: defender,
        ability: skill,
        trace,
      }),
      EffectExecutionContextV3.passiveAbility({
        owner: defender,
        caster: attacker,
        target: defender,
        ability: gongfa,
        trace,
      }),
      EffectExecutionContextV3.buff({
        owner: defender,
        caster: attacker,
        target: defender,
        buff,
        trace,
      }),
      EffectExecutionContextV3.system({
        owner: defender,
        caster: defender,
        target: defender,
        source: CombatSystemSourceV3.ACTION_FLOW,
        trace,
      }),
    ];

    expect(contexts.map((context) => context.origin.kind)).toEqual([
      'owned',
      'owned',
      'owned',
      'system',
    ]);
    expect(contexts[1].owner).toBe(defender);
    expect(contexts[1].caster).toBe(attacker);
    expect(contexts[2].origin).toEqual(contexts[1].origin);
  });

  it('rejects effect contexts outside an explicit causal trace', () => {
    const target = unit('target', '目标');
    expect(() =>
      EffectExecutionContextV3.system({
        owner: target,
        caster: target,
        target,
        source: CombatSystemSourceV3.ACTION_FLOW,
      }),
    ).toThrow(/requires an explicit trace/);
  });

  it('blocks persisted buff effects after their attribution owner dies', () => {
    const owner = unit('owner', '施加者');
    const target = unit('target', '承受者');
    const buff = new Buff('persisted-effect', '遗留效果', BuffType.DEBUFF, 2);
    buff.setCombatAttributionV3(
      CombatAttributionV3.owned(owner, {
        kind: 'ability',
        id: 'persisted-source',
        name: '遗留术法',
      }),
    );
    owner.setHp(0);
    const triggerEvent = EventBus.instance.publish<ActionPostEvent>({
      type: 'ActionPostEvent',
      timestamp: Date.now(),
      caster: target,
    });

    const context = EffectExecutionContextV3.buff({
      owner,
      caster: owner,
      target,
      buff,
      triggerEvent,
    });

    expect(context.canExecuteEffect()).toBe(false);
  });

  it('keeps defensive equipment facts owned by the defender in presentation', () => {
    const builder = new CombatFactSinkV3(EventBus.instance);
    const attacker = unit('attacker', '进攻者');
    const defender = unit('defender', '防守者');
    const origin = ownedOrigin(defender, {
      kind: 'equipment',
      id: 'armor:1',
      name: '玄黄不灭甲',
    });

    builder.runInFrame(
      { id: 'sequence:defense', phase: 'action', turn: 1, actor: attacker },
      () => {
        const trigger = EventBus.instance.publish({
          type: 'DefenseTriggerEvent',
          timestamp: Date.now(),
          origin,
        });
        new CombatResultEmitterV3().commit(
          defender,
          {
            type: 'mechanic',
            code: 'death_guard',
            payload: { kind: 'named_trigger', label: '不灭金身' },
          },
          { origin, parentTrace: trigger.trace! },
        );
      },
    );

    const sequence = builder.getSequences()[0];
    expect(sequence.facts[0].origin).toEqual(origin);
    const output = new CombatPresenterV3('detailed')
      .format(sequence)
      .join('\n');
    expect(output).toContain('「防守者」的「玄黄不灭甲」：触发「不灭金身」');
    expect(output).not.toContain('「进攻者」的「玄黄不灭甲」');
    builder.destroy();
  });

  it('keeps defensive passive resource facts owned by the defender', () => {
    const builder = new CombatFactSinkV3(EventBus.instance);
    const attacker = unit('attacker', '进攻者');
    const defender = unit('defender', '防守者');
    defender.combatResources.define({
      id: 'guard',
      name: '守势',
      initial: 0,
      max: 10,
    });
    const equipment = AbilityFactory.create({
      slug: 'resource-armor',
      name: '聚元甲',
      type: AbilityType.PASSIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.ARTIFACT,
        GameplayTags.ABILITY.FUNCTION.BUFF,
      ],
      listeners: [],
    });

    builder.runInFrame(
      { id: 'sequence:resource-defense', phase: 'action', turn: 1 },
      () => {
        const trigger = EventBus.instance.publish({
          type: 'DefensiveResourceTriggerEvent',
          timestamp: Date.now(),
        });
        executeGameplayEffectV3(
          new CombatResourceModifyEffect({
            resourceId: 'guard',
            operation: 'add',
            amount: 2,
            target: 'target',
          }),
          EffectExecutionContextV3.passiveAbility({
            owner: defender,
            caster: attacker,
            target: defender,
            ability: equipment,
            trace: trigger.trace!,
          }),
        );
      },
    );

    expect(builder.getSequences()[0].facts).toEqual([
      expect.objectContaining({
        type: 'resource',
        target: { id: defender.id, name: defender.name },
        origin: expect.objectContaining({
          kind: 'owned',
          owner: { id: defender.id, name: defender.name },
          carrier: expect.objectContaining({
            kind: 'equipment',
            id: equipment.id,
          }),
        }),
      }),
    ]);
    builder.destroy();
  });

  it.each([
    [GameplayTags.ABILITY.KIND.ARTIFACT, 'equipment'],
    [GameplayTags.ABILITY.KIND.GONGFA, 'gongfa'],
  ] as const)(
    'keeps defensive %s delayed buff facts attributed to the defender',
    (abilityKind, carrierKind) => {
      const builder = new CombatFactSinkV3(EventBus.instance);
      const damageSystem = new DamageSystem();
      const attacker = unit('attacker', '进攻者');
      const defender = unit('defender', '防守者');
      const passive = AbilityFactory.create({
        slug: `defensive-${carrierKind}`,
        name: carrierKind === 'equipment' ? '玄黄甲' : '归藏诀',
        type: AbilityType.PASSIVE_SKILL,
        tags: [abilityKind, GameplayTags.ABILITY.FUNCTION.BUFF],
        listeners: [],
      });
      const attribution = CombatAttributionV3.fromAbility(defender, passive);

      builder.runInFrame(
        { id: `sequence:apply-${carrierKind}`, phase: 'action', turn: 1 },
        () => {
          const trigger = EventBus.instance.publish({
            type: 'DefensivePassiveTriggerEvent',
            timestamp: Date.now(),
            origin: attribution.origin,
          });
          executeGameplayEffectV3(
            new DelayedEffect({
              id: `delayed-${carrierKind}`,
              name: '延迟反应',
              delayTurns: 1,
              effects: [
                {
                  type: 'damage',
                  params: {
                    value: {
                      base: 10,
                      attribute: AttributeType.MAGIC_ATK,
                      coefficient: 0,
                    },
                    damageType: DamageType.TRUE,
                    damageSource: DamageSource.DELAYED,
                  },
                },
              ],
            }),
            EffectExecutionContextV3.passiveAbility({
              owner: defender,
              caster: attacker,
              target: defender,
              ability: passive,
              trace: trigger.trace,
            }),
          );
        },
      );
      builder.runInFrame(
        {
          id: `sequence:trigger-${carrierKind}`,
          phase: 'action_after',
          turn: 2,
        },
        () =>
          EventBus.instance.publish<ActionPostEvent>({
            type: 'ActionPostEvent',
            timestamp: Date.now(),
            caster: defender,
          }),
      );

      const damage = builder
        .getSequences()
        .flatMap((sequence) => sequence.facts)
        .find((entry) => entry.type === 'damage');
      expect(damage?.origin).toMatchObject({
        kind: 'owned',
        owner: { id: defender.id },
        carrier: { kind: carrierKind, id: passive.id },
      });

      damageSystem.destroy();
      builder.destroy();
    },
  );

  it('records damage before prevention, then exactly one final death', () => {
    const builder = new CombatFactSinkV3(EventBus.instance);
    const damageSystem = new DamageSystem();
    const attacker = unit('attacker', '破阵者');
    const defender = unit('defender', '持甲者');
    const artifact: AbilityConfig = {
      slug: 'immortal-armor',
      name: '玄黄不灭甲',
      type: AbilityType.PASSIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.ARTIFACT,
        GameplayTags.ABILITY.FUNCTION.BUFF,
      ],
      listeners: [
        {
          eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
          scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
          priority: 50,
          guard: { requireOwnerAlive: false, allowLethalWindow: true },
          effects: [{ type: 'death_prevent', params: {} }],
        },
      ],
    };
    defender.abilities.addAbility(AbilityFactory.create(artifact));

    publishDamage(
      builder,
      'sequence:first-lethal',
      attacker,
      defender,
      1_000_000,
    );
    const firstFacts = builder.getSequences()[0].facts;
    expect(firstFacts.map((entry) => entry.type)).toEqual([
      'damage',
      'death_prevented',
    ]);
    expect(firstFacts[1].origin).toMatchObject({
      kind: 'owned',
      owner: { id: defender.id },
      carrier: { kind: 'equipment', id: 'immortal-armor' },
    });
    expect(firstFacts[0].trace.resolutionId).toBe(
      firstFacts[1].trace.resolutionId,
    );

    publishDamage(
      builder,
      'sequence:final-lethal',
      attacker,
      defender,
      1_000_000,
    );
    const allFacts = builder
      .getSequences()
      .flatMap((sequence) => sequence.facts);
    expect(allFacts.filter((entry) => entry.type === 'unit_died')).toHaveLength(
      1,
    );
    expect(allFacts.slice(-2).map((entry) => entry.type)).toEqual([
      'damage',
      'unit_died',
    ]);

    damageSystem.destroy();
    builder.destroy();
  });

  it('stops an active multi-effect chain when reflect kills its owner', () => {
    const builder = new CombatFactSinkV3(EventBus.instance);
    const damageSystem = new DamageSystem();
    const attacker = unit('attacker', '进攻者');
    const defender = unit('defender', '反击者');
    attacker.setHp(10);
    const skill = AbilityFactory.create({
      slug: 'two-hit-strike',
      name: '两段斩',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.TRUE,
      ],
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: 10, attribute: AttributeType.ATK, coefficient: 0 },
            damageType: DamageType.TRUE,
          },
        },
        {
          type: 'damage',
          params: {
            value: { base: 10, attribute: AttributeType.ATK, coefficient: 0 },
            damageType: DamageType.TRUE,
          },
        },
      ],
    });
    const reflectOrigin = ownedOrigin(defender, {
      kind: 'equipment',
      id: 'reflect-armor',
      name: '反震甲',
    });
    EventBus.instance.subscribe(
      'DamageTakenEvent',
      (event: CombatEvent & { caster?: Unit; target: Unit }) => {
        if (event.target !== defender || event.caster !== attacker) return;
        EventBus.instance.publish<DamageRequestEvent>({
          type: 'DamageRequestEvent',
          timestamp: Date.now(),
          caster: defender,
          target: attacker,
          damageSource: DamageSource.REFLECT,
          damageType: DamageType.TRUE,
          calculationMode: 'resolved_final',
          baseDamage: 100,
          finalDamage: 100,
          origin: reflectOrigin,
        });
      },
      1_000,
    );

    builder.runInFrame(
      {
        id: 'sequence:two-hit-reflect',
        phase: 'action',
        turn: 1,
        actor: attacker,
      },
      () => {
        const trigger = EventBus.instance.publish({
          type: 'TwoHitCastEvent',
          timestamp: Date.now(),
          origin: ownedOrigin(attacker, {
            kind: 'ability',
            id: skill.id,
            name: skill.name,
          }),
        });
        EventBus.instance.runInCausalContext(
          { origin: trigger.origin, trace: trigger.trace },
          () => skill.execute({ caster: attacker, target: defender }),
        );
      },
    );

    const facts = builder.getSequences()[0].facts;
    expect(attacker.isAlive()).toBe(false);
    expect(
      facts.filter(
        (entry) =>
          entry.type === 'damage' &&
          entry.origin.kind === 'owned' &&
          entry.origin.owner.id === attacker.id,
      ),
    ).toHaveLength(1);
    expect(facts.map((entry) => entry.type)).toEqual([
      'damage',
      'damage',
      'unit_died',
    ]);

    damageSystem.destroy();
    builder.destroy();
  });

  it('does not record death when a hit reaction restores hp from zero', () => {
    const builder = new CombatFactSinkV3(EventBus.instance);
    const damageSystem = new DamageSystem();
    const attacker = unit('attacker', '进攻者');
    const defender = unit('defender', '防守者');
    defender.setHp(10);
    const recoveryOrigin = ownedOrigin(defender, {
      kind: 'gongfa',
      id: 'recovery-art',
      name: '回生诀',
    });

    EventBus.instance.subscribe(
      'DamageTakenEvent',
      (event: CombatEvent & { target: Unit }) => {
        if (event.target !== defender || defender.getCurrentHp() > 0) return;
        const amount = defender.heal(25);
        new CombatResultEmitterV3().commit(
          defender,
          {
            type: 'recovery',
            resource: 'hp',
            amount,
            after: defender.getCurrentHp(),
          },
          { origin: recoveryOrigin, parentTrace: event.trace! },
        );
      },
      1_000,
    );

    publishDamage(builder, 'sequence:zero-recovery', attacker, defender, 100);
    const facts = builder.getSequences()[0].facts;
    expect(facts.map((entry) => entry.type)).toEqual(['damage', 'recovery']);
    expect(facts[0]).toMatchObject({ type: 'damage', afterHp: 25 });
    expect(facts[1].origin).toMatchObject({
      kind: 'owned',
      owner: { id: defender.id },
      carrier: { kind: 'gongfa', id: 'recovery-art' },
    });

    damageSystem.destroy();
    builder.destroy();
  });

  it('sorts facts by ordinal and groups only consecutive equal attribution', () => {
    const owner = { id: 'owner', name: '归属者' };
    const target = { id: 'target', name: '目标' };
    const origin: CombatOriginV3 = {
      kind: 'owned',
      owner,
      carrier: { kind: 'gongfa', id: 'gongfa', name: '归藏' },
    };
    const otherOrigin: CombatOriginV3 = {
      kind: 'owned',
      owner,
      carrier: { kind: 'buff', id: 'buff', name: '余韵' },
    };
    const mechanic = (
      id: string,
      ordinal: number,
      factOrigin: CombatOriginV3,
      name: string,
    ): CombatFactV3 => ({
      id,
      type: 'mechanic',
      trace: { eventId: id, sequenceId: 'sequence', ordinal },
      origin: factOrigin,
      target,
      code: id,
      payload: { kind: 'named_trigger', label: name },
    });
    const sequence: CombatSequenceV3 = {
      id: 'sequence',
      turn: 1,
      phase: 'action',
      facts: [
        mechanic('third', 3, otherOrigin, '第三'),
        mechanic('first', 1, origin, '第一'),
        mechanic('second', 2, origin, '第二'),
        mechanic('fourth', 4, origin, '第四'),
      ],
    };

    const lines = new CombatPresenterV3('detailed').format(sequence);
    expect(lines.join('\n')).toMatch(/第一[\s\S]*第二[\s\S]*第三[\s\S]*第四/);
    expect(lines.filter((line) => line.includes('「归藏」'))).toHaveLength(2);
  });

  it('models direct, inline, and branch attribution layouts explicitly', () => {
    const actor = { id: 'actor', name: '裴一真' };
    const target = { id: 'target', name: '木桩' };
    const defender = { id: 'defender', name: '墨无痕' };
    const ability = { id: 'attack', name: '听雷' };
    const trace = (eventId: string, ordinal: number) => ({
      eventId,
      sequenceId: 'sequence:layouts',
      ordinal,
    });
    const actionOrigin: CombatOriginV3 = {
      kind: 'owned',
      owner: actor,
      carrier: { kind: 'ability', ...ability },
    };
    const passiveOrigin: CombatOriginV3 = {
      kind: 'owned',
      owner: actor,
      carrier: { kind: 'gongfa', id: 'passive', name: '大巧不工' },
    };
    const equipmentOrigin: CombatOriginV3 = {
      kind: 'owned',
      owner: defender,
      carrier: { kind: 'equipment', id: 'armor', name: '玄甲' },
    };
    const sequence: CombatSequenceV3 = {
      id: 'sequence:layouts',
      turn: 1,
      phase: 'action',
      actor,
      ability,
      facts: [
        {
          id: 'direct',
          type: 'resource',
          trace: trace('direct', 1),
          origin: actionOrigin,
          target: actor,
          resourceId: 'sword-intent',
          resourceName: '剑意',
          before: 0,
          after: 1,
          applied: 1,
        },
        {
          id: 'inline',
          type: 'resource',
          trace: trace('inline', 2),
          origin: passiveOrigin,
          target: actor,
          resourceId: 'sword-intent',
          resourceName: '剑意',
          before: 1,
          after: 2,
          applied: 1,
        },
        {
          id: 'branch-recovery',
          type: 'recovery',
          trace: trace('branch-recovery', 3),
          origin: equipmentOrigin,
          target: defender,
          resource: 'mp',
          amount: 12,
          after: 88,
        },
        {
          id: 'branch-shield',
          type: 'shield',
          trace: trace('branch-shield', 4),
          origin: equipmentOrigin,
          target: defender,
          amount: 30,
          after: 30,
        },
      ],
    };

    const presentation = new CombatPresenterV3('concise').present(sequence);
    expect(presentation.groups.map((group) => group.layout)).toEqual([
      'root',
      'inline',
      'branch',
    ]);
    const inline = presentation.groups[1];
    expect(inline).toMatchObject({ layout: 'inline' });
    if (inline.layout !== 'inline') throw new Error('Expected inline group');
    expect(inline.line.parts.map((entry) => entry.text).join('')).toBe(
      '「大巧不工」触发：剑意 1 → 2',
    );
    const branch = presentation.groups[2];
    expect(branch).toMatchObject({ layout: 'branch' });
    if (branch.layout !== 'branch') throw new Error('Expected branch group');
    expect(branch.heading.parts.map((entry) => entry.text).join('')).toBe(
      '「墨无痕」的「玄甲」触发',
    );
    expect(branch.lines).toHaveLength(2);
  });

  it('keeps unattributed expiry summaries at the sequence root', () => {
    const actor = { id: 'actor', name: '裴一真' };
    const sequence: CombatSequenceV3 = {
      id: 'sequence:expiry-root',
      turn: 2,
      phase: 'action_after',
      actor,
      facts: [
        {
          id: 'expired',
          type: 'status',
          trace: {
            eventId: 'expired',
            sequenceId: 'sequence:expiry-root',
            ordinal: 1,
          },
          origin: {
            kind: 'owned',
            owner: actor,
            carrier: { kind: 'ability', id: 'charge', name: '藏锋听雷' },
          },
          target: actor,
          operation: 'remove',
          reason: 'expired',
          statusId: 'charge',
          statusName: '藏锋听雷',
          statusType: 'buff',
          beforeLayers: 1,
          afterLayers: 0,
        },
      ],
    };

    const presentation = new CombatPresenterV3('concise').present(sequence);
    expect(presentation.heading).toBeUndefined();
    expect(presentation.groups).toHaveLength(1);
    expect(presentation.groups[0]).toMatchObject({ layout: 'root' });
  });

  it('renders action-state phases with domain text instead of internal values', () => {
    const sequence: CombatSequenceV3 = {
      id: 'sequence:action-state',
      turn: 1,
      phase: 'action',
      facts: [
        {
          id: 'action-state:1',
          type: 'action_state',
          trace: {
            eventId: 'action-state:1',
            sequenceId: 'sequence:action-state',
            ordinal: 1,
          },
          origin: {
            kind: 'system',
            carrier: { kind: 'system', id: 'action_flow', name: '行动流程' },
          },
          target: { id: 'owner', name: '归属者' },
          stateType: 'queued_action',
          phase: 'entered',
          name: '蓄势',
          remainingActions: 1,
          ability: { id: 'queued', name: '听雷' },
        },
      ],
    };

    const output = new CombatPresenterV3('detailed')
      .format(sequence)
      .join('\n');
    expect(output).toContain('开始蓄势');
    expect(output).not.toContain('entered');
  });

  it('initializes buffs without publishing combat facts or gameplay events', () => {
    const owner = unit('owner', '归属者');
    const buff = new Buff('initial-guard', '初始护体', BuffType.BUFF, -1);
    const observed: string[] = [];
    for (const eventType of [
      'BuffAddEvent',
      'BuffLayerChangedEvent',
      'BuffAppliedEvent',
      'CombatResultCommittedEventV3',
    ]) {
      EventBus.instance.subscribe(eventType, () => observed.push(eventType));
    }

    owner.buffs.initializeBuff(buff, owner);

    expect(observed).toEqual([]);
    expect(owner.buffs.getAllBuffs()).toContain(buff);
    expect(buff.getCombatAttributionV3()?.origin).toMatchObject({
      kind: 'owned',
      owner: { id: owner.id },
      carrier: { kind: 'buff', id: buff.id },
    });
  });

  it('renders committed mechanic and defense semantics without leaking internal ids', () => {
    const builder = new CombatFactSinkV3(EventBus.instance);
    const attacker = unit('attacker', '进攻者');
    const defender = unit('defender', '防守者');
    const ability = AbilityFactory.create({
      slug: 'transform-source',
      name: '化势诀',
      type: AbilityType.PASSIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.GONGFA,
        GameplayTags.ABILITY.FUNCTION.BUFF,
      ],
      listeners: [],
    });

    builder.runInFrame(
      { id: 'sequence:presentation', phase: 'action', turn: 1 },
      () => {
        const trigger = EventBus.instance.publish({
          type: 'PresentationTriggerEvent',
          timestamp: Date.now(),
        });
        const context = EffectExecutionContextV3.passiveAbility({
          owner: defender,
          caster: attacker,
          target: defender,
          ability,
          trace: trigger.trace!,
        });
        executeGameplayEffectV3(
          new AbilityTransformEffect({
            id: 'internal_transform_rule',
            triggers: 1,
            forceCritical: true,
          }),
          context,
        );
        context.commit(defender, {
          type: 'defense',
          defense: 'mana_shield',
          amount: 12,
          detail: '消耗12点法力',
        });
      },
    );

    const output = new CombatPresenterV3('detailed')
      .format(builder.getSequences()[0])
      .join('\n');
    expect(output).toContain('技能获得强化');
    expect(output).not.toContain('internal_transform_rule');
    expect(output).toContain('必定暴击');
    expect(output).not.toContain('数值：1');
    expect(output).toContain('法力护盾');
    expect(output).toContain('12');
    expect(output).toContain('消耗12点法力');
    builder.destroy();
  });

  it('emits explicit status transitions for add, stack, refresh, and replace', () => {
    const builder = new CombatFactSinkV3(EventBus.instance);
    const owner = unit('owner', '归属者');

    builder.runInFrame(
      { id: 'sequence:status-transitions', phase: 'action', turn: 1 },
      () => {
        owner.buffs.addBuff(
          new Buff(
            'stack',
            '叠层',
            BuffType.BUFF,
            2,
            StackRule.STACK_LAYER,
            undefined,
            2,
          ),
          owner,
        );
        owner.buffs.addBuff(
          new Buff(
            'stack',
            '叠层',
            BuffType.BUFF,
            2,
            StackRule.STACK_LAYER,
            undefined,
            2,
          ),
          owner,
        );
        owner.buffs.addBuff(
          new Buff(
            'stack',
            '叠层',
            BuffType.BUFF,
            2,
            StackRule.STACK_LAYER,
            undefined,
            2,
          ),
          owner,
        );
        owner.buffs.addBuff(
          new Buff(
            'refresh',
            '刷新',
            BuffType.BUFF,
            1,
            StackRule.REFRESH_DURATION,
          ),
          owner,
        );
        owner.buffs.addBuff(
          new Buff(
            'refresh',
            '刷新',
            BuffType.BUFF,
            3,
            StackRule.REFRESH_DURATION,
          ),
          owner,
        );
        owner.buffs.addBuff(
          new Buff('replace', '替换', BuffType.BUFF, 1, StackRule.OVERRIDE),
          owner,
        );
        owner.buffs.addBuff(
          new Buff('replace', '替换', BuffType.BUFF, 2, StackRule.OVERRIDE),
          owner,
        );
      },
    );

    const transitions = builder
      .getSequences()[0]
      .facts.filter(
        (entry) => entry.type === 'status' && entry.operation === 'apply',
      )
      .map((entry) => ({
        transition: entry.transition,
        before: entry.beforeLayers,
        after: entry.afterLayers,
      }));
    expect(transitions).toEqual([
      { transition: 'added', before: 0, after: 1 },
      { transition: 'stacked', before: 1, after: 2 },
      { transition: 'refreshed', before: 2, after: 2 },
      { transition: 'added', before: 0, after: 1 },
      { transition: 'refreshed', before: 1, after: 1 },
      { transition: 'added', before: 0, after: 1 },
      { transition: 'replaced', before: 1, after: 1 },
    ]);
    builder.destroy();
  });

  it('commits a stack result before layer-change reactions mutate the buff', () => {
    const builder = new CombatFactSinkV3(EventBus.instance);
    const owner = unit('owner', '归属者');

    builder.runInFrame(
      { id: 'sequence:stack-reaction', phase: 'action', turn: 1, actor: owner },
      () => {
        owner.buffs.addBuff(
          new Buff(
            'reactive-stack',
            '反应叠层',
            BuffType.BUFF,
            2,
            StackRule.STACK_LAYER,
          ),
          owner,
        );
        EventBus.instance.subscribe<BuffLayerChangedEvent>(
          'BuffLayerChangedEvent',
          (event) => {
            if (
              event.buff.id === 'reactive-stack' &&
              event.currentLayer === 2
            ) {
              owner.buffs.modifyBuffLayer('reactive-stack', -1);
            }
          },
        );
        owner.buffs.addBuff(
          new Buff(
            'reactive-stack',
            '反应叠层',
            BuffType.BUFF,
            2,
            StackRule.STACK_LAYER,
          ),
          owner,
        );
      },
    );

    const applications = builder
      .getSequences()[0]
      .facts.filter(
        (entry) => entry.type === 'status' && entry.operation === 'apply',
      );
    expect(applications.map((entry) => entry.transition)).toEqual([
      'added',
      'stacked',
    ]);
    expect(applications[1]).toMatchObject({ beforeLayers: 1, afterLayers: 2 });
    expect(
      owner.buffs
        .getAllBuffs()
        .find((buff) => buff.id === 'reactive-stack')
        ?.getLayer(),
    ).toBe(1);
    builder.destroy();
  });

  it('compacts redundant action state and status lifecycle without losing meaning', () => {
    const actor = { id: 'actor', name: '裴一真' };
    const target = { id: 'target', name: '墨无痕' };
    const ability = { id: 'hidden-thunder', name: '藏锋听雷' };
    const origin: CombatOriginV3 = {
      kind: 'owned',
      owner: actor,
      carrier: { kind: 'ability', ...ability },
    };
    const trace = (id: string, ordinal: number, causeId: string) => ({
      eventId: id,
      sequenceId: 'sequence:narrative',
      ordinal,
      narrativeCauseId: causeId,
    });
    const relation = (causeId: string) => ({
      causeId,
      role: 'result' as const,
    });
    const sequence: CombatSequenceV3 = {
      id: 'sequence:narrative',
      turn: 1,
      phase: 'action',
      actor,
      ability,
      facts: [
        {
          id: 'self-status',
          type: 'status',
          trace: trace('self-status', 1, 'cause:action'),
          narrative: relation('cause:action'),
          origin,
          target: actor,
          operation: 'apply',
          transition: 'added',
          statusId: 'hidden-thunder-status',
          statusName: '藏锋听雷',
          statusType: 'buff',
          beforeLayers: 0,
          afterLayers: 1,
          duration: 1,
        },
        {
          id: 'queued',
          type: 'action_state',
          trace: trace('queued', 2, 'cause:action'),
          narrative: relation('cause:action'),
          origin,
          target: actor,
          stateType: 'queued_action',
          phase: 'entered',
          name: '蓄势',
          remainingActions: 1,
          ability: { id: 'thunder', name: '听雷' },
        },
        {
          id: 'erosion-1',
          type: 'status',
          trace: trace('erosion-1', 3, 'cause:erosion'),
          narrative: relation('cause:erosion'),
          origin,
          target,
          operation: 'apply',
          transition: 'added',
          statusId: 'erosion',
          statusName: '蚀魂',
          statusType: 'debuff',
          beforeLayers: 0,
          afterLayers: 1,
          duration: 3,
        },
        {
          id: 'erosion-2',
          type: 'status',
          trace: trace('erosion-2', 4, 'cause:erosion'),
          narrative: relation('cause:erosion'),
          origin,
          target,
          operation: 'apply',
          transition: 'stacked',
          statusId: 'erosion',
          statusName: '蚀魂',
          statusType: 'debuff',
          beforeLayers: 1,
          afterLayers: 2,
          duration: 3,
        },
        {
          id: 'expired-a',
          type: 'status',
          trace: trace('expired-a', 5, 'cause:expiry'),
          origin,
          target: actor,
          operation: 'remove',
          reason: 'expired',
          statusId: 'a',
          statusName: '藏锋听雷',
          statusType: 'buff',
          beforeLayers: 1,
          afterLayers: 0,
        },
        {
          id: 'expired-b',
          type: 'status',
          trace: trace('expired-b', 6, 'cause:expiry'),
          origin,
          target: actor,
          operation: 'remove',
          reason: 'expired',
          statusId: 'b',
          statusName: '踏雪无痕',
          statusType: 'buff',
          beforeLayers: 1,
          afterLayers: 0,
        },
        {
          id: 'expired-c',
          type: 'status',
          trace: trace('expired-c', 7, 'cause:other-expiry'),
          origin: {
            kind: 'owned',
            owner: target,
            carrier: { kind: 'ability', id: 'river', name: '忘川潮' },
          },
          target: actor,
          operation: 'remove',
          reason: 'expired',
          statusId: 'c',
          statusName: '忘川',
          statusType: 'debuff',
          beforeLayers: 1,
          afterLayers: 0,
        },
      ],
    };

    const concise = new CombatPresenterV3('concise')
      .format(sequence)
      .join('\n');
    const detailed = new CombatPresenterV3('detailed')
      .format(sequence)
      .join('\n');
    expect(concise).not.toContain('获得「藏锋听雷」');
    expect(concise).toContain('开始蓄势，下次行动施放《听雷》');
    expect(concise.match(/蚀魂/g)).toHaveLength(1);
    expect(concise).toContain('「藏锋听雷」、「踏雪无痕」');
    expect(concise).not.toContain('「踏雪无痕」、「忘川」');
    expect(concise).toContain('状态结束：「忘川」');
    expect(detailed).toContain('获得「藏锋听雷」');
    expect(detailed.match(/蚀魂/g)).toHaveLength(2);
  });

  it('hides a cue only through an explicit cause link regardless of adjacency', () => {
    const actor = { id: 'actor', name: '归属者' };
    const target = { id: 'target', name: '目标' };
    const origin: CombatOriginV3 = {
      kind: 'owned',
      owner: actor,
      carrier: { kind: 'gongfa', id: 'gongfa', name: '五雷真解' },
    };
    const trace = (id: string, ordinal: number) => ({
      eventId: id,
      sequenceId: 'sequence:cues',
      ordinal,
    });
    const sequence: CombatSequenceV3 = {
      id: 'sequence:cues',
      turn: 1,
      phase: 'action',
      actor,
      facts: [
        {
          id: 'tag-cue',
          type: 'mechanic',
          trace: trace('tag-cue', 1),
          origin,
          target,
          code: 'tag-cue',
          payload: { kind: 'tag_trigger', label: '引雷' },
          narrative: { causeId: 'cause:thunder', role: 'cue' },
        },
        {
          id: 'interleaved-result',
          type: 'resource',
          trace: trace('interleaved-result', 2),
          origin,
          target: actor,
          resourceId: 'sword-intent',
          resourceName: '剑意',
          before: 1,
          after: 2,
          applied: 1,
        },
        {
          id: 'status-result',
          type: 'status',
          trace: trace('status-result', 3),
          origin,
          target,
          operation: 'apply',
          transition: 'added',
          statusId: 'thunder-mark',
          statusName: '雷印',
          statusType: 'debuff',
          beforeLayers: 0,
          afterLayers: 1,
          duration: 2,
          narrative: { causeId: 'cause:thunder', role: 'result' },
        },
        {
          id: 'standalone-cue',
          type: 'mechanic',
          trace: trace('standalone-cue', 4),
          origin,
          target,
          code: 'standalone-cue',
          payload: { kind: 'named_trigger', label: '余雷' },
        },
      ],
    };

    const concise = new CombatPresenterV3('concise')
      .format(sequence)
      .join('\n');
    expect(concise).not.toContain('引雷');
    expect(concise).toContain('雷印');
    expect(concise).toContain('触发「余雷」');
    const detailed = new CombatPresenterV3('detailed')
      .format(sequence)
      .join('\n');
    expect(detailed).toContain('触发「引雷」');
  });

  it('does not hide an equally named status from a different carrier', () => {
    const actor = { id: 'actor', name: '裴一真' };
    const ability = { id: 'hidden-thunder', name: '藏锋听雷' };
    const causeId = 'cause:action';
    const sequence: CombatSequenceV3 = {
      id: 'sequence:carrier-identity',
      turn: 1,
      phase: 'action',
      actor,
      ability,
      facts: [
        {
          id: 'same-name-status',
          type: 'status',
          trace: {
            eventId: 'same-name-status',
            sequenceId: 'sequence:carrier-identity',
            ordinal: 1,
            narrativeCauseId: causeId,
          },
          narrative: { causeId, role: 'result' },
          origin: {
            kind: 'owned',
            owner: actor,
            carrier: { kind: 'gongfa', id: 'other-source', name: '其他功法' },
          },
          target: actor,
          operation: 'apply',
          transition: 'added',
          statusId: 'same-name-status',
          statusName: ability.name,
          statusType: 'buff',
          beforeLayers: 0,
          afterLayers: 1,
          duration: 1,
        },
        {
          id: 'queued-action',
          type: 'action_state',
          trace: {
            eventId: 'queued-action',
            sequenceId: 'sequence:carrier-identity',
            ordinal: 2,
            narrativeCauseId: causeId,
          },
          narrative: { causeId, role: 'result' },
          origin: {
            kind: 'owned',
            owner: actor,
            carrier: { kind: 'ability', ...ability },
          },
          target: actor,
          stateType: 'queued_action',
          phase: 'entered',
          name: '蓄势',
          remainingActions: 1,
          ability: { id: 'thunder', name: '听雷' },
        },
      ],
    };

    expect(
      new CombatPresenterV3('concise').format(sequence).join('\n'),
    ).toContain('获得「藏锋听雷」');
  });

  it('renders every mechanic payload with explicit player semantics', () => {
    const cases = {
      ability_transform: [
        {
          kind: 'ability_transform',
          triggers: 1,
          modifiers: [{ kind: 'force_critical' }],
        },
        '必定暴击',
      ],
      ability_lock: [
        { kind: 'ability_lock', abilityName: '问剑式', rounds: 2 },
        '封禁《问剑式》',
      ],
      tag_trigger: [{ kind: 'tag_trigger', label: '追击' }, '触发「追击」'],
      hp_sacrifice: [{ kind: 'hp_sacrifice', amount: 30 }, '消耗 30 点气血'],
      damage_defer: [
        { kind: 'damage_defer', amount: 80, turns: 2 },
        '80 点伤害延后 2 回合',
      ],
      mana_burn: [{ kind: 'mana_burn', amount: 44 }, '44 点法力'],
      cooldown_change: [
        { kind: 'cooldown_change', abilityName: '一叹', rounds: -1 },
        '冷却缩短 1 回合',
      ],
      memory_record: [
        {
          kind: 'memory_record',
          source: 'damage_taken',
          sampledAmount: 215,
          before: 80,
          after: 295,
        },
        '记录受到的伤害 215，储存 80 → 295',
      ],
      memory_release: [
        { kind: 'memory_release', amount: 215, releaseAs: 'damage' },
        '生成 215 点伤害',
      ],
      control_skip: [
        { kind: 'control_skip', controlName: '失魂' },
        '受「失魂」影响',
      ],
      named_trigger: [
        { kind: 'named_trigger', label: '剑势共鸣' },
        '触发「剑势共鸣」',
      ],
      status_transition: [
        { kind: 'status_transition', label: '火印', operation: 'refresh' },
        '刷新「火印」',
      ],
    } satisfies {
      [K in CombatMechanicPayloadV3['kind']]: [
        Extract<CombatMechanicPayloadV3, { kind: K }>,
        string,
      ];
    };
    const origin: CombatOriginV3 = {
      kind: 'system',
      carrier: { kind: 'system', id: 'test', name: '测试系统' },
    };

    for (const [payload, expected] of Object.values(cases)) {
      const sequence: CombatSequenceV3 = {
        id: `sequence:${payload.kind}`,
        turn: 1,
        phase: 'action',
        facts: [
          {
            id: payload.kind,
            type: 'mechanic',
            trace: {
              eventId: payload.kind,
              sequenceId: `sequence:${payload.kind}`,
              ordinal: 1,
            },
            origin,
            target: { id: 'target', name: '目标' },
            code: payload.kind,
            payload,
          },
        ],
      };
      const output = new CombatPresenterV3('detailed')
        .format(sequence)
        .join('\n');
      expect(output).toContain(expected);
      expect(output).not.toMatch(/数值：|ability_transform|memory_record/);
    }
  });

  it('keeps pending ability transformations out of concise logs', () => {
    const owner = { id: 'owner', name: '陆逆行' };
    const sequence: CombatSequenceV3 = {
      id: 'sequence:ability-transform',
      turn: 1,
      phase: 'action_after',
      facts: [
        {
          id: 'ability-transform',
          type: 'mechanic',
          trace: {
            eventId: 'ability-transform',
            sequenceId: 'sequence:ability-transform',
            ordinal: 1,
          },
          origin: {
            kind: 'owned',
            owner,
            carrier: {
              kind: 'gongfa',
              id: 'memory-art',
              name: '逆生玄雷真解',
            },
          },
          target: owner,
          code: 'stored-damage',
          payload: {
            kind: 'ability_transform',
            triggers: 1,
            modifiers: [{ kind: 'stored_damage' }],
          },
        },
      ],
    };

    const concise = new CombatPresenterV3('concise')
      .format(sequence)
      .join('\n');
    const detailed = new CombatPresenterV3('detailed')
      .format(sequence)
      .join('\n');

    expect(concise).toBe('');
    expect(detailed).toContain(
      '接下来 1 次符合条件的技能获得强化：附加已记录伤害',
    );
  });

  it('keeps memory bookkeeping out of concise logs', () => {
    const origin: CombatOriginV3 = {
      kind: 'owned',
      owner: { id: 'owner', name: '归属者' },
      carrier: { kind: 'gongfa', id: 'memory-art', name: '归藏诀' },
    };
    const sequence: CombatSequenceV3 = {
      id: 'sequence:memory-bookkeeping',
      turn: 1,
      phase: 'action_after',
      facts: [
        {
          id: 'memory-record',
          type: 'mechanic',
          trace: {
            eventId: 'memory-record',
            sequenceId: 'sequence:memory-bookkeeping',
            ordinal: 1,
          },
          origin,
          target: { id: 'owner', name: '归属者' },
          code: 'stored-heal',
          payload: {
            kind: 'memory_record',
            source: 'heal',
            sampledAmount: 100,
            before: 80,
            after: 150,
          },
        },
        {
          id: 'memory-release',
          type: 'mechanic',
          trace: {
            eventId: 'memory-release',
            sequenceId: 'sequence:memory-bookkeeping',
            ordinal: 2,
            narrativeCauseId: 'cause:memory-release',
          },
          narrative: { causeId: 'cause:memory-release', role: 'cue' },
          origin,
          target: { id: 'owner', name: '归属者' },
          code: 'stored-heal',
          payload: {
            kind: 'memory_release',
            amount: 75,
            releaseAs: 'heal',
          },
        },
      ],
    };

    const concise = new CombatPresenterV3('concise')
      .format(sequence)
      .join('\n');
    const detailed = new CombatPresenterV3('detailed')
      .format(sequence)
      .join('\n');

    expect(concise).toBe('');
    expect(detailed).toContain('记录治疗量 100，储存 80 → 150');
    expect(detailed).toContain('释放记录，生成 75 点治疗');
  });

  it('keeps the final memory result in concise logs', () => {
    const owner = { id: 'owner', name: '归属者' };
    const origin: CombatOriginV3 = {
      kind: 'owned',
      owner,
      carrier: { kind: 'gongfa', id: 'memory-art', name: '归藏诀' },
    };
    const causeId = 'cause:memory-release';
    const sequence: CombatSequenceV3 = {
      id: 'sequence:memory-result',
      turn: 1,
      phase: 'action_after',
      facts: [
        {
          id: 'memory-release',
          type: 'mechanic',
          trace: {
            eventId: 'memory-release',
            sequenceId: 'sequence:memory-result',
            ordinal: 1,
            narrativeCauseId: causeId,
          },
          narrative: { causeId, role: 'cue' },
          origin,
          target: owner,
          code: 'stored-heal',
          payload: {
            kind: 'memory_release',
            amount: 75,
            releaseAs: 'heal',
          },
        },
        {
          id: 'memory-recovery',
          type: 'recovery',
          trace: {
            eventId: 'memory-recovery',
            sequenceId: 'sequence:memory-result',
            ordinal: 2,
            narrativeCauseId: causeId,
          },
          narrative: { causeId, role: 'result' },
          origin,
          target: owner,
          resource: 'hp',
          amount: 40,
          after: 100,
        },
      ],
    };

    const concise = new CombatPresenterV3('concise')
      .format(sequence)
      .join('\n');
    const detailed = new CombatPresenterV3('detailed')
      .format(sequence)
      .join('\n');

    expect(concise).toContain('恢复 40 点气血');
    expect(concise).not.toContain('释放记录');
    expect(detailed).toContain('释放记录，生成 75 点治疗');
    expect(detailed).toContain('恢复 40 点气血');
  });

  it('renders every top-level fact type', () => {
    const target = { id: 'target', name: '目标' };
    const origin: CombatOriginV3 = {
      kind: 'system',
      carrier: { kind: 'system', id: 'test', name: '测试系统' },
    };
    const trace = (id: string) => ({
      eventId: id,
      sequenceId: `sequence:${id}`,
      ordinal: 1,
      resolutionId: `resolution:${id}`,
    });
    const cases = {
      damage: {
        fact: {
          id: 'damage',
          type: 'damage',
          trace: trace('damage'),
          origin,
          target,
          amount: 10,
          beforeHp: 100,
          afterHp: 90,
          damageType: DamageType.PHYSICAL,
          critical: false,
          shieldAbsorbed: 0,
        },
        expected: '造成 10 点伤害',
      },
      recovery: {
        fact: {
          id: 'recovery',
          type: 'recovery',
          trace: trace('recovery'),
          origin,
          target,
          resource: 'hp',
          amount: 10,
          after: 100,
        },
        expected: '恢复 10 点气血',
      },
      shield: {
        fact: {
          id: 'shield',
          type: 'shield',
          trace: trace('shield'),
          origin,
          target,
          amount: 10,
          after: 10,
        },
        expected: '提供 10 点护盾',
      },
      status: {
        fact: {
          id: 'status',
          type: 'status',
          trace: trace('status'),
          origin,
          target,
          operation: 'apply',
          transition: 'added',
          statusId: 'status',
          statusName: '测试状态',
          statusType: 'buff',
          beforeLayers: 0,
          afterLayers: 1,
          duration: 2,
        },
        expected: '施加「测试状态」',
      },
      defense: {
        fact: {
          id: 'defense',
          type: 'defense',
          trace: trace('defense'),
          origin,
          target,
          defense: 'dodge',
        },
        expected: '成功闪避',
      },
      resource: {
        fact: {
          id: 'resource',
          type: 'resource',
          trace: trace('resource'),
          origin,
          target,
          resourceId: 'intent',
          resourceName: '剑意',
          before: 1,
          after: 2,
          applied: 1,
        },
        expected: '剑意 1 → 2',
      },
      action_state: {
        fact: {
          id: 'action_state',
          type: 'action_state',
          trace: trace('action_state'),
          origin,
          target,
          stateType: 'rest',
          phase: 'entered',
          name: '调息',
          remainingActions: 1,
        },
        expected: '进入「调息」',
      },
      mechanic: {
        fact: {
          id: 'mechanic',
          type: 'mechanic',
          trace: trace('mechanic'),
          origin,
          target,
          code: 'named',
          payload: { kind: 'named_trigger', label: '剑鸣' },
        },
        expected: '触发「剑鸣」',
      },
      death_prevented: {
        fact: {
          id: 'death_prevented',
          type: 'death_prevented',
          trace: trace('death_prevented'),
          origin,
          target,
        },
        expected: '免于死亡',
      },
      unit_died: {
        fact: {
          id: 'unit_died',
          type: 'unit_died',
          trace: trace('unit_died'),
          origin,
          target,
        },
        expected: '被击败',
      },
    } satisfies {
      [K in CombatFactV3['type']]: {
        fact: Extract<CombatFactV3, { type: K }>;
        expected: string;
      };
    };

    for (const { fact: visibleFact, expected } of Object.values(cases)) {
      const sequence: CombatSequenceV3 = {
        id: visibleFact.trace.sequenceId,
        turn: 1,
        phase: 'action',
        facts: [visibleFact],
      };
      expect(
        new CombatPresenterV3('detailed').format(sequence).join('\n'),
      ).toContain(expected);
    }
  });

  it('renders every defense semantic', () => {
    type DefenseFact = Extract<CombatFactV3, { type: 'defense' }>;
    const cases = {
      mana_shield: '法力护盾生效',
      damage_immune: '免疫伤害',
      dodge: '成功闪避',
      resist: '抵抗控制',
      interrupt: '施法被打断',
    } satisfies Record<DefenseFact['defense'], string>;

    for (const [defense, expected] of Object.entries(cases)) {
      const sequence: CombatSequenceV3 = {
        id: `sequence:${defense}`,
        turn: 1,
        phase: 'action',
        facts: [
          {
            id: defense,
            type: 'defense',
            trace: {
              eventId: defense,
              sequenceId: `sequence:${defense}`,
              ordinal: 1,
            },
            origin: {
              kind: 'system',
              carrier: { kind: 'system', id: 'test', name: '测试系统' },
            },
            target: { id: 'target', name: '目标' },
            defense: defense as DefenseFact['defense'],
          },
        ],
      };
      expect(
        new CombatPresenterV3('detailed').format(sequence).join('\n'),
      ).toContain(expected);
    }
  });

  it('renders every status transition and final removal reason', () => {
    const applicationText = {
      added: '获得「剑势」',
      stacked: '叠至 2 层',
      refreshed: '刷新「剑势」',
      replaced: '状态替换为「剑势」',
    } satisfies Record<CombatStatusApplicationTransitionV3, string>;
    const layerText = {
      modified: '层数 3 → 2',
      consumed: '消耗「剑势」1 层，剩余 2 层',
      dispelled: '驱散「剑势」1 层，剩余 2 层',
    } satisfies Record<CombatStatusLayerChangeReasonV3, string>;
    const removalText = {
      expired: '结束',
      dispelled: '被驱散',
      consumed: '被消耗',
      replaced: '被替换',
      manual: '被移除',
    } satisfies Record<CombatStatusRemovalReasonV3, string>;
    const owner = { id: 'owner', name: '归属者' };
    const origin: CombatOriginV3 = {
      kind: 'owned',
      owner,
      carrier: { kind: 'buff', id: 'stance', name: '剑势' },
    };
    const present = (visibleFact: CombatFactV3) =>
      new CombatPresenterV3('detailed')
        .format({
          id: visibleFact.trace.sequenceId,
          turn: 1,
          phase: 'action',
          facts: [visibleFact],
        })
        .join('\n');

    for (const [transition, expected] of Object.entries(applicationText)) {
      const beforeLayers = transition === 'added' ? 0 : 1;
      const afterLayers = transition === 'stacked' ? 2 : 1;
      expect(
        present({
          id: `apply:${transition}`,
          type: 'status',
          trace: {
            eventId: `apply:${transition}`,
            sequenceId: `sequence:apply:${transition}`,
            ordinal: 1,
          },
          origin,
          target: owner,
          operation: 'apply',
          transition: transition as CombatStatusApplicationTransitionV3,
          statusId: 'stance',
          statusName: '剑势',
          statusType: 'buff',
          beforeLayers,
          afterLayers,
          duration: 2,
        }),
      ).toContain(expected);
    }

    for (const [reason, expected] of Object.entries(layerText)) {
      expect(
        present({
          id: `layers:${reason}`,
          type: 'status',
          trace: {
            eventId: `layers:${reason}`,
            sequenceId: `sequence:layers:${reason}`,
            ordinal: 1,
          },
          origin,
          target: owner,
          operation: 'layers',
          reason: reason as CombatStatusLayerChangeReasonV3,
          statusId: 'stance',
          statusName: '剑势',
          statusType: 'buff',
          beforeLayers: 3,
          afterLayers: 2,
        }),
      ).toContain(expected);
    }

    for (const [reason, expected] of Object.entries(removalText)) {
      expect(
        present({
          id: `remove:${reason}`,
          type: 'status',
          trace: {
            eventId: `remove:${reason}`,
            sequenceId: `sequence:remove:${reason}`,
            ordinal: 1,
          },
          origin,
          target: owner,
          operation: 'remove',
          reason: reason as CombatStatusRemovalReasonV3,
          statusId: 'stance',
          statusName: '剑势',
          statusType: 'buff',
          beforeLayers: 1,
          afterLayers: 0,
        }),
      ).toContain(expected);
    }

    expect(
      present({
        id: 'immune',
        type: 'status',
        trace: {
          eventId: 'immune',
          sequenceId: 'sequence:immune',
          ordinal: 1,
        },
        origin,
        target: owner,
        operation: 'immune',
        statusId: 'control',
        statusName: '失魂',
        statusType: 'control',
      }),
    ).toContain('免疫「失魂」');
  });

  it('renders every queued action phase and ability mode', () => {
    const phaseText = {
      entered: '开始蓄势',
      triggered: '蓄势完成',
      cancelled: '蓄势被打断',
      skipped: '蓄势未能发动',
    } as const;
    const owner = { id: 'owner', name: '归属者' };
    const origin: CombatOriginV3 = {
      kind: 'owned',
      owner,
      carrier: { kind: 'ability', id: 'charge', name: '蓄势术' },
    };

    for (const [phase, expected] of Object.entries(phaseText)) {
      const sequence: CombatSequenceV3 = {
        id: `sequence:${phase}`,
        turn: 1,
        phase: 'action',
        facts: [
          {
            id: phase,
            type: 'action_state',
            trace: {
              eventId: phase,
              sequenceId: `sequence:${phase}`,
              ordinal: 1,
            },
            origin,
            target: owner,
            stateType: 'queued_action',
            phase: phase as keyof typeof phaseText,
            name: '蓄势',
            remainingActions: phase === 'entered' ? 1 : 0,
            ability: { id: 'strike', name: '听雷' },
          },
        ],
      };
      expect(
        new CombatPresenterV3('detailed').format(sequence).join('\n'),
      ).toContain(expected);
    }

    const abilityMode: CombatSequenceV3 = {
      id: 'sequence:ability-mode',
      turn: 1,
      phase: 'action',
      facts: [
        {
          id: 'ability-mode',
          type: 'action_state',
          trace: {
            eventId: 'ability-mode',
            sequenceId: 'sequence:ability-mode',
            ordinal: 1,
          },
          origin,
          target: owner,
          stateType: 'ability_mode',
          phase: 'entered',
          name: '剑心',
          remainingActions: 2,
        },
      ],
    };
    expect(
      new CombatPresenterV3('detailed').format(abilityMode).join('\n'),
    ).toContain('进入「剑心」状态');
  });

  it('describes shield-only damage without saying zero damage', () => {
    const sequence: CombatSequenceV3 = {
      id: 'sequence:shield-only',
      turn: 1,
      phase: 'action',
      facts: [
        {
          id: 'damage',
          type: 'damage',
          trace: {
            eventId: 'damage',
            sequenceId: 'sequence:shield-only',
            ordinal: 1,
            resolutionId: 'resolution',
          },
          origin: {
            kind: 'system',
            carrier: { kind: 'system', id: 'test', name: '测试系统' },
          },
          target: { id: 'target', name: '目标' },
          amount: 0,
          beforeHp: 100,
          afterHp: 100,
          damageType: DamageType.PHYSICAL,
          critical: false,
          shieldAbsorbed: 88,
        },
      ],
    };
    const output = new CombatPresenterV3('concise').format(sequence).join('\n');
    expect(output).toContain('护盾吸收 88 点伤害');
    expect(output).toContain('气血未损');
    expect(output).not.toContain('造成 0 点伤害');
  });

  it.each([
    [DamageType.PHYSICAL, 'damage_physical'],
    [DamageType.MAGICAL, 'damage_magical'],
    [DamageType.TRUE, 'damage_true'],
    [DamageType.DOT, 'damage_dot'],
  ] as const)(
    'assigns %s damage its dedicated narrative tone',
    (damageType, expectedTone) => {
      const line = new CombatFactNarratorV3('concise').narrate({
        kind: 'fact',
        fact: {
          id: `damage:${damageType}`,
          type: 'damage',
          trace: {
            eventId: `damage:${damageType}`,
            sequenceId: 'sequence:damage-tones',
            ordinal: 1,
          },
          origin: {
            kind: 'system',
            carrier: { kind: 'system', id: 'test', name: '测试系统' },
          },
          target: { id: 'target', name: '目标' },
          amount: 10,
          beforeHp: 100,
          afterHp: 90,
          damageType,
          critical: false,
          shieldAbsorbed: 0,
        },
      });

      expect(line.parts.find((part) => part.text === '10')?.tone).toBe(
        expectedTone,
      );
    },
  );

  it.each([
    ['buff', 'buff'],
    ['debuff', 'debuff'],
    ['control', 'control'],
  ] as const)(
    'assigns %s statuses their dedicated narrative tone',
    (statusType, expectedTone) => {
      const line = new CombatFactNarratorV3('concise').narrate({
        kind: 'fact',
        fact: {
          id: `status:${statusType}`,
          type: 'status',
          trace: {
            eventId: `status:${statusType}`,
            sequenceId: 'sequence:status-tones',
            ordinal: 1,
          },
          origin: {
            kind: 'system',
            carrier: { kind: 'system', id: 'test', name: '测试系统' },
          },
          target: { id: 'target', name: '目标' },
          operation: 'apply',
          transition: 'added',
          statusId: `status:${statusType}`,
          statusName: '测试状态',
          statusType,
          beforeLayers: 0,
          afterLayers: 1,
          duration: 2,
        },
      });

      expect(line.parts.find((part) => part.kind === 'status')?.tone).toBe(
        expectedTone,
      );
    },
  );

  it('uses the shield tone for mana shield settlement', () => {
    const line = new CombatFactNarratorV3('concise').narrate({
      kind: 'fact',
      fact: {
        id: 'defense:mana-shield',
        type: 'defense',
        trace: {
          eventId: 'defense:mana-shield',
          sequenceId: 'sequence:shield-tone',
          ordinal: 1,
        },
        origin: {
          kind: 'system',
          carrier: { kind: 'system', id: 'test', name: '测试系统' },
        },
        target: { id: 'target', name: '目标' },
        defense: 'mana_shield',
        amount: 20,
      },
    });

    expect(
      line.parts.filter((part) => part.tone).map((part) => part.tone),
    ).toEqual(['shield', 'shield']);
  });

  it('adds settlement details only in detailed mode', () => {
    const target = { id: 'target', name: '目标' };
    const sequence: CombatSequenceV3 = {
      id: 'sequence:mode-detail',
      turn: 1,
      phase: 'action',
      facts: [
        {
          id: 'damage-detail',
          type: 'damage',
          trace: {
            eventId: 'damage-detail',
            sequenceId: 'sequence:mode-detail',
            ordinal: 1,
            resolutionId: 'resolution:detail',
          },
          origin: {
            kind: 'system',
            carrier: { kind: 'system', id: 'test', name: '测试系统' },
          },
          target,
          amount: 60,
          beforeHp: 100,
          afterHp: 40,
          damageType: DamageType.PHYSICAL,
          critical: false,
          shieldAbsorbed: 0,
        },
        {
          id: 'recovery-detail',
          type: 'recovery',
          trace: {
            eventId: 'recovery-detail',
            sequenceId: 'sequence:mode-detail',
            ordinal: 2,
          },
          origin: {
            kind: 'system',
            carrier: { kind: 'system', id: 'test', name: '测试系统' },
          },
          target,
          resource: 'hp',
          amount: 20,
          after: 60,
        },
      ],
    };

    const concise = new CombatPresenterV3('concise')
      .format(sequence)
      .join('\n');
    const detailed = new CombatPresenterV3('detailed')
      .format(sequence)
      .join('\n');
    expect(concise).not.toContain('气血 100 → 40');
    expect(concise).not.toContain('结算后气血 60');
    expect(detailed).toContain('气血 100 → 40');
    expect(detailed).toContain('结算后气血 60');
  });

  it('does not commit a status spread fact when the 1v1 battle has no spread target', () => {
    const builder = new CombatFactSinkV3(EventBus.instance);
    const attacker = unit('attacker', '进攻者');
    const defender = unit('defender', '防守者');
    const ability = AbilityFactory.create({
      slug: 'spread-source',
      name: '扩散诀',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.BUFF,
      ],
      effects: [],
    });

    builder.runInFrame(
      { id: 'sequence:no-spread-target', phase: 'action', turn: 1 },
      () => {
        const trigger = EventBus.instance.publish({
          type: 'SpreadTriggerEvent',
          timestamp: Date.now(),
        });
        executeGameplayEffectV3(
          new StatusSpreadEffect({ match: {} }),
          EffectExecutionContextV3.activeAbility({
            owner: attacker,
            caster: attacker,
            target: defender,
            ability,
            trace: trigger.trace!,
          }),
        );
      },
    );

    expect(builder.getSequences()[0].facts).toEqual([]);
    builder.destroy();
  });

  it('dispatches committed results as immutable events', () => {
    const builder = new CombatFactSinkV3(EventBus.instance);
    const target = unit('target', '目标');
    const origin = ownedOrigin(target, {
      kind: 'mechanic',
      id: 'immutable-result',
      name: '不可变结果',
    });
    let observed = false;
    EventBus.instance.subscribe<
      import('./events').CombatResultCommittedEventV3
    >(
      'CombatResultCommittedEventV3',
      (event) => {
        observed = true;
        expect(Object.isFrozen(event)).toBe(true);
        expect(Object.isFrozen(event.trace)).toBe(true);
        expect(Object.isFrozen(event.origin)).toBe(true);
        expect(Object.isFrozen(event.result)).toBe(true);
        if (event.result.type === 'mechanic') {
          expect(Object.isFrozen(event.result.payload)).toBe(true);
        }
      },
      2_000,
    );

    builder.runInFrame(
      { id: 'sequence:immutable', phase: 'action', turn: 1 },
      () => {
        const trigger = EventBus.instance.publish({
          type: 'ImmutableTriggerEvent',
          timestamp: Date.now(),
        });
        new CombatResultEmitterV3().commit(
          target,
          {
            type: 'mechanic',
            code: 'immutable_result',
            payload: { kind: 'named_trigger', label: '不可变结果' },
          },
          { origin, parentTrace: trigger.trace! },
        );
      },
    );

    expect(observed).toBe(true);
    const fact = builder.getSequences()[0].facts[0];
    expect(Object.isFrozen(fact)).toBe(true);
    expect(Object.isFrozen(fact.target)).toBe(true);
    builder.destroy();
  });

  it('rejects missing result scope and invalid record invariants', () => {
    const target = unit('target', '目标');
    expect(() =>
      new CombatResultEmitterV3().commit(
        target,
        {
          type: 'mechanic',
          code: 'invalid',
          payload: { kind: 'named_trigger', label: '无来源' },
        },
        undefined as unknown as CombatResultScopeV3,
      ),
    ).toThrow(/has no origin/);

    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([
          {
            ...fact('mechanic', 1, 'death_prevented'),
            type: 'mechanic',
            code: '',
            payload: { kind: 'named_trigger', label: '' },
          },
        ]),
      ),
    ).toThrow(/mechanic fact .* incomplete/);

    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([
          {
            ...fact('mechanic-modifiers', 1, 'death_prevented'),
            type: 'mechanic',
            code: 'ability-transform',
            payload: {
              kind: 'ability_transform',
              triggers: 1,
              modifiers: [],
            },
          },
        ]),
      ),
    ).toThrow(/no ability modifiers/);

    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([
          {
            ...fact('cue-without-relation', 1, 'death_prevented'),
            type: 'mechanic',
            code: 'tag-trigger',
            payload: { kind: 'tag_trigger', label: '追击' },
          },
        ]),
      ),
    ).toThrow(/has no cue relation/);

    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([
          {
            ...damageFact('damage-without-type', 1),
            damageType: undefined,
          } as unknown as CombatFactV3,
        ]),
      ),
    ).toThrow(/invalid damage type/);

    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([
          {
            ...fact('inconsistent-cause', 1, 'death_prevented'),
            type: 'mechanic',
            code: 'named-trigger',
            payload: { kind: 'named_trigger', label: '剑势' },
            trace: {
              eventId: 'inconsistent-cause',
              sequenceId: 'sequence:action',
              ordinal: 1,
              narrativeCauseId: 'cause:trace',
            },
            narrative: { causeId: 'cause:fact', role: 'result' },
          },
        ]),
      ),
    ).toThrow(/inconsistent narrative cause/);

    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([
          {
            ...fact('status-remove', 1, 'death_prevented'),
            type: 'status',
            operation: 'remove',
            statusId: 'status',
            statusName: '状态',
            statusType: 'buff',
          } as CombatFactV3,
        ]),
      ),
    ).toThrow(/invalid removal reason/);

    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([
          {
            ...fact('status-layers', 1, 'death_prevented'),
            type: 'status',
            operation: 'layers',
            reason: 'modified',
            statusId: 'status',
            statusName: '状态',
            statusType: 'buff',
            beforeLayers: 1,
            afterLayers: 1,
          },
        ]),
      ),
    ).toThrow(/invalid layer change/);

    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([
          {
            ...fact('queued-action', 1, 'death_prevented'),
            type: 'action_state',
            stateType: 'queued_action',
            phase: 'entered',
            name: '蓄势',
            remainingActions: 1,
          } as CombatFactV3,
        ]),
      ),
    ).toThrow(/queued action .* has no ability/);

    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([fact('death:1', 1), fact('death:2', 2)]),
      ),
    ).toThrow(/duplicate death/);
    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([
          fact('prevented', 1, 'death_prevented'),
          fact('death', 2),
        ]),
      ),
    ).toThrow(/both death prevention and death/);

    const duplicateOrdinal = recordWithFacts([
      fact('death', 1),
      {
        ...fact('mechanic', 1, 'death_prevented', 'resolution:2'),
        type: 'death_prevented',
      },
    ]);
    expect(() => validateBattleRecordV3(duplicateOrdinal)).toThrow(
      /duplicate ordinal|not monotonic/,
    );

    const orphan = recordWithFacts([]);
    orphan.stateTimeline.frames[0].sourceSequenceId = 'sequence:missing';
    expect(() => validateBattleRecordV3(orphan)).toThrow(/unknown sequence/);

    const inconsistent = recordWithFacts([]);
    inconsistent.finalSnapshots.loser = snapshot('loser', '败者', false);
    expect(() => new BattleRecordValidatorV3(inconsistent).validate()).toThrow(
      /final snapshots/,
    );

    const invalidResource = recordWithFacts([
      {
        ...fact('resource', 1, 'death_prevented'),
        type: 'resource',
        resourceId: 'guard',
        resourceName: '守势',
        before: 1,
        after: 3,
        applied: 1,
      },
    ]);
    expect(() => validateBattleRecordV3(invalidResource)).toThrow(
      /inconsistent applied value/,
    );

    expect(() =>
      validateBattleRecordV3(recordWithFacts([fact('orphan-death', 1)])),
    ).toThrow(/has no matching damage/);
    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([fact('orphan-prevention', 1, 'death_prevented')]),
      ),
    ).toThrow(/has no matching damage/);

    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([damageFact('damage:1', 1), damageFact('damage:2', 2)]),
      ),
    ).toThrow(/duplicate damage facts/);

    expect(() =>
      validateBattleRecordV3(
        recordWithFacts([
          damageFact('damage:target', 1),
          {
            ...fact('prevention:other-target', 2, 'death_prevented'),
            target: { id: 'winner', name: '胜者' },
          },
        ]),
      ),
    ).toThrow(/does not match damage target/);

    const invalidActionState = recordWithFacts([
      {
        ...damageFact('damage:valid', 1),
        type: 'action_state',
        stateType: 'internal_state' as 'rest',
        phase: 'internal_phase' as 'entered',
        name: '',
        remainingActions: 1,
      },
    ]);
    expect(() => validateBattleRecordV3(invalidActionState)).toThrow(
      /invalid action state/,
    );
  });

  it('rejects a dead unit entering a later action sequence', () => {
    const record = recordWithFacts([damageFact('damage', 1), fact('death', 2)]);
    record.sequences.splice(1, 0, {
      id: 'sequence:illegal-action',
      turn: 1,
      phase: 'action',
      actor: { id: 'loser', name: '败者' },
      facts: [],
    });
    expect(() => validateBattleRecordV3(record)).toThrow(/dead unit/);
  });

  it('rejects owned facts committed after the owner dies in the same sequence', () => {
    const record = recordWithFacts([
      damageFact('damage', 1),
      fact('death', 2),
      {
        ...damageFact('post-death-damage', 3, 'resolution:2'),
        origin: {
          kind: 'owned',
          owner: { id: 'loser', name: '败者' },
          carrier: { kind: 'ability', id: 'late-hit', name: '迟来的攻击' },
        },
        target: { id: 'winner', name: '胜者' },
        beforeHp: 2,
        afterHp: 1,
      },
    ]);

    expect(() => validateBattleRecordV3(record)).toThrow(
      /dead unit .* commits owned fact/,
    );
  });

});
