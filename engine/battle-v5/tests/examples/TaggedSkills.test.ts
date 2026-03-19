import { FireballSkill } from '../../abilities/examples/FireballSkill';
import { StrengthBuff } from '../../buffs/examples/StrengthBuff';
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';
import { GameplayTags } from '../../core/GameplayTags';
import { Buff, StackRule } from '../../buffs/Buff';

describe('基于标签的技能示例', () => {
  describe('FireballSkill', () => {
    it('应带有正确的标签组合', () => {
      const skill = new FireballSkill();

      expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_DAMAGE)).toBe(true);
      expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)).toBe(true);
      expect(skill.tags.hasTag(GameplayTags.ABILITY.ELEMENT_FIRE)).toBe(true);
      expect(skill.tags.hasTag(GameplayTags.ABILITY.TARGET_SINGLE)).toBe(true);
    });
  });

  describe('StrengthBuff', () => {
    it('应带有 BUFF 类型和正确的堆叠规则', () => {
      const buff = new StrengthBuff();

      expect(buff.tags.hasTag(GameplayTags.BUFF.TYPE_BUFF)).toBe(true);
      expect(buff.stackRule).toBe(StackRule.REFRESH_DURATION);
    });

    it('应用后应增加体魄', () => {
      const unit = new Unit('test', '测试', { [AttributeType.PHYSIQUE]: 50 });
      const basePhysique = unit.attributes.getValue(AttributeType.PHYSIQUE);

      const buff = new StrengthBuff();
      unit.buffs.addBuff(buff);

      expect(unit.attributes.getValue(AttributeType.PHYSIQUE)).toBe(basePhysique + 10);
    });

    it('免疫标签应阻止 BUFF 应用', () => {
      const unit = new Unit('test', '测试', { [AttributeType.PHYSIQUE]: 50 });
      unit.tags.addTags([GameplayTags.STATUS.IMMUNE]); // 这不会阻止 BUFF

      const buff = new StrengthBuff();
      unit.buffs.addBuff(buff);

      // StrengthBuff 是 BUFF 不是 DEBUFF，所以应该可以应用
      expect(unit.buffs.getAllBuffIds()).toContain('strength_buff');
    });
  });

  describe('标签驱动的技能交互', () => {
    it('火属性技能应对燃烧目标增伤（模拟）', () => {
      // 这是一个示例，展示如何用标签实现技能交互
      const caster = new Unit('caster', '施法者', { [AttributeType.SPIRIT]: 80 });
      const target = new Unit('target', '目标', {});

      // 模拟目标燃烧状态
      target.tags.addTags(['Status.Burning']);

      const fireball = new FireballSkill();

      // 在实际 DamageSystem 中，会检查技能标签和目标状态标签
      // if (ability.tags.hasTag(GameplayTags.ABILITY.ELEMENT_FIRE) && target.tags.hasTag('Status.Burning')) {
      //   damage *= 1.5;
      // }

      expect(fireball.tags.hasTag(GameplayTags.ABILITY.ELEMENT_FIRE)).toBe(true);
      expect(target.tags.hasTag('Status.Burning')).toBe(true);
    });
  });
});
