import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { composeProductFromAffixIds } from '@shared/engine/creation-v2/composeProductFromAffixIds';
import { projectAbilityConfig } from '@shared/engine/creation-v2/models/AbilityProjection';
import { EventBus } from '@shared/engine/battle-v5/core/EventBus';
import type {
  DamageRequestEvent,
  DeathPreventEvent,
  UnitDeadEvent,
} from '@shared/engine/battle-v5/core/events';
import {
  AttributeType,
  DamageSource,
  DamageType,
} from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { DamageSystem } from '@shared/engine/battle-v5/systems/DamageSystem';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { getBodyCultivationBattleInitHooks } from '@shared/lib/bodyCultivation/effects';
import type { CultivatorCondition } from '@shared/types/condition';

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
      [AttributeType.WISDOM]: 100,
    });
  }

  function createJadeMarrowCondition(): CultivatorCondition {
    return {
      version: 1,
      resources: {
        hp: { current: 100 },
        mp: { current: 100 },
      },
      gauges: {
        pillToxicity: 0,
      },
      tracks: {
        bodyCultivation: {
          version: 1,
          realm: 'jade_marrow',
          tracks: {
            skin: { level: 0, progress: 0 },
            sinew_bone: { level: 12, progress: 0 },
            organs: { level: 0, progress: 0 },
            qi_blood: { level: 10, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
        tempering: {
          vitality: { level: 0, progress: 0 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 0 },
      },
      counters: {
        longTermPillUsesByRealm: {},
        cultivationPillUsesByRealm: {},
        longevityPillUsesByRealm: {},
      },
      statuses: [],
      timestamps: {},
    };
  }

  function dealLethalDamage(attacker: Unit, defender: Unit): void {
    EventBus.instance.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
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
    let deathEvent: UnitDeadEvent | undefined;

    EventBus.instance.subscribe<UnitDeadEvent>('UnitDeadEvent', (event) => {
      deathEvent = event;
    });

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
    expect(deathEvent).toBeUndefined();
    expect(
      EventBus.instance
        .getEventHistory()
        .some((event) => event.type === 'DeathPreventEvent'),
    ).toBe(true);

    damageSystem.destroy();
  });

  it('替身纸人与玉髓不灭骨应按不同来源分别触发', () => {
    const attacker = createUnit('attacker', '破阵者');
    const defender = createUnit('defender', '持符者');
    const damageSystem = new DamageSystem();
    const deathPreventEvents: DeathPreventEvent[] = [];

    EventBus.instance.subscribe<DeathPreventEvent>(
      'DeathPreventEvent',
      (event) => deathPreventEvents.push(event),
    );

    const artifact = composeProductFromAffixIds({
      productType: 'artifact',
      element: '金',
      name: '替身甲',
      requestedSlot: 'armor',
      affixIds: ['artifact-defense-death-prevent'],
    });
    defender.abilities.addAbility(AbilityFactory.create(projectAbilityConfig(artifact)));

    const jadeMarrowBuff = getBodyCultivationBattleInitHooks(
      createJadeMarrowCondition(),
    ).startingBuffs.find(
      (buff) => buff.id === 'body_cultivation_jade_marrow_death_prevent',
    );
    expect(jadeMarrowBuff).toBeDefined();
    defender.buffs.addBuff(BuffFactory.create(jadeMarrowBuff!), defender);

    dealLethalDamage(attacker, defender);
    expect(defender.isAlive()).toBe(true);
    expect(deathPreventEvents.map((event) => event.sourceKey)).toEqual([
      'artifact-defense-death-prevent',
    ]);

    dealLethalDamage(attacker, defender);
    expect(defender.isAlive()).toBe(true);
    expect(deathPreventEvents.map((event) => event.sourceKey)).toEqual([
      'artifact-defense-death-prevent',
      'body_cultivation_jade_marrow_death_prevent',
    ]);

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
