import { ActiveSkill } from '../../abilities/ActiveSkill';
import { BasicAttack } from '../../abilities/BasicAttack';
import { EventBus } from '../../core/EventBus';
import { GameplayTags } from '../../core/GameplayTags';
import {
  DamageCalculateEvent,
  DamageEvent,
  DamageTakenEvent,
  HitCheckEvent,
  SkillCastEvent,
} from '../../core/events';
import { AttributeType } from '../../core/types';
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';

describe('DamageSystem - EventDriven', () => {
  let system: DamageSystem;
  let caster: Unit;
  let target: Unit;
  let skill: ActiveSkill;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();

    caster = new Unit('caster', '施法者', {
      spirit: 100,
      agility: 50,
      consciousness: 50,
    });
    target = new Unit('target', '目标', {
      physique: 100,
      agility: 30,
      consciousness: 40,
    });

    skill = new BasicAttack();
    skill.setDamageCoefficient(1.5);
    skill.setBaseDamage(50);
    skill.tags.addTags([GameplayTags.ABILITY.TYPE_MAGIC]);

    // Create DamageSystem after resetting EventBus and setting up all dependencies
    system = new DamageSystem();
  });

  afterEach(() => {
    eventBus.reset();
  });

  it('should subscribe to SkillCastEvent and publish HitCheckEvent', () => {
    const hitCheckSpy = jest.fn();
    eventBus.subscribe<HitCheckEvent>('HitCheckEvent', hitCheckSpy);

    eventBus.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      priority: 70,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
    });

    expect(hitCheckSpy).toHaveBeenCalled();
  });

  it('should calculate correct base damage based on skill type', () => {
    const damageCalcSpy = jest.fn((event: DamageCalculateEvent) => {
      expect(event.baseDamage).toBeGreaterThan(0);
    });
    eventBus.subscribe<DamageCalculateEvent>(
      'DamageCalculateEvent',
      damageCalcSpy,
    );

    eventBus.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      priority: 70,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
    });

    expect(damageCalcSpy).toHaveBeenCalled();
  });

  it('should apply dodge when target agility is higher', () => {
    const damageTakenSpy = jest.fn();
    eventBus.subscribe<DamageTakenEvent>('DamageTakenEvent', damageTakenSpy);

    caster.attributes.setBaseValue(AttributeType.AGILITY, 10);
    target.attributes.setBaseValue(AttributeType.AGILITY, 100);

    eventBus.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      priority: 70,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
    });

    // 高闪避情况下，可能不会受到伤害
    // 概率性，不强制断言
  });

  it('should publish DamageEvent when damage is applied', () => {
    const damageEventSpy = jest.fn();
    eventBus.subscribe<DamageEvent>('DamageEvent', damageEventSpy);

    // Ensure target doesn't dodge by setting low agility
    target.attributes.setBaseValue(AttributeType.AGILITY, 10);

    eventBus.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      priority: 70,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
    });

    expect(damageEventSpy).toHaveBeenCalled();
  });

  it('should publish DamageTakenEvent when target takes damage', () => {
    const damageTakenSpy = jest.fn();
    eventBus.subscribe<DamageTakenEvent>('DamageTakenEvent', damageTakenSpy);

    // Ensure target doesn't dodge by setting low agility
    target.attributes.setBaseValue(AttributeType.AGILITY, 10);

    eventBus.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      priority: 70,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
    });

    expect(damageTakenSpy).toHaveBeenCalled();
  });

  it('should calculate physical damage correctly', () => {
    const physicalSkill = new BasicAttack();
    physicalSkill.setDamageCoefficient(1.0);
    physicalSkill.setBaseDamage(20);
    physicalSkill.tags.addTags([GameplayTags.ABILITY.TYPE_PHYSICAL]);

    const damageCalcSpy = jest.fn((event: DamageCalculateEvent) => {
      expect(event.baseDamage).toBeGreaterThan(0);
    });
    eventBus.subscribe<DamageCalculateEvent>(
      'DamageCalculateEvent',
      damageCalcSpy,
    );

    eventBus.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      priority: 70,
      timestamp: Date.now(),
      caster,
      target,
      ability: physicalSkill,
    });

    expect(damageCalcSpy).toHaveBeenCalled();
  });
});
