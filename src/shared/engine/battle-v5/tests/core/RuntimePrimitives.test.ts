import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import type {
  CombatResourceChangeEvent,
  DamageSegmentAppliedEvent,
} from '../../core/events';
import { beginRuntimeAction, getBattleRuntimeState, setRuntimeRound } from '../../core/runtimeState';
import { AbilityType, AttributeType, DamageSource } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { Unit } from '../../units/Unit';
import { executeTestEffect } from '../setup/executeTestEffect';
import { createHitResolution } from '../../core/resolution';

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 10,
    [AttributeType.SPIRIT]: 10,
    [AttributeType.ENDURANCE]: 10,
    [AttributeType.SPEED]: 10,
    [AttributeType.WILLPOWER]: 10,
  });
}

describe('battle runtime primitives', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it('publishes requested, applied and overflow for combat resource changes', () => {
    const owner = unit('owner');
    owner.combatResources.define({
      id: 'focus',
      name: '专注',
      initial: 5,
      max: 6,
    });
    const events: CombatResourceChangeEvent[] = [];
    EventBus.instance.subscribe<CombatResourceChangeEvent>(
      'CombatResourceChangeEvent',
      (event) => events.push(event),
    );

    executeTestEffect(
      AbilityFactory.createEffect({
        type: 'combat_resource_modify',
        params: { resourceId: 'focus', operation: 'add', amount: 3 },
      }),
      { caster: owner, target: owner },
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      target: owner,
      resourceId: 'focus',
      requested: 3,
      applied: 1,
      overflow: 2,
      before: 5,
      after: 6,
    });
  });

  it('limits listeners by round and resets the budget on the next round', () => {
    const owner = unit('owner');
    const attacker = unit('attacker');
    owner.combatResources.define({
      id: 'guard',
      name: '守势',
      initial: 0,
      max: 6,
    });
    owner.abilities.addAbility(
      AbilityFactory.create({
        slug: 'round-budget-passive',
        name: '回合预算',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.PASSIVE],
        listeners: [
          {
            id: 'round-budget-listener',
            eventType: 'DamageSegmentAppliedEvent',
            scope: 'owner_as_target',
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            triggerPolicy: { maxTriggers: 1, granularity: 'round' },
            effects: [
              {
                type: 'combat_resource_modify',
                params: { resourceId: 'guard', operation: 'add', amount: 1 },
              },
            ],
          },
        ],
      }),
    );
    const publishDamage = () =>
      EventBus.instance.publish<DamageSegmentAppliedEvent>({
        type: 'DamageSegmentAppliedEvent',
        timestamp: Date.now(),
        caster: attacker,
        target: owner,
        resolution: createHitResolution({
          actionId: `${owner.id}:tempo-action:${getBattleRuntimeState(owner).actionSequence}`,
          castId: 'runtime:tempo-cast',
          caster: attacker,
          target: owner,
        }),
        damageSource: DamageSource.DIRECT,
        damageTaken: 1,
        beforeHp: owner.getCurrentHp(),
        remainHp: owner.getCurrentHp(),
        hpReachedZeroBeforeReactions: false,
      });

    setRuntimeRound(owner, 1);
    publishDamage();
    publishDamage();
    expect(owner.combatResources.getCurrent('guard')).toBe(1);

    setRuntimeRound(owner, 2);
    publishDamage();
    expect(owner.combatResources.getCurrent('guard')).toBe(2);
  });

  it('shares a budget group without reusing listener IDs', () => {
    const owner = unit('owner');
    const attacker = unit('attacker');
    owner.combatResources.define({
      id: 'guard',
      name: '守势',
      initial: 0,
      max: 6,
    });
    const sharedBudget = {
      maxTriggers: 1,
      granularity: 'round' as const,
      group: 'shared-control-response',
    };
    owner.abilities.addAbility(
      AbilityFactory.create({
        slug: 'group-budget-passive',
        name: '共享预算',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.PASSIVE],
        listeners: ['first', 'second'].map((suffix) => ({
          id: `group-budget-listener-${suffix}`,
          eventType: 'DamageSegmentAppliedEvent',
          scope: 'owner_as_target' as const,
          priority: 0,
          mapping: { caster: 'owner' as const, target: 'owner' as const },
          triggerPolicy: sharedBudget,
          effects: [
            {
              type: 'combat_resource_modify' as const,
              params: {
                resourceId: 'guard',
                operation: 'add' as const,
                amount: 1,
              },
            },
          ],
        })),
      }),
    );

    setRuntimeRound(owner, 1);
    EventBus.instance.publish<DamageSegmentAppliedEvent>({
      type: 'DamageSegmentAppliedEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: owner,
      damageSource: DamageSource.DIRECT,
      damageTaken: 1,
      beforeHp: owner.getCurrentHp(),
      remainHp: owner.getCurrentHp(),
      hpReachedZeroBeforeReactions: false,
    });

    expect(owner.combatResources.getCurrent('guard')).toBe(1);
  });

  it('resets action-scoped listener budgets when the owner starts a new action', () => {
    const owner = unit('owner');
    const attacker = unit('attacker');
    owner.combatResources.define({
      id: 'tempo',
      name: '节奏',
      initial: 0,
      max: 6,
    });
    owner.abilities.addAbility(
      AbilityFactory.create({
        slug: 'action-budget-passive',
        name: '行动预算',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.PASSIVE],
        listeners: [
          {
            id: 'action-budget-listener',
            eventType: 'DamageSegmentAppliedEvent',
            scope: 'owner_as_target',
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            triggerPolicy: { maxTriggers: 1, granularity: 'action' },
            effects: [
              {
                type: 'combat_resource_modify',
                params: { resourceId: 'tempo', operation: 'add', amount: 1 },
              },
            ],
          },
        ],
      }),
    );
    const publishDamage = () =>
      EventBus.instance.publish<DamageSegmentAppliedEvent>({
        type: 'DamageSegmentAppliedEvent',
        timestamp: Date.now(),
        caster: attacker,
        target: owner,
        resolution: createHitResolution({
          actionId: `${owner.id}:tempo-action:${getBattleRuntimeState(owner).actionSequence}`,
          castId: 'runtime:tempo-cast',
          caster: attacker,
          target: owner,
        }),
        damageSource: DamageSource.DIRECT,
        damageTaken: 1,
        beforeHp: owner.getCurrentHp(),
        remainHp: owner.getCurrentHp(),
        hpReachedZeroBeforeReactions: false,
      });

    beginRuntimeAction(owner);
    publishDamage();
    publishDamage();
    beginRuntimeAction(owner);
    publishDamage();

    expect(owner.combatResources.getCurrent('tempo')).toBe(2);
  });

  it('can scope a listener budget to the enemy source action', () => {
    const owner = unit('owner');
    const attacker = unit('attacker');
    owner.combatResources.define({
      id: 'karma',
      name: '业痕',
      initial: 0,
      max: 6,
    });
    owner.abilities.addAbility(
      AbilityFactory.create({
        slug: 'source-action-passive',
        name: '敌方行动预算',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND.PASSIVE],
        listeners: [
          {
            id: 'source-action-listener',
            eventType: 'DamageSegmentAppliedEvent',
            scope: 'owner_as_target',
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            triggerPolicy: { maxTriggers: 1, granularity: 'action' },
            effects: [
              {
                type: 'combat_resource_modify',
                params: { resourceId: 'karma', operation: 'add', amount: 1 },
              },
            ],
          },
        ],
      }),
    );
    const hit = () =>
      EventBus.instance.publish<DamageSegmentAppliedEvent>({
        type: 'DamageSegmentAppliedEvent',
        timestamp: Date.now(),
        caster: attacker,
        target: owner,
        resolution: createHitResolution({
          actionId: `${attacker.id}:karma-action:${getBattleRuntimeState(attacker).actionSequence}`,
          castId: 'runtime:karma-cast',
          caster: attacker,
          target: owner,
        }),
        damageSource: DamageSource.DIRECT,
        damageTaken: 1,
        beforeHp: owner.getCurrentHp(),
        remainHp: owner.getCurrentHp(),
        hpReachedZeroBeforeReactions: false,
      });

    beginRuntimeAction(attacker);
    hit();
    hit();
    beginRuntimeAction(attacker);
    hit();
    expect(owner.combatResources.getCurrent('karma')).toBe(2);
  });

  it('modifies, caps and releases generic runtime counters', () => {
    const owner = unit('owner');
    owner.combatResources.define({
      id: 'focus',
      name: '专注',
      initial: 5,
      max: 6,
    });
    const context = { caster: owner, target: owner };
    const recordOverflow = AbilityFactory.createEffect({
      type: 'runtime_counter_modify',
      params: {
        key: 'stored-overflow',
        operation: 'add',
        amountFromEvent: 'overflow',
        max: 2,
      },
    });
    const release = AbilityFactory.createEffect({
      type: 'runtime_counter_modify',
      params: {
        key: 'stored-overflow',
        operation: 'reset',
        scaleEffectsByAmount: true,
        effects: [
          {
            type: 'combat_resource_modify',
            params: { resourceId: 'focus', operation: 'add', amount: 1 },
          },
        ],
      },
    });
    let changeEvent: CombatResourceChangeEvent | undefined;
    EventBus.instance.subscribe<CombatResourceChangeEvent>(
      'CombatResourceChangeEvent',
      (event) => {
        changeEvent = event;
      },
    );

    executeTestEffect(
      AbilityFactory.createEffect({
        type: 'combat_resource_modify',
        params: { resourceId: 'focus', operation: 'add', amount: 3 },
      }),
      context,
    );
    executeTestEffect(recordOverflow, {
      ...context,
      triggerEvent: changeEvent,
    });
    owner.combatResources.set('focus', 0);
    executeTestEffect(release, context);

    expect(owner.combatResources.getCurrent('focus')).toBe(2);
  });
});
