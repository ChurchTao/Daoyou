import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { EventBus } from '../../core/EventBus';
import type { CombatResourceChangeEvent, DamageTakenEvent } from '../../core/events';
import { beginRuntimeAction, setRuntimeRound } from '../../core/runtimeState';
import { AbilityType, AttributeType, DamageSource } from '../../core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { Unit } from '../../units/Unit';

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 10,
    [AttributeType.SPIRIT]: 10,
    [AttributeType.WISDOM]: 10,
    [AttributeType.SPEED]: 10,
    [AttributeType.WILLPOWER]: 10,
  });
}

describe('battle runtime primitives', () => {
  beforeEach(() => EventBus.instance.reset());
  afterEach(() => EventBus.instance.reset());

  it('publishes requested, applied and overflow for combat resource changes', () => {
    const owner = unit('owner');
    owner.combatResources.define({ id: 'focus', name: '专注', initial: 5, max: 6 });
    const events: CombatResourceChangeEvent[] = [];
    EventBus.instance.subscribe<CombatResourceChangeEvent>(
      'CombatResourceChangeEvent',
      (event) => events.push(event),
    );

    owner.combatResources.modify('focus', 3);

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
    owner.combatResources.define({ id: 'guard', name: '守势', initial: 0, max: 6 });
    owner.abilities.addAbility(AbilityFactory.create({
      slug: 'round-budget-passive',
      name: '回合预算',
      type: AbilityType.PASSIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.PASSIVE],
      listeners: [{
        id: 'round-budget-listener',
        eventType: 'DamageTakenEvent',
        scope: 'owner_as_target',
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        budget: { maxTriggers: 1, reset: 'round' },
        effects: [{
          type: 'combat_resource_modify',
          params: { resourceId: 'guard', operation: 'add', amount: 1 },
        }],
      }],
    }));
    const publishDamage = () => EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: owner,
      damageSource: DamageSource.DIRECT,
      damageTaken: 1,
      beforeHp: owner.getCurrentHp(),
      remainHp: owner.getCurrentHp(),
      isLethal: false,
    });

    setRuntimeRound(owner, 1);
    publishDamage();
    publishDamage();
    expect(owner.combatResources.getCurrent('guard')).toBe(1);

    setRuntimeRound(owner, 2);
    publishDamage();
    expect(owner.combatResources.getCurrent('guard')).toBe(2);
  });

  it('resets action-scoped listener budgets when the owner starts a new action', () => {
    const owner = unit('owner');
    const attacker = unit('attacker');
    owner.combatResources.define({ id: 'tempo', name: '节奏', initial: 0, max: 6 });
    owner.abilities.addAbility(AbilityFactory.create({
      slug: 'action-budget-passive',
      name: '行动预算',
      type: AbilityType.PASSIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.PASSIVE],
      listeners: [{
        id: 'action-budget-listener',
        eventType: 'DamageTakenEvent',
        scope: 'owner_as_target',
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        budget: { maxTriggers: 1, reset: 'action' },
        effects: [{ type: 'combat_resource_modify', params: { resourceId: 'tempo', operation: 'add', amount: 1 } }],
      }],
    }));
    const publishDamage = () => EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent', timestamp: Date.now(), caster: attacker, target: owner,
      damageSource: DamageSource.DIRECT, damageTaken: 1,
      beforeHp: owner.getCurrentHp(), remainHp: owner.getCurrentHp(), isLethal: false,
    });

    beginRuntimeAction(owner);
    publishDamage();
    publishDamage();
    beginRuntimeAction(owner);
    publishDamage();

    expect(owner.combatResources.getCurrent('tempo')).toBe(2);
  });

  it('modifies, caps and releases generic runtime counters', () => {
    const owner = unit('owner');
    owner.combatResources.define({ id: 'focus', name: '专注', initial: 5, max: 6 });
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
        effects: [{
          type: 'combat_resource_modify',
          params: { resourceId: 'focus', operation: 'add', amount: 1 },
        }],
      },
    });
    let changeEvent: CombatResourceChangeEvent | undefined;
    EventBus.instance.subscribe<CombatResourceChangeEvent>(
      'CombatResourceChangeEvent',
      (event) => { changeEvent = event; },
    );

    owner.combatResources.modify('focus', 3);
    recordOverflow?.execute({ ...context, triggerEvent: changeEvent });
    owner.combatResources.consume('focus', 'all');
    release?.execute(context);

    expect(owner.combatResources.getCurrent('focus')).toBe(2);
  });
});
