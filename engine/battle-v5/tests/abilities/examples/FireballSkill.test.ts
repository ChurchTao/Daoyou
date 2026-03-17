import { FireballSkill } from '../../../abilities/examples/FireballSkill';
import { Unit } from '../../../units/Unit';
import { AttributeType } from '../../../core/types';

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
    expect(skill.getMpCost()).toBe(30);
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
});
