import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { Buff, StackRule } from '../../buffs/Buff';
import { EventBus } from '../../core/EventBus';
import { createHitResolution } from '../../core/resolution';
import {
  ActionPostEvent,
  ActionStateEvent,
  BuffAddEvent,
  BuffAppliedEvent,
  CooldownModifyEvent,
  DamageSegmentRequestedEvent,
  DamageSegmentAppliedEvent,
  RoundPreEvent,
  ShieldBreakEvent,
} from '../../core/events';
import {
  markDamageDealt,
  readAbilityMode,
  readMemory,
} from '../../core/runtimeState';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from '../../core/types';
import { AbilityModeEffect } from '../../effects/AbilityModeEffect';
import {
  AbilityLockEffect,
  AbilityTransformEffect,
  BuffCopyEffect,
  BuffLayerModifyEffect,
  ConsumeStatusTriggerEffect,
  DamageDeferEffect,
  DamageMemoryEffect,
  DelayedEffect,
  HpSacrificeDamageEffect,
  NextHitRuleEffect,
  TurnStateCounterEffect,
} from '../../effects/AdvancedEffects';
import { DamageEffect } from '../../effects/DamageEffect';
import { DispelEffect } from '../../effects/DispelEffect';
import { TagTriggerEffect } from '../../effects/TagTriggerEffect';
import '../../effects/ShieldEffect';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { BuffFactory } from '../../factories/BuffFactory';
import { Unit } from '../../units/Unit';
import {
  collectCommittedResultsV3,
  runTestActionV3,
} from '../setup/combatV3TestHarness';
import { executeTestEffect } from '../setup/executeTestEffect';

function createUnit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.SPIRIT]: 100,
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
    [AttributeType.ENDURANCE]: 100,
  });
}

