import { FireballSkill } from '../../../abilities/examples/FireballSkill';
import { Unit } from '../../../units/Unit';
import { AttributeType } from '../../../core/types';
import { GameplayTags } from '../../../core/GameplayTags';

describe('FireballSkill', () => {
  let caster: Unit;
  let target: Unit;

  beforeEach(() => {
    caster = new Unit('caster', '施法者', {
      [AttributeType.SPIRIT]: 80,
    });
    target = new Unit('target', '目标', {
      [AttributeType.PHYSIQUE]: 50,
    });
  });

  it('应该正确初始化火球术', () => {
    const skill = new FireballSkill();
    expect(skill.id).toBe('fireball');
    expect(skill.name).toBe('火球术');
    expect(skill.manaCost).toBe(30);
    expect(skill.getCooldown()).toBe(3);
  });

  it('应该消耗 MP 并造成伤害', () => {
    const skill = new FireballSkill();
    const initialMp = caster.currentMp;
    const initialHp = target.currentHp;

    skill.executeWithTarget(caster, target);

    expect(caster.currentMp).toBe(initialMp - 30);
    expect(target.currentHp).toBeLessThan(initialHp);
  });

  it('MP 不足时无法施放', () => {
    const skill = new FireballSkill();
    caster.consumeMp(caster.currentMp); // 清空 MP

    const initialHp = target.currentHp;
    skill.executeWithTarget(caster, target);

    expect(target.currentHp).toBe(initialHp);
  });

  it('冷却中无法施放', () => {
    const skill = new FireballSkill();
    skill.executeWithTarget(caster, target);

    // 尝试再次施放
    const initialHp = target.currentHp;
    skill.executeWithTarget(caster, target);

    expect(target.currentHp).toBe(initialHp);
  });

  describe('火球术标签系统', () => {
    it('应正确设置所有标签', () => {
      const skill = new FireballSkill();

      expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_DAMAGE)).toBe(true);
      expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)).toBe(true);
      expect(skill.tags.hasTag(GameplayTags.ABILITY.ELEMENT_FIRE)).toBe(true);
      expect(skill.tags.hasTag(GameplayTags.ABILITY.TARGET_SINGLE)).toBe(true);
    });

    it('应支持父标签匹配（有父标签则匹配子标签）', () => {
      const skill = new FireballSkill();

      // 添加父标签 Ability.Type
      skill.tags.addTags(['Ability.Type']);

      // 现在检查子标签应该返回 true
      expect(skill.tags.hasTag('Ability.Type.Magic')).toBe(true);
      expect(skill.tags.hasTag('Ability.Type.Damage')).toBe(true);
    });

    it('应通过标签查询能力类型', () => {
      const skill = new FireballSkill();

      // 检查是否是魔法技能
      expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)).toBe(true);

      // 检查是否是物理技能
      expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_PHYSICAL)).toBe(false);

      // 检查是否是火属性
      expect(skill.tags.hasTag(GameplayTags.ABILITY.ELEMENT_FIRE)).toBe(true);

      // 检查是否是单体目标
      expect(skill.tags.hasTag(GameplayTags.ABILITY.TARGET_SINGLE)).toBe(true);
    });
  });
});
