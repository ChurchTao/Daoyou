import { DataDrivenActiveSkill } from '../../abilities/DataDrivenActiveSkill';
import { AbilityConfig } from '../../core/configs';
import { EventBus } from '../../core/EventBus';
import { SkillPreCastEvent } from '../../core/events';
import { AbilityType, AttributeType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { ActionExecutionSystem } from '../../systems/ActionExecutionSystem';
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';

describe('Ability V5 Interception Pattern', () => {
  let caster: Unit;
  let target: Unit;
  let damageSystem: DamageSystem;
  let actionSystem: ActionExecutionSystem;

  beforeEach(() => {
    EventBus.instance.reset();
    damageSystem = new DamageSystem();
    actionSystem = new ActionExecutionSystem();

    caster = new Unit('caster', '施法者', {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.PHYSIQUE]: 100,
      [AttributeType.AGILITY]: 10, // 低身法
    });

    target = new Unit('target', '目标', {
      [AttributeType.PHYSIQUE]: 50,
      [AttributeType.AGILITY]: 500, // 高身法，确保护发闪避
    });
  });

  afterEach(() => {
    actionSystem.destroy();
    damageSystem.destroy();
  });

  it('拦截模式：当命中判定失败时，应该彻底拦截效果链执行', () => {
    const config: AbilityConfig = {
      slug: 'fireball',
      name: '火球术',
      type: AbilityType.ACTIVE_SKILL,
      effects: [
        {
          type: 'damage',
          params: { baseValue: 100 },
        },
      ],
    };

    const skill = AbilityFactory.create(config) as DataDrivenActiveSkill;

    // 这种测试方式比较巧妙：通过 spy 观察 executeSkill 是否被调用
    const spy = jest.spyOn(skill as any, 'executeSkill');

    // 触发流程
    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: 75,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: false,
    });

    // 验证：由于 target 身法极高，应该触发闪避
    // 闪避后，ActionExecutionSystem 应该拦截，executeSkill 不会被执行
    expect(spy).not.toHaveBeenCalled();

    // 验证没有产生任何伤害记录
    const history = EventBus.instance.getEventHistory();
    const damageEvents = history.filter((e) => e.type === 'DamageTakenEvent');
    expect(damageEvents.length).toBe(0);
  });

  it('拦截模式：当命中判定成功时，应该正常执行效果链', () => {
    // 让目标身法变低，确保必中
    target.attributes.setBaseValue(AttributeType.AGILITY, 1);

    const config: AbilityConfig = {
      slug: 'sure_hit',
      name: '必中术',
      type: AbilityType.ACTIVE_SKILL,
      effects: [
        {
          type: 'damage',
          params: { baseValue: 100 },
        },
      ],
    };

    const skill = AbilityFactory.create(config) as DataDrivenActiveSkill;
    const spy = jest.spyOn(skill as any, 'executeSkill');

    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: 75,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: false,
    });

    expect(spy).toHaveBeenCalled();

    // 验证产生了伤害记录
    const history = EventBus.instance.getEventHistory();
    const damageEvents = history.filter((e) => e.type === 'DamageTakenEvent');
    expect(damageEvents.length).toBeGreaterThan(0);
  });
});
