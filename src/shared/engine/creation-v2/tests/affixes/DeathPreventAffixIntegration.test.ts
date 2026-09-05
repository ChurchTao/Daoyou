import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { composeProductFromAffixIds } from '@shared/engine/creation-v2/composeProductFromAffixIds';
import { projectAbilityConfig } from '@shared/engine/creation-v2/models/AbilityProjection';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type {
  DamageSegmentRequestedEvent,
  DeathPreventEvent,
} from '@shared/engine/battle-v5/core/events';
import {
  AttributeType,
  DamageSource,
  DamageType,
} from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { DamageSystem } from '@shared/engine/battle-v5/systems/DamageSystem';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { publishTestDamageRequest } from '@shared/engine/battle-v5/tests/setup/combatV3TestHarness';

describe('death_prevent artifact affix integration', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  afterEach(() => {
    EventBus.instance.reset();
  });

  function createUnit(id: string, name: string): Unit {
    return new Unit(id, name, {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.VITALITY]: 100,
      [AttributeType.SPEED]: 100,
      [AttributeType.WILLPOWER]: 100,
      [AttributeType.ENDURANCE]: 100,
    });
  }

  function dealLethalDamage(attacker: Unit, defender: Unit): void {
    publishTestDamageRequest({
      type: 'DamageSegmentRequestedEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      baseDamage: 1_000_000,
      finalDamage: 1_000_000,
    });
  }

  it('替身纸人投影的 death_prevent 应在致命受击窗口触发', () => {
    const attacker = createUnit('attacker', '破阵者');
    const defender = createUnit('defender', '持符者');
    const damageSystem = new DamageSystem();

    const artifact = composeProductFromAffixIds({
      productType: 'artifact',
      element: '金',
      name: '替身甲',
      requestedSlot: 'armor',
      affixIds: ['artifact-defense-death-prevent'],
    });
    const abilityConfig = projectAbilityConfig(artifact);

    expect(abilityConfig.listeners?.[0]?.guard).toMatchObject({
      allowLethalWindow: true,
    });
    expect(abilityConfig.listeners?.[0]?.effects[0]).toMatchObject({
      type: 'death_prevent',
      params: { triggerKey: 'artifact-defense-death-prevent' },
    });

    defender.abilities.addAbility(AbilityFactory.create(abilityConfig));

    dealLethalDamage(attacker, defender);

    expect(defender.getCurrentHp()).toBe(1);
    expect(defender.isAlive()).toBe(true);
    expect(
      EventBus.instance
        .getEventHistory()
        .some((event) => event.type === 'DeathPreventEvent'),
    ).toBe(true);

    damageSystem.destroy();
  });

  it('effect_sequence 内嵌 death_prevent 应继承词条来源 key', () => {
    const attacker = createUnit('attacker', '破阵者');
    const defender = createUnit('defender', '持币者');
    const damageSystem = new DamageSystem();
    const deathPreventEvents: DeathPreventEvent[] = [];

    EventBus.instance.subscribe<DeathPreventEvent>(
      'DeathPreventEvent',
      (event) => deathPreventEvents.push(event),
    );

    const artifact = composeProductFromAffixIds({
      productType: 'artifact',
      element: '金',
      name: '替劫坠',
      requestedSlot: 'accessory',
      affixIds: ['artifact-treasure-calamity-coin'],
    });
    const abilityConfig = projectAbilityConfig(artifact);
    expect(abilityConfig.listeners?.[0]?.guard).toMatchObject({
      allowLethalWindow: true,
    });

    const sequence = abilityConfig.listeners?.[0]?.effects.find(
      (effect) => effect.type === 'effect_sequence',
    );

    expect(sequence).toBeDefined();
    if (sequence?.type !== 'effect_sequence') {
      throw new Error('Expected effect_sequence');
    }

    expect(sequence.params.effects[0]).toMatchObject({
      type: 'death_prevent',
      params: { triggerKey: 'artifact-treasure-calamity-coin' },
    });

    defender.abilities.addAbility(AbilityFactory.create(abilityConfig));
    dealLethalDamage(attacker, defender);

    expect(defender.isAlive()).toBe(true);
    expect(deathPreventEvents.map((event) => event.sourceKey)).toEqual([
      'artifact-treasure-calamity-coin',
    ]);

    damageSystem.destroy();
  });
});
