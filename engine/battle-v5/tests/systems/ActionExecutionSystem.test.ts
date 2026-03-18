// engine/battle-v5/tests/systems/ActionExecutionSystem.test.ts
import { ActionExecutionSystem } from '../../systems/ActionExecutionSystem';
import { Unit } from '../../units/Unit';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityType } from '../../core/types';
import { GameplayTags } from '../../core/GameplayTags';
import { EventBus } from '../../core/EventBus';
import { SkillPreCastEvent, SkillCastEvent, SkillInterruptEvent } from '../../core/events';

// Test implementation of ActiveSkill
class TestActiveSkill extends ActiveSkill {
  private executeCallback?: (caster: Unit, target: Unit) => void;

  constructor(id: string, name: string, mpCost: number = 0, cooldown: number = 0) {
    super(id, name, mpCost, cooldown);
  }

  setExecuteCallback(callback: (caster: Unit, target: Unit) => void): void {
    this.executeCallback = callback;
  }

  protected executeSkill(caster: Unit, target: Unit): void {
    if (this.executeCallback) {
      this.executeCallback(caster, target);
    }
  }

  // Override execute to call executeSkill
  execute(context: { caster: Unit; target: Unit }): void {
    this.executeSkill(context.caster, context.target);
  }
}

describe('ActionExecutionSystem', () => {
  let system: ActionExecutionSystem;
  let caster: Unit;
  let target: Unit;
  let skill: TestActiveSkill;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    system = new ActionExecutionSystem();

    caster = new Unit('caster', '施法者', { spirit: 100 });
    target = new Unit('target', '目标', { physique: 100 });
    skill = new TestActiveSkill('fireball', '火球术', 10, 0);
    skill.setDamageCoefficient(1.5);
    skill.setBaseDamage(50);
    skill.tags.addTags([GameplayTags.ABILITY.TYPE_MAGIC]);
  });

  afterEach(() => {
    eventBus.reset();
  });

  it('should handle skill pre-cast event and publish cast event if not interrupted', () => {
    const castEventSpy = jest.fn();
    eventBus.subscribe<SkillCastEvent>('SkillCastEvent', castEventSpy);

    eventBus.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: 75,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: false,
    });

    expect(castEventSpy).toHaveBeenCalled();
  });

  it('should not publish cast event if skill is interrupted', () => {
    const castEventSpy = jest.fn();
    eventBus.subscribe<SkillCastEvent>('SkillCastEvent', castEventSpy);

    eventBus.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: 75,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: true,
    });

    expect(castEventSpy).not.toHaveBeenCalled();
  });

  it('should publish interrupt event when skill is interrupted', () => {
    const interruptEventSpy = jest.fn();
    eventBus.subscribe<SkillInterruptEvent>('SkillInterruptEvent', interruptEventSpy);

    eventBus.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: 75,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: true,
    });

    expect(interruptEventSpy).toHaveBeenCalled();
    const interruptEvent = interruptEventSpy.mock.calls[0][0] as SkillInterruptEvent;
    expect(interruptEvent.reason).toBe('施法被打断');
  });

  it('should execute skill when not interrupted', () => {
    const executeSpy = jest.fn();
    skill.setExecuteCallback(executeSpy);

    eventBus.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: 75,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: false,
    });

    expect(executeSpy).toHaveBeenCalledWith(caster, target);
  });

  it('should not execute skill when interrupted', () => {
    const executeSpy = jest.fn();
    skill.setExecuteCallback(executeSpy);

    eventBus.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: 75,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: true,
    });

    expect(executeSpy).not.toHaveBeenCalled();
  });
});
