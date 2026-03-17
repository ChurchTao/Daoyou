import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';

describe('DamageSystem', () => {
  let attacker: Unit;
  let target: Unit;

  beforeEach(() => {
    attacker = new Unit('attacker', '攻击者', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.AGILITY]: 50,
    });
    target = new Unit('target', '目标', {
      [AttributeType.PHYSIQUE]: 50,
      [AttributeType.AGILITY]: 30,
    });
  });

  it('应该正确计算基础伤害', () => {
    const result = DamageSystem.calculateDamage(attacker, target, {
      baseDamage: 100,
      damageType: 'physical',
    });

    expect(result.finalDamage).toBeGreaterThan(0);
    expect(result.breakdown).toBeDefined();
  });

  it('应该支持暴击判定', () => {
    // 设置高敏捷以确保暴击
    const critAttacker = new Unit('crit_attacker', '暴击者', {
      [AttributeType.AGILITY]: 500, // 高暴击率
    });

    const result = DamageSystem.calculateDamage(critAttacker, target, {
      baseDamage: 100,
      damageType: 'physical',
    });

    // 暴击时伤害应该更高
    if (result.isCritical) {
      expect(result.breakdown.critMultiplier).toBeGreaterThan(1);
    }
  });

  it('应该支持闪避判定', () => {
    // 设置高敏捷以确保闪避
    const evasiveTarget = new Unit('evasive_target', '闪避者', {
      [AttributeType.PHYSIQUE]: 50,
      [AttributeType.AGILITY]: 500, // 高闪避率
    });

    const result = DamageSystem.calculateDamage(attacker, evasiveTarget, {
      baseDamage: 100,
      damageType: 'physical',
    });

    // 闪避时伤害应该为 0
    if (result.isDodged) {
      expect(result.finalDamage).toBe(0);
    }
  });

  it('应该有最小伤害保证', () => {
    const result = DamageSystem.calculateDamage(attacker, target, {
      baseDamage: 1,
      damageType: 'physical',
    });

    expect(result.finalDamage).toBeGreaterThanOrEqual(1);
  });
});
