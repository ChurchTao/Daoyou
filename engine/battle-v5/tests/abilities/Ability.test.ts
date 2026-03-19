import { Ability } from '../../abilities/Ability';
import { ActiveSkill, ActiveSkillConfig } from '../../abilities/ActiveSkill';
import { AbilityType } from '../../core/types';
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { GameplayTags } from '../../core/GameplayTags';
import { FireballSkill } from '../../abilities/examples/FireballSkill';

/**
 * 测试用的具体 ActiveSkill 实现
 */
class TestActiveSkillImpl extends ActiveSkill {
  constructor(id: string, name: string, config?: ActiveSkillConfig) {
    super(id as any, name, config);
  }
  protected executeSkill(_caster: Unit, _target: Unit): void {
    // 测试用空实现
  }
}

describe('Ability', () => {
  let unit: Unit;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    unit = new Unit('test_unit', '测试单位', {
      [AttributeType.SPIRIT]: 50,
    });
  });

  describe('基础功能', () => {
    it('应该正确初始化能力', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.ACTIVE_SKILL);
      expect(ability.id).toBe('test_ability');
      expect(ability.name).toBe('测试能力');
      expect(ability.type).toBe(AbilityType.ACTIVE_SKILL);
      expect(ability.isActive()).toBe(false);
    });

    it('应该支持激活和停用', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.ACTIVE_SKILL);
      ability.setOwner(unit);
      ability.setActive(true);
      expect(ability.isActive()).toBe(true);

      ability.setActive(false);
      expect(ability.isActive()).toBe(false);
    });
  });

  describe('事件订阅', () => {
    it('激活时应该订阅事件', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.PASSIVE_SKILL);
      ability.setOwner(unit);

      let eventReceived = false;
      ability.onActivate = () => {
        eventReceived = true;
      };

      ability.setActive(true);
      expect(eventReceived).toBe(true);
    });

    it('停用时应该取消订阅事件', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.PASSIVE_SKILL);
      ability.setOwner(unit);

      let deactivated = false;
      ability.onDeactivate = () => {
        deactivated = true;
      };

      ability.setActive(true);
      ability.setActive(false);
      expect(deactivated).toBe(true);
    });
  });

  describe('触发条件检查', () => {
    it('默认情况下总是可以触发', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.ACTIVE_SKILL);
      ability.setOwner(unit);
      const context = { caster: unit, target: unit };
      expect(ability.canTrigger(context)).toBe(true);
    });
  });

  describe('Ability 标签系统', () => {
    it('新建 Ability 应有空的标签容器', () => {
      const ability = new Ability('test', '测试', AbilityType.ACTIVE_SKILL);

      expect(ability.tags).toBeDefined();
      expect(ability.tags.getTags()).toEqual([]);
    });

    it('应支持设置自定义标签', () => {
      const ability = new Ability('test', '测试', AbilityType.ACTIVE_SKILL);
      ability.tags.addTags([GameplayTags.ABILITY.TYPE_MAGIC]);

      expect(ability.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)).toBe(true);
    });

    it('FireballSkill 应正确设置火属性标签', () => {
      const skill = new FireballSkill();

      expect(skill.tags.hasTag(GameplayTags.ABILITY.ELEMENT_FIRE)).toBe(true);
      expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)).toBe(true);
      expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_DAMAGE)).toBe(true);
    });
  });

  describe('canTrigger 应使用 owner 或 context.caster', () => {
    it('无 owner 时应使用 context.caster', () => {
      const ability = new Ability('test', '测试', AbilityType.ACTIVE_SKILL);

      const context = {
        caster: unit,
        target: unit,
      };

      // No owner set, but context.caster is available (new behavior)
      expect(ability.canTrigger(context)).toBe(true);

      // Without context.caster, should return false
      const emptyContext = { caster: null as unknown as Unit, target: unit };
      expect(ability.canTrigger(emptyContext)).toBe(false);

      // With owner set, should work regardless of context.caster
      const ability2 = new Ability('test2', '测试2', AbilityType.ACTIVE_SKILL);
      ability2.setOwner(unit);
      expect(ability2.canTrigger(context)).toBe(true);
    });
  });
});

describe('ActiveSkill', () => {
  let unit: Unit;

  beforeEach(() => {
    unit = new Unit('test_unit', '测试单位', {
      [AttributeType.SPIRIT]: 50,
    });
  });

  describe('冷却管理', () => {
    it('应该支持冷却时间', () => {
      const skill = new TestActiveSkillImpl('test_skill', '测试技能', { cooldown: 3 });
      expect(skill.getCurrentCooldown()).toBe(0);

      skill.startCooldown();
      expect(skill.getCurrentCooldown()).toBe(3);

      skill.tickCooldown();
      expect(skill.getCurrentCooldown()).toBe(2);

      skill.tickCooldown();
      skill.tickCooldown();
      expect(skill.getCurrentCooldown()).toBe(0);
      expect(skill.isReady()).toBe(true);
    });
  });

  describe('ActiveSkill 扩展属性', () => {
    it('should support damage coefficient property', () => {
      const skill = new TestActiveSkillImpl('test', '测试');
      skill.setDamageCoefficient(1.5);
      expect(skill.damageCoefficient).toBe(1.5);
    });

    it('should support base damage property', () => {
      const skill = new TestActiveSkillImpl('test', '测试');
      skill.setBaseDamage(100);
      expect(skill.baseDamage).toBe(100);
    });

    it('should support priority property', () => {
      const skill = new TestActiveSkillImpl('test', '测试');
      skill.setPriority(5);
      expect(skill.priority).toBe(5);
    });

    it('should support mana cost property', () => {
      const skill = new TestActiveSkillImpl('test', '测试', { mpCost: 50 });
      expect(skill.manaCost).toBe(50);
    });

    it('canTrigger should check mana cost', () => {
      const skill = new TestActiveSkillImpl('test', '测试', { mpCost: 30 });
      skill.setOwner(unit);

      const context = {
        caster: unit,
        target: unit,
      };

      // Unit should have full MP, so can trigger
      expect(skill.canTrigger(context)).toBe(true);

      // Consume MP to below cost
      unit.consumeMp(unit.currentMp - 10);
      expect(skill.canTrigger(context)).toBe(false);
    });

    it('canTrigger should check cooldown', () => {
      const skill = new TestActiveSkillImpl('test', '测试', { cooldown: 2 });
      skill.setOwner(unit);
      skill.startCooldown();

      const context = {
        caster: unit,
        target: unit,
      };

      expect(skill.canTrigger(context)).toBe(false);

      skill.tickCooldown();
      skill.tickCooldown();

      expect(skill.canTrigger(context)).toBe(true);
    });
  });
});