describe('Advanced battle effects', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  it('ability mode publishes a structured action state event', () => {
    const caster = createUnit('caster');
    const ability = AbilityFactory.create({
      slug: 'mode-entry',
      name: '形态技能',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.FUNCTION.BUFF],
      effects: [],
    });
    const states: ActionStateEvent[] = [];
    const mechanics = collectCommittedResultsV3('mechanic');
    EventBus.instance.subscribe<ActionStateEvent>('ActionStateEvent', (event) =>
      states.push(event),
    );

    executeTestEffect(
      new AbilityModeEffect({
        key: 'combat-form',
        operation: 'set',
        mode: 'guard',
        displayName: '守势',
        remainingUses: 2,
      }),
      { caster, target: caster, ability },
    );

    expect(readAbilityMode(caster, 'combat-form')).toMatchObject({
      mode: 'guard',
      displayName: '守势',
      remainingUses: 2,
    });
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({
      unit: caster,
      stateType: 'ability_mode',
      phase: 'entered',
      name: '守势',
      remainingActions: 2,
      sourceAbility: {
        id: 'mode-entry',
        name: '形态技能',
      },
    });
    expect(mechanics).toHaveLength(0);
  });

  it('consumes matching status layers and executes child effects', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const poison = new Buff(
      'poison',
      '毒',
      BuffType.DEBUFF,
      3,
      StackRule.STACK_LAYER,
    );
    poison.tags.addTags([GameplayTags.BUFF.DOT.POISON]);
    poison.setLayer(3);
    target.buffs.addBuff(poison, caster);

    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    executeTestEffect(
      new ConsumeStatusTriggerEffect({
        match: { tags: [GameplayTags.BUFF.DOT.POISON] },
        consume: 'all',
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 20,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0,
              },
            },
          },
        ],
      }),
      { caster, target },
    );

    expect(target.buffs.getAllBuffs()).toHaveLength(0);
    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBe(20);
  });

  it('combines layer-scaled status damage into one segment', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const mark = new Buff('aggregate_mark', '聚合印记', BuffType.DEBUFF, 3, StackRule.STACK_LAYER);
    mark.setLayer(3);
    target.buffs.addBuff(mark, caster);
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => requests.push(event),
    );

    executeTestEffect(
      new ConsumeStatusTriggerEffect({
        match: { id: 'aggregate_mark' },
        consume: 'all',
        aggregateDamageByLayer: true,
        effects: [{
          type: 'damage',
          params: { value: { base: 20, attribute: AttributeType.MAGIC_ATK, coefficient: 0 } },
        }],
      }),
      { caster, target },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBe(60);
  });

  it('consume status trigger commits one final consumed status fact', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const poison = new Buff(
      'poison_log',
      '毒',
      BuffType.DEBUFF,
      3,
      StackRule.STACK_LAYER,
    );
    poison.tags.addTags([GameplayTags.BUFF.DOT.POISON]);
    poison.setLayer(3);
    target.buffs.addBuff(poison, caster);
    const statuses = collectCommittedResultsV3('status');

    executeTestEffect(
      new ConsumeStatusTriggerEffect({
        match: { tags: [GameplayTags.BUFF.DOT.POISON] },
        consume: 'all',
        effects: [],
      }),
      { caster, target },
    );

    expect(statuses).toHaveLength(1);
    expect(statuses[0].result).toMatchObject({
      type: 'status',
      operation: 'remove',
      reason: 'consumed',
      statusName: '毒',
      beforeLayers: 3,
      afterLayers: 0,
    });
  });

  it('partially consumed status is represented by one layer fact', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const poison = new Buff(
      'poison_partial',
      '毒',
      BuffType.DEBUFF,
      3,
      StackRule.STACK_LAYER,
    );
    poison.tags.addTags([GameplayTags.BUFF.DOT.POISON]);
    poison.setLayer(3);
    target.buffs.addBuff(poison, caster);
    const statuses = collectCommittedResultsV3('status');
    const mechanics = collectCommittedResultsV3('mechanic');

    executeTestEffect(
      new ConsumeStatusTriggerEffect({
        match: { tags: [GameplayTags.BUFF.DOT.POISON] },
        consume: 2,
        effects: [],
      }),
      { caster, target },
    );

    expect(statuses).toHaveLength(1);
    expect(statuses[0].result).toMatchObject({
      type: 'status',
      operation: 'layers',
      reason: 'consumed',
      beforeLayers: 3,
      afterLayers: 1,
    });
    expect(mechanics).toHaveLength(0);
  });

  it('links a mechanic cue to its final result explicitly', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const mechanics = collectCommittedResultsV3('mechanic');
    const shields = collectCommittedResultsV3('shield');

    executeTestEffect(
      new TagTriggerEffect({
        triggerTag: GameplayTags.STATUS.ROOT,
        displayName: '毒发',
        effects: [{ type: 'shield', params: { value: { base: 10 } } }],
      }),
      { caster, target },
    );

    expect(mechanics).toHaveLength(1);
    expect(shields).toHaveLength(1);
    expect(mechanics[0].narrative).toMatchObject({ role: 'cue' });
    expect(shields[0].narrative).toMatchObject({
      causeId: mechanics[0].narrative?.causeId,
      role: 'result',
    });
  });

  it('represents dispel with one final status fact', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const poison = new Buff(
      'poison_dispel',
      '毒',
      BuffType.DEBUFF,
      3,
      StackRule.STACK_LAYER,
    );
    poison.tags.addTags([GameplayTags.BUFF.DOT.POISON]);
    target.buffs.addBuff(poison, caster);
    const statuses = collectCommittedResultsV3('status');
    const defenses = collectCommittedResultsV3('defense');

    executeTestEffect(
      new DispelEffect({
        targetTag: GameplayTags.BUFF.DOT.POISON,
        maxCount: 1,
      }),
      { caster, target },
    );

    expect(statuses).toHaveLength(1);
    expect(statuses[0].result).toMatchObject({
      type: 'status',
      operation: 'remove',
      reason: 'dispelled',
      beforeLayers: 1,
      afterLayers: 0,
    });
    expect(defenses).toHaveLength(0);
  });

  it('delayed effect triggers on owner action post', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    executeTestEffect(
      new DelayedEffect({
        id: 'delay_test',
        name: '延迟测试',
        delayTurns: 2,
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 30,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0,
              },
            },
          },
        ],
      }),
      { caster, target },
    );

    const post = (): void =>
      EventBus.instance.publish<ActionPostEvent>({
        type: 'ActionPostEvent',
        timestamp: Date.now(),
        caster: target,
        resolution: createHitResolution({
          actionId: 'advanced:delay-action',
          castId: 'advanced:delay-cast',
          caster: target,
          target,
        }),
      });

    post();
    expect(requests).toHaveLength(0);
    post();
    expect(requests).toHaveLength(1);
    expect(target.buffs.getAllBuffs()).toHaveLength(0);
  });

  it('delayed effect cancels on dispel unless triggerOnDispel is enabled', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    executeTestEffect(
      new DelayedEffect({
        id: 'delay_cancel_test',
        name: '延迟取消测试',
        delayTurns: 2,
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 30,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0,
              },
            },
          },
        ],
      }),
      { caster, target },
    );

    target.buffs.removeBuffDispel('delay_cancel_test');
    expect(requests).toHaveLength(0);

    executeTestEffect(
      new DelayedEffect({
        id: 'delay_detonate_test',
        name: '延迟驱散触发测试',
        delayTurns: 2,
        triggerOnDispel: true,
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 40,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0,
              },
            },
          },
        ],
      }),
      { caster, target },
    );

    runTestActionV3(caster, () =>
      target.buffs.removeBuffDispel('delay_detonate_test'),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBe(40);
  });

  it('delayed effect can record damage taken during the delay window', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    executeTestEffect(
      new DelayedEffect({
        id: 'delay_memory_test',
        name: '延迟记忆测试',
        delayTurns: 1,
        record: { key: 'delay_damage', event: 'damage_taken' },
        effects: [
          {
            type: 'damage_memory',
            params: {
              key: 'delay_damage',
              mode: 'release',
              ratio: 0.5,
              releaseAs: 'damage',
              target: 'target',
            },
          },
        ],
      }),
      { caster, target },
    );

    EventBus.instance.publish<DamageSegmentAppliedEvent>({
      type: 'DamageSegmentAppliedEvent',
      timestamp: Date.now(),
      caster,
      target,
      resolution: createHitResolution({
        actionId: 'advanced:damage-action',
        castId: 'advanced:damage-cast',
        caster,
        target,
      }),
      damageTaken: 80,
      beforeHp: target.getCurrentHp(),
      remainHp: target.getCurrentHp() - 80,
      hpReachedZeroBeforeReactions: false,
    });
    EventBus.instance.publish<ActionPostEvent>({
      type: 'ActionPostEvent',
      timestamp: Date.now(),
      caster: target,
      resolution: createHitResolution({
        actionId: 'advanced:post-action',
        castId: 'advanced:post-cast',
        caster: target,
        target,
      }),
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBe(40);
  });

  it('damage memory ignores same-id units from another runtime instance', () => {
    const owner = createUnit('same-id');
    const otherRuntimeOwner = createUnit('same-id');
    const attacker = createUnit('attacker');

    executeTestEffect(
      new DamageMemoryEffect({
        key: 'isolated_damage',
        mode: 'record',
        event: 'damage_taken',
        target: 'target',
      }),
      {
        caster: attacker,
        target: owner,
        triggerEvent: {
          type: 'DamageSegmentAppliedEvent',
          timestamp: Date.now(),
          caster: attacker,
          target: otherRuntimeOwner,
          damageTaken: 100,
          beforeHp: 1000,
          remainHp: 900,
          hpReachedZeroBeforeReactions: false,
        } satisfies DamageSegmentAppliedEvent,
      },
    );

    expect(readMemory(owner, 'isolated_damage').amount).toBe(0);
  });

  it('damage memory records and releases as shield without leaking through Unit fields', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const damageEvent: DamageSegmentAppliedEvent = {
      type: 'DamageSegmentAppliedEvent',
      timestamp: Date.now(),
      caster,
      target,
      damageTaken: 80,
      beforeHp: target.getCurrentHp(),
      remainHp: target.getCurrentHp() - 80,
      hpReachedZeroBeforeReactions: false,
    };

    executeTestEffect(
      new DamageMemoryEffect({
        key: 'stored',
        mode: 'record',
        event: 'damage_taken',
        target: 'target',
      }),
      { caster, target, triggerEvent: damageEvent },
    );

    executeTestEffect(
      new DamageMemoryEffect({
        key: 'stored',
        mode: 'release',
        ratio: 0.5,
        releaseAs: 'shield',
        target: 'target',
      }),
      { caster, target },
    );

    expect(target.getCurrentShield()).toBe(40);
  });

  it('damage memory can include shield absorption in damage taken amount', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    executeTestEffect(
      new DamageMemoryEffect({
        key: 'shielded_reflect',
        mode: 'release',
        ratio: 0.5,
        releaseAs: 'reflect',
        target: 'target',
        includeShieldAbsorbed: true,
      }),
      {
        caster,
        target,
        triggerEvent: {
          type: 'DamageSegmentAppliedEvent',
          timestamp: Date.now(),
          caster,
          target,
          damageTaken: 80,
          shieldAbsorbed: 120,
          beforeHp: target.getCurrentHp(),
          remainHp: target.getCurrentHp() - 80,
          hpReachedZeroBeforeReactions: false,
        } satisfies DamageSegmentAppliedEvent,
      },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      caster: target,
      target: caster,
      damageSource: DamageSource.REFLECT,
      damageType: DamageType.TRUE,
      baseDamage: 100,
      finalDamage: 100,
    });
  });

  it('damage memory maxStoredValue scales with runtime max HP', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const mechanics = collectCommittedResultsV3('mechanic');
    target.attributes.addModifier({
      id: 'test_hp_override',
      attrType: AttributeType.MAX_HP,
      type: ModifierType.OVERRIDE,
      value: 20_000,
      source: 'test',
    });
    target.updateDerivedStats();

    executeTestEffect(
      new DamageMemoryEffect({
        key: 'scaled_cap',
        mode: 'record',
        event: 'damage_taken',
        target: 'target',
        maxStoredValue: { targetMaxHpRatio: 0.5 },
      }),
      {
        caster,
        target,
        triggerEvent: {
          type: 'DamageSegmentAppliedEvent',
          timestamp: Date.now(),
          caster,
          target,
          damageTaken: 50_000,
          beforeHp: target.getCurrentHp(),
          remainHp: target.getCurrentHp() - 50_000,
          hpReachedZeroBeforeReactions: true,
        } satisfies DamageSegmentAppliedEvent,
      },
    );

    expect(readMemory(target, 'scaled_cap').amount).toBe(10_000);
    expect(mechanics).toHaveLength(1);
    expect(mechanics[0].result).toMatchObject({
      type: 'mechanic',
      payload: {
        kind: 'memory_record',
        source: 'damage_taken',
        sampledAmount: 50_000,
        before: 0,
        after: 10_000,
      },
    });
  });

  it('damage memory can release shield break amount as true damage', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    executeTestEffect(
      new DamageMemoryEffect({
        key: 'shield_break',
        mode: 'release',
        event: 'shield_break',
        ratio: 0.45,
        releaseAs: 'damage',
        target: 'target',
      }),
      {
        caster,
        target,
        triggerEvent: {
          type: 'ShieldBreakEvent',
          timestamp: Date.now(),
          caster,
          target,
          brokenShieldAmount: 400,
          overflowDamage: 120,
        } satisfies ShieldBreakEvent,
      },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBe(180);
    expect(requests[0].damageType).toBe(DamageType.TRUE);
  });

  it('mounts only one listener effect for a global unique key', () => {
    const owner = createUnit('owner');
    const attacker = createUnit('attacker');
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    const createReflectPassive = (slug: string) =>
      AbilityFactory.create({
        slug,
        name: slug,
        type: AbilityType.PASSIVE_SKILL,
        tags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.TRUE,
        ],
        listeners: [
          {
            eventType: 'DamageSegmentAppliedEvent',
            scope: 'owner_as_target',
            priority: 0,
            guard: { skipReflectSource: true },
            effects: [
              {
                type: 'damage_memory',
                globalUnique: { key: 'test-global-reflect', label: '测试反伤' },
                params: {
                  key: 'test_reflect',
                  mode: 'release',
                  ratio: 1,
                  releaseAs: 'reflect',
                  target: 'target',
                },
              },
            ],
          },
        ],
      });

    owner.abilities.addAbility(createReflectPassive('global-reflect-a'));
    owner.abilities.addAbility(createReflectPassive('global-reflect-b'));

    EventBus.instance.publish<DamageSegmentAppliedEvent>({
      type: 'DamageSegmentAppliedEvent',
      resolution: createHitResolution({
        actionId: 'global-reflect:action',
        castId: 'global-reflect:cast',
        caster: attacker,
        target: owner,
      }),
      timestamp: Date.now(),
      caster: attacker,
      target: owner,
      damageTaken: 10,
      beforeHp: 100,
      remainHp: 90,
      shieldAbsorbed: 0,
      remainShield: 0,
      hpReachedZeroBeforeReactions: false,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      caster: owner,
      target: attacker,
      finalDamage: 10,
    });
  });

  it('buff layer modify removes a buff at zero layers and scales child effects by previous layers', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const mark = new Buff(
      'mark',
      '印记',
      BuffType.DEBUFF,
      3,
      StackRule.STACK_LAYER,
    );
    mark.tags.addTags([GameplayTags.BUFF.ELEMENT.THUNDER]);
    mark.setLayer(2);
    target.buffs.addBuff(mark, caster);
    const statuses = collectCommittedResultsV3('status');
    const mechanics = collectCommittedResultsV3('mechanic');

    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    executeTestEffect(
      new BuffLayerModifyEffect({
        match: { id: 'mark' },
        operation: 'clear',
        scaleEffectsByLayer: true,
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 10,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0,
              },
            },
          },
        ],
      }),
      { caster, target },
    );

    expect(target.buffs.getAllBuffs()).toHaveLength(0);
    expect(requests).toHaveLength(2);
    expect(statuses).toHaveLength(1);
    expect(statuses[0].result).toMatchObject({
      type: 'status',
      operation: 'remove',
      reason: 'manual',
      beforeLayers: 2,
      afterLayers: 0,
    });
    expect(mechanics).toHaveLength(0);
  });

  it('stacking an existing buff emits applied event with updated layers for logs', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const applied: BuffAppliedEvent[] = [];
    EventBus.instance.subscribe<BuffAppliedEvent>(
      'BuffAppliedEvent',
      (event) => {
        applied.push(event);
      },
    );

    const first = new Buff(
      'thunder_mark_log',
      '雷印',
      BuffType.DEBUFF,
      3,
      StackRule.STACK_LAYER,
    );
    first.tags.addTags([GameplayTags.BUFF.ELEMENT.THUNDER]);
    const second = new Buff(
      'thunder_mark_log',
      '雷印',
      BuffType.DEBUFF,
      3,
      StackRule.STACK_LAYER,
    );
    second.tags.addTags([GameplayTags.BUFF.ELEMENT.THUNDER]);

    target.buffs.addBuff(first, caster);
    target.buffs.addBuff(second, caster);

    expect(applied).toHaveLength(2);
    expect(applied[1].buff.getLayer()).toBe(2);
  });

  it('ability transform affects the next matching damage once', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const skill = AbilityFactory.create({
      slug: 'transform_target',
      name: '变形目标',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
      ],
      effects: [
        {
          type: 'damage',
          params: {
            value: {
              base: 10,
              attribute: AttributeType.MAGIC_ATK,
              coefficient: 0,
            },
          },
        },
      ],
    });
    caster.abilities.addAbility(skill);

    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    executeTestEffect(
      new AbilityTransformEffect({
        id: 'next_true_crit',
        triggers: 1,
        trueDamage: true,
        forceCritical: true,
      }),
      { caster, target: caster },
    );

    executeTestEffect(
      new DamageEffect({
        value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
      }),
      { caster, target, ability: skill },
    );
    executeTestEffect(
      new DamageEffect({
        value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
      }),
      { caster, target, ability: skill },
    );

    expect(requests[0].damageType).toBe(DamageType.TRUE);
    expect(requests[0].isCritical).toBe(true);
    expect(requests[1].damageType).toBe(DamageType.MAGICAL);
    expect(requests[1].isCritical).toBeUndefined();
  });

  it('ability transform is consumed at skill level and applies across all damage effects once', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const debuffA = new Buff(
      'debuff_a',
      '甲咒',
      BuffType.DEBUFF,
      2,
      StackRule.OVERRIDE,
    );
    const debuffB = new Buff(
      'debuff_b',
      '乙咒',
      BuffType.DEBUFF,
      2,
      StackRule.OVERRIDE,
    );
    debuffA.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);
    debuffB.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);
    target.buffs.addBuff(debuffA, caster);
    target.buffs.addBuff(debuffB, caster);

    const skill = AbilityFactory.create({
      slug: 'multi_hit_transform',
      name: '多段变形',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
      ],
      effects: [
        {
          type: 'damage',
          params: {
            value: {
              base: 10,
              attribute: AttributeType.MAGIC_ATK,
              coefficient: 0,
            },
          },
        },
        {
          type: 'damage',
          params: {
            value: {
              base: 12,
              attribute: AttributeType.MAGIC_ATK,
              coefficient: 0,
            },
          },
        },
      ],
    });
    caster.abilities.addAbility(skill);

    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    executeTestEffect(
      new AbilityTransformEffect({
        id: 'skill_level_transform',
        triggers: 1,
        trueDamage: true,
        addDispel: { targetTag: GameplayTags.BUFF.TYPE.DEBUFF, maxCount: 1 },
      }),
      { caster, target: caster },
    );

    runTestActionV3(caster, () => skill.execute({ caster, target, resolution: createHitResolution({ actionId: 'transform:1', castId: 'transform:1', caster, target }) }));
    runTestActionV3(caster, () => skill.execute({ caster, target, resolution: createHitResolution({ actionId: 'transform:2', castId: 'transform:2', caster, target }) }));

    expect(requests.slice(0, 2).map((event) => event.damageType)).toEqual([
      DamageType.TRUE,
      DamageType.TRUE,
    ]);
    expect(requests[2].damageType).toBe(DamageType.MAGICAL);
    expect(requests[3].damageType).toBe(DamageType.MAGICAL);
    expect(target.buffs.getAllBuffs()).toHaveLength(1);
  });

  it('apply_buff can explicitly apply a buff to the caster from an enemy-targeted effect', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const skill = AbilityFactory.create({
      slug: 'self_buff_from_attack',
      name: '攻中自益',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.FUNCTION.BUFF],
      effects: [
        {
          type: 'apply_buff',
          params: {
            target: 'caster',
            buffConfig: {
              id: 'self_haste',
              name: '自疾',
              type: BuffType.BUFF,
              duration: 2,
              stackRule: StackRule.REFRESH_DURATION,
              tags: [GameplayTags.BUFF.TYPE.BUFF],
            },
          },
        },
      ],
    });

    runTestActionV3(caster, () => skill.execute({ caster, target, resolution: createHitResolution({ actionId: 'self-buff:1', castId: 'self-buff:1', caster, target }) }));

    expect(caster.buffs.getAllBuffIds()).toContain('self_haste');
    expect(target.buffs.getAllBuffIds()).not.toContain('self_haste');
  });

  it('buff copy can copy an incoming debuff back to the event source', () => {
    const source = createUnit('source');
    const owner = createUnit('owner');
    const equipment = AbilityFactory.create({
      slug: 'copy-equipment',
      name: '照影镜',
      type: AbilityType.PASSIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.ARTIFACT,
        GameplayTags.ABILITY.FUNCTION.BUFF,
      ],
      listeners: [],
    });
    const incoming = new Buff(
      'curse',
      '咒',
      BuffType.DEBUFF,
      2,
      StackRule.OVERRIDE,
    );
    incoming.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);

    const event: BuffAddEvent = {
      type: 'BuffAddEvent',
      timestamp: Date.now(),
      source,
      target: owner,
      buff: incoming,
    };

    executeTestEffect(
      new BuffCopyEffect({
        match: { tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
        target: 'caster',
      }),
      {
        owner,
        caster: source,
        target: owner,
        ability: equipment,
        triggerEvent: event,
      },
    );

    expect(source.buffs.getAllBuffIds()).toContain('curse');
    expect(owner.buffs.getAllBuffIds()).not.toContain('curse');
    expect(
      source.buffs.getAllBuffs()[0].getCombatAttributionV3()?.origin,
    ).toMatchObject({
      kind: 'owned',
      owner: { id: owner.id },
      carrier: { kind: 'equipment', id: equipment.id },
    });
  });

  it('buff copy can replay the latest dispelled matching debuff', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const curse = new Buff(
      'old_curse',
      '旧咒',
      BuffType.DEBUFF,
      2,
      StackRule.OVERRIDE,
    );
    curse.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);
    target.buffs.addBuff(curse, caster);
    target.buffs.removeBuffDispel('old_curse');

    executeTestEffect(
      new BuffCopyEffect({
        match: { tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
        target: 'target',
        replayRemoved: true,
      }),
      { caster, target },
    );

    expect(target.buffs.getAllBuffIds()).toContain('old_curse');
  });

  it('buff copy replayRemoved ignores active buffs and only replays dispelled history', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const activeCurse = new Buff(
      'active_curse',
      '现咒',
      BuffType.DEBUFF,
      2,
      StackRule.OVERRIDE,
    );
    activeCurse.tags.addTags([GameplayTags.BUFF.TYPE.DEBUFF]);
    target.buffs.addBuff(activeCurse, caster);

    executeTestEffect(
      new BuffCopyEffect({
        match: { tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
        target: 'caster',
        replayRemoved: true,
      }),
      { caster, target },
    );

    expect(caster.buffs.getAllBuffIds()).not.toContain('active_curse');
  });

  it('buff copy preserves data-driven buff runtime layers and remaining duration', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const sourceBuff = BuffFactory.create({
      id: 'layered_curse',
      name: '层咒',
      type: BuffType.DEBUFF,
      duration: 4,
      stackRule: StackRule.STACK_LAYER,
      tags: [GameplayTags.BUFF.TYPE.DEBUFF],
    });
    sourceBuff.setLayer(3);
    target.buffs.addBuff(sourceBuff, caster);
    sourceBuff.tickDuration();
    target.buffs.removeBuffDispel('layered_curse');

    executeTestEffect(
      new BuffCopyEffect({
        match: { tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
        target: 'target',
        replayRemoved: true,
      }),
      { caster, target },
    );

    const replayed = target.buffs
      .getAllBuffs()
      .find((buff) => buff.id === 'layered_curse');
    expect(replayed?.getLayer()).toBe(3);
    expect(replayed?.getDuration()).toBe(3);
  });

  it('buff copy can be limited to the first incoming buff and avoids self-copy recursion', () => {
    const owner = createUnit('owner');
    const effect = new BuffCopyEffect({
      id: 'first_buff_only',
      match: { tags: [GameplayTags.BUFF.TYPE.BUFF] },
      target: 'caster',
      durationDelta: 1,
      maxTriggers: 1,
    });
    EventBus.instance.subscribe<BuffAddEvent>('BuffAddEvent', (event) => {
      executeTestEffect(effect, {
        caster: owner,
        target: owner,
        triggerEvent: event,
      });
    });

    const first = new Buff(
      'first_blessing',
      '初佑',
      BuffType.BUFF,
      2,
      StackRule.OVERRIDE,
    );
    first.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);
    const second = new Buff(
      'second_blessing',
      '再佑',
      BuffType.BUFF,
      2,
      StackRule.OVERRIDE,
    );
    second.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);

    owner.buffs.addBuff(first, owner);
    owner.buffs.addBuff(second, owner);

    expect(
      owner.buffs
        .getAllBuffs()
        .find((buff) => buff.id === 'first_blessing')
        ?.getMaxDuration(),
    ).toBe(3);
    expect(
      owner.buffs
        .getAllBuffs()
        .find((buff) => buff.id === 'second_blessing')
        ?.getMaxDuration(),
    ).toBe(2);
  });

  it('buff copy recursion guard is scoped to the receiving unit runtime state', () => {
    const battleOneOwner = createUnit('same-owner-id');
    const battleOneTarget = createUnit('battle-one-target');
    const battleTwoOwner = createUnit('same-owner-id');
    const battleOneEffect = new BuffCopyEffect({
      match: { tags: [GameplayTags.BUFF.TYPE.BUFF] },
      target: 'caster',
    });
    const battleTwoEffect = new BuffCopyEffect({
      match: { tags: [GameplayTags.BUFF.TYPE.BUFF] },
      target: 'caster',
      maxTriggers: 1,
    });
    let insideBattleOneCopy = false;

    EventBus.instance.subscribe<BuffAddEvent>('BuffAddEvent', (event) => {
      if (event.target !== battleOneTarget) return;

      insideBattleOneCopy = true;
      try {
        executeTestEffect(battleOneEffect, {
          caster: battleOneOwner,
          target: battleOneTarget,
          triggerEvent: event,
        });
      } finally {
        insideBattleOneCopy = false;
      }
    });
    EventBus.instance.subscribe<BuffAddEvent>('BuffAddEvent', (event) => {
      if (!insideBattleOneCopy) return;

      executeTestEffect(battleTwoEffect, {
        caster: battleTwoOwner,
        target: battleTwoOwner,
        triggerEvent: event,
      });
    });

    const blessing = new Buff(
      'shared_blessing',
      '同名赐福',
      BuffType.BUFF,
      2,
      StackRule.OVERRIDE,
    );
    blessing.tags.addTags([GameplayTags.BUFF.TYPE.BUFF]);
    battleOneTarget.buffs.addBuff(blessing, battleOneOwner);

    expect(battleOneOwner.buffs.getAllBuffIds()).toContain('shared_blessing');
    expect(battleTwoOwner.buffs.getAllBuffIds()).toContain('shared_blessing');
  });

  it('next hit rule applies to the caster rather than the current target', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const skill = AbilityFactory.create({
      slug: 'next_hit_target',
      name: '下一击目标',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
      ],
      effects: [
        {
          type: 'damage',
          params: {
            value: {
              base: 10,
              attribute: AttributeType.MAGIC_ATK,
              coefficient: 0,
            },
          },
        },
      ],
    });
    caster.abilities.addAbility(skill);

    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    executeTestEffect(
      new NextHitRuleEffect({ forceCritical: true, triggers: 1 }),
      {
        caster,
        target,
      },
    );
    executeTestEffect(
      new DamageEffect({
        value: { base: 10, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
      }),
      { caster, target, ability: skill },
    );

    expect(requests[0].isCritical).toBe(true);
  });

  it('turn state counter for no-damage resets when owner dealt damage', () => {
    const owner = createUnit('owner');
    const target = createUnit('target');
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    const counter = new TurnStateCounterEffect({
      key: 'idle',
      event: 'no_damage_dealt',
      threshold: 2,
      effects: [
        {
          type: 'damage',
          params: {
            value: {
              base: 10,
              attribute: AttributeType.MAGIC_ATK,
              coefficient: 0,
            },
          },
        },
      ],
    });

    executeTestEffect(counter, { caster: owner, target });
    markDamageDealt(owner);
    executeTestEffect(counter, {
      caster: owner,
      target,
      triggerEvent: {
        type: 'RoundPreEvent',
        timestamp: Date.now(),
        turn: 2,
      } satisfies RoundPreEvent,
    });
    executeTestEffect(counter, { caster: owner, target });

    expect(requests).toHaveLength(0);
    executeTestEffect(counter, { caster: owner, target });
    expect(requests).toHaveLength(1);
  });

  it('damage defer reduces current damage and creates delayed damage buff', () => {
    const attacker = createUnit('attacker');
    const defender = createUnit('defender');
    const event: DamageSegmentRequestedEvent = {
      type: 'DamageSegmentRequestedEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      finalDamage: Math.round(defender.getMaxHp() * 0.3),
      damageType: DamageType.MAGICAL,
    };

    executeTestEffect(
      new DamageDeferEffect({
        ratio: 0.5,
        delayTurns: 2,
        thresholdMaxHpRatio: 0.25,
      }),
      { caster: defender, target: defender, triggerEvent: event },
    );

    expect(event.finalDamage).toBe(Math.round(defender.getMaxHp() * 0.15));
    expect(
      defender.buffs.getAllBuffs().some((buff) => buff.name === '延迟伤害'),
    ).toBe(true);
  });

  it('damage defer creates distinct delayed buffs under the same timestamp', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);
    const attacker = createUnit('attacker');
    const defender = createUnit('defender');
    const createEvent = (): DamageSegmentRequestedEvent => ({
      type: 'DamageSegmentRequestedEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      finalDamage: 100,
      damageType: DamageType.MAGICAL,
    });
    const effect = new DamageDeferEffect({
      ratio: 0.5,
      delayTurns: 2,
    });

    executeTestEffect(effect, {
      caster: defender,
      target: defender,
      triggerEvent: createEvent(),
    });
    executeTestEffect(effect, {
      caster: defender,
      target: defender,
      triggerEvent: createEvent(),
    });

    expect(
      defender.buffs
        .getAllBuffIds()
        .filter((id) => id.startsWith('deferred_damage_')),
    ).toEqual(['deferred_damage_1', 'deferred_damage_2']);
  });

  it('ability lock increases cooldown on the highest-cooldown matching skills and logs it', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const low = AbilityFactory.create({
      slug: 'low_cd',
      name: '低冷却',
      type: AbilityType.ACTIVE_SKILL,
      cooldown: 1,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
        GameplayTags.ABILITY.ELEMENT.FIRE,
      ],
      effects: [
        {
          type: 'damage',
          params: {
            value: {
              base: 10,
              attribute: AttributeType.MAGIC_ATK,
              coefficient: 0,
            },
          },
        },
      ],
    }) as ActiveSkill;
    const high = AbilityFactory.create({
      slug: 'high_cd',
      name: '高冷却',
      type: AbilityType.ACTIVE_SKILL,
      cooldown: 3,
      tags: [
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
        GameplayTags.ABILITY.ELEMENT.THUNDER,
      ],
      effects: [
        {
          type: 'damage',
          params: {
            value: {
              base: 10,
              attribute: AttributeType.MAGIC_ATK,
              coefficient: 0,
            },
          },
        },
      ],
    }) as ActiveSkill;
    target.abilities.addAbility(low);
    target.abilities.addAbility(high);
    const cooldownEvents: CooldownModifyEvent[] = [];
    EventBus.instance.subscribe<CooldownModifyEvent>(
      'CooldownModifyEvent',
      (event) => {
        cooldownEvents.push(event);
      },
    );

    executeTestEffect(new AbilityLockEffect({ rounds: 1, maxCount: 1 }), {
      caster,
      target,
    });

    expect(high.currentCooldown).toBe(1);
    expect(low.currentCooldown).toBe(0);
    expect(cooldownEvents).toHaveLength(1);
    expect(cooldownEvents[0].affectedAbilityName).toBe('高冷却');
  });

  it('hp sacrifice damage emits both mechanic log and damage request', () => {
    const caster = createUnit('caster');
    const target = createUnit('target');
    const mechanics = collectCommittedResultsV3('mechanic');
    const requests: DamageSegmentRequestedEvent[] = [];
    EventBus.instance.subscribe<DamageSegmentRequestedEvent>(
      'DamageSegmentRequestedEvent',
      (event) => {
        requests.push(event);
      },
    );

    executeTestEffect(
      new HpSacrificeDamageEffect({
        hpRatio: 0.1,
        damagePerHp: 2,
      }),
      { caster, target },
    );

    expect(mechanics).toHaveLength(1);
    expect(mechanics[0].result).toMatchObject({
      code: 'hp_sacrifice',
      payload: {
        kind: 'hp_sacrifice',
        amount: Math.round(caster.getMaxHp() * 0.1),
      },
    });
    expect(mechanics[0].target).toBe(caster);
    expect(requests).toHaveLength(1);
    expect(requests[0].baseDamage).toBe(
      Math.round(
        (mechanics[0].result.type === 'mechanic' &&
        mechanics[0].result.payload.kind === 'hp_sacrifice'
          ? mechanics[0].result.payload.amount
          : 0) * 2,
      ),
    );
  });
});
