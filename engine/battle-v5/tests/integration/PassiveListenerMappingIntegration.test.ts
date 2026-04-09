import { EventBus } from '../../core/EventBus';
import { BattleEngineV5 } from '../../BattleEngineV5';
import { GameplayTags } from '../../core/GameplayTags';
import { DamageTakenEvent } from '../../core/types';
import { RoundPreEvent, SkillCastEvent } from '../../core/events';
import { AbilityType, AttributeType, BuffType, ModifierType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { Unit } from '../../units/Unit';

describe('Passive Listener Mapping Integration', () => {
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

  it('round trigger should honor explicit owner->owner mapping', () => {
    const owner = createUnit('owner', '回合修士');
    const enemy = createUnit('enemy', '木桩');

    owner.takeDamage(200);
    const beforeHp = owner.getCurrentHp();

    owner.abilities.addAbility(
      AbilityFactory.create({
        slug: 'passive_round_heal',
        name: '回元息壤',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.TYPE_HEAL],
        listeners: [
          {
            id: 'round_heal_owner_mapping',
            eventType: 'RoundPreEvent',
            scope: 'global',
            priority: 45,
            mapping: {
              caster: 'owner',
              target: 'owner',
            },
            effects: [{ type: 'heal', params: { value: { base: 50 } } }],
          },
        ],
      }),
    );

    EventBus.instance.publish<RoundPreEvent>({
      type: 'RoundPreEvent',
      timestamp: Date.now(),
      turn: 1,
    });

    expect(owner.getCurrentHp()).toBe(beforeHp + 50);
    expect(enemy.getCurrentHp()).toBe(enemy.getMaxHp());
  });

  it('skill cast trigger should honor explicit owner->event.target mapping', () => {
    const caster = createUnit('caster', '施法者');
    const target = createUnit('target', '受术者');

    caster.abilities.addAbility(
      AbilityFactory.create({
        slug: 'passive_apply_mark_on_cast',
        name: '术后留痕',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND_PASSIVE],
        listeners: [
          {
            id: 'cast_apply_mark',
            eventType: 'SkillCastEvent',
            scope: 'owner_as_caster',
            priority: 70,
            mapping: {
              caster: 'owner',
              target: 'event.target',
            },
            effects: [
              {
                type: 'apply_buff',
                params: {
                  buffConfig: {
                    id: 'cast_mark',
                    name: '术后印记',
                    type: BuffType.DEBUFF,
                    duration: 2,
                    stackRule: 'override',
                  },
                },
              },
            ],
          },
        ],
      }),
    );

    const triggerAbility = AbilityFactory.create({
      slug: 'trigger_spell',
      name: '触发术',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.TYPE_DAMAGE, GameplayTags.ABILITY.TYPE_PHYSICAL],
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [
        {
          type: 'damage',
          params: {
            value: {
              base: 1,
              attribute: AttributeType.ATK,
              coefficient: 0,
            },
          },
        },
      ],
    });

    EventBus.instance.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability: triggerAbility,
    });

    expect(target.buffs.getAllBuffIds()).toContain('cast_mark');
    expect(caster.buffs.getAllBuffIds()).not.toContain('cast_mark');
  });

  it('damage taken trigger should honor owner_as_target + event.caster mapping', () => {
    const attacker = createUnit('attacker', '攻击者');
    const defender = createUnit('defender', '受击者');

    defender.abilities.addAbility(
      AbilityFactory.create({
        slug: 'passive_counter_mark',
        name: '受击标记',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND_PASSIVE],
        listeners: [
          {
            id: 'damage_taken_mark_attacker',
            eventType: 'DamageTakenEvent',
            scope: 'owner_as_target',
            priority: 50,
            mapping: {
              caster: 'owner',
              target: 'event.caster',
            },
            guard: {
              requireOwnerAlive: false,
              allowLethalWindow: true,
            },
            effects: [
              {
                type: 'apply_buff',
                params: {
                  buffConfig: {
                    id: 'counter_mark',
                    name: '反击印记',
                    type: BuffType.DEBUFF,
                    duration: 2,
                    stackRule: 'override',
                  },
                },
              },
            ],
          },
        ],
      }),
    );

    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      damageTaken: 120,
      remainHp: defender.getCurrentHp(),
      isLethal: false,
      beforeHp: 0
    });

    expect(attacker.buffs.getAllBuffIds()).toContain('counter_mark');
    expect(defender.buffs.getAllBuffIds()).not.toContain('counter_mark');
  });

  it('mapping-driven cast mark should keep player log as single line', () => {
    const attacker = createUnit('attacker_battle', '破阵者');
    const defender = createUnit('defender_battle', '守阵者');

    attacker.attributes.setBaseValue(AttributeType.SPEED, 1000);
    defender.attributes.setBaseValue(AttributeType.SPEED, 0);
    attacker.updateDerivedStats();
    defender.updateDerivedStats();

    attacker.abilities.addAbility(
      AbilityFactory.create({
        slug: 'passive_cast_mark_log',
        name: '术痕映射',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND_PASSIVE],
        listeners: [
          {
            id: 'cast_mark_log_listener',
            eventType: 'SkillCastEvent',
            scope: 'owner_as_caster',
            priority: 70,
            mapping: {
              caster: 'owner',
              target: 'event.target',
            },
            effects: [
              {
                type: 'apply_buff',
                params: {
                  buffConfig: {
                    id: 'cast_mark_log',
                    name: '术痕印记',
                    type: BuffType.DEBUFF,
                    duration: 2,
                    stackRule: 'override',
                  },
                },
              },
            ],
          },
        ],
      }),
    );

    const engine = new BattleEngineV5(attacker, defender);
    const result = engine.execute();

    console.log(result.logs);
    const targetLog = result.logs.find((log) => log.includes('术痕印记'));
    expect(targetLog).toBeDefined();
    expect(targetLog).not.toContain('\n');
  });

  it('passive modifiers should mount and recycle on activation lifecycle', () => {
    const owner = createUnit('modifier_owner', '器修');

    owner.abilities.addAbility(
      AbilityFactory.create({
        slug: 'passive_equipment_modifier',
        name: '器纹加护',
        type: AbilityType.PASSIVE_SKILL,
        tags: [GameplayTags.ABILITY.KIND_PASSIVE],
        modifiers: [
          {
            attrType: AttributeType.ARMOR_PENETRATION,
            type: ModifierType.FIXED,
            value: 0.2,
          },
          {
            attrType: AttributeType.DEF,
            type: ModifierType.FIXED,
            value: 80,
          },
        ],
      }),
    );

    expect(owner.attributes.getValue(AttributeType.ARMOR_PENETRATION)).toBeCloseTo(0.2);
    expect(owner.attributes.getValue(AttributeType.DEF)).toBeGreaterThan(owner.attributes.getBaseValue(AttributeType.DEF));

    owner.abilities.removeAbility('passive_equipment_modifier');

    expect(owner.attributes.getValue(AttributeType.ARMOR_PENETRATION)).toBeCloseTo(0);
    expect(owner.attributes.getValue(AttributeType.DEF)).toBeCloseTo(owner.attributes.getBaseValue(AttributeType.DEF));
  });
});
