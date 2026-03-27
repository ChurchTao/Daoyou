import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';
import { GameplayTags } from '../../core/GameplayTags';

describe('Unit', () => {
  it('应该正确初始化战斗单元', () => {
    const unit = new Unit('player', '修仙者', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.VITALITY]: 60,
    });

    expect(unit.id).toBe('player');
    expect(unit.name).toBe('修仙者');
    expect(unit.currentHp).toBeGreaterThan(0);
    expect(unit.currentMp).toBeGreaterThan(0);
    expect(unit.isAlive()).toBe(true);
  });

  it('应该支持原型克隆', () => {
    const unit1 = new Unit('player', '修仙者', {
      [AttributeType.SPIRIT]: 80,
    });

    unit1.takeDamage(100);
    unit1.consumeMp(50);

    const unit2 = unit1.clone();

    expect(unit2.id).toBe('player_mirror');
    expect(unit2.name).toBe('修仙者的镜像');
    expect(unit2.currentHp).toBe(unit1.currentHp);
    expect(unit2.currentMp).toBe(unit1.currentMp);
  });

  it('应该正确处理伤害和治疗', () => {
    const unit = new Unit('player', '修仙者', {
      [AttributeType.VITALITY]: 50,
    });

    const maxHp = unit.maxHp;
    unit.takeDamage(100);
    expect(unit.currentHp).toBe(maxHp - 100);

    unit.heal(50);
    expect(unit.currentHp).toBe(maxHp - 50);

    unit.heal(1000); // 超治疗
    expect(unit.currentHp).toBe(maxHp);
  });

  it('应该正确处理MP消耗', () => {
    const unit = new Unit('player', '修仙者', {
      [AttributeType.SPIRIT]: 50,
    });

    const maxMp = unit.maxMp;
    const success = unit.consumeMp(50);
    expect(success).toBe(true);
    expect(unit.currentMp).toBe(maxMp - 50);

    const fail = unit.consumeMp(1000);
    expect(fail).toBe(false);
    expect(unit.currentMp).toBe(maxMp - 50);
  });

  it('应该正确计算HP和MP百分比', () => {
    const unit = new Unit('player', '修仙者', {
      [AttributeType.SPIRIT]: 50,
      [AttributeType.VITALITY]: 50,
    });

    expect(unit.getHpPercent()).toBe(1);
    expect(unit.getMpPercent()).toBe(1);

    unit.takeDamage(unit.maxHp / 2);
    expect(unit.getHpPercent()).toBe(0.5);

    unit.consumeMp(unit.maxMp / 4);
    expect(unit.getMpPercent()).toBe(0.75);
  });

  it('应该正确生成快照', () => {
    const unit = new Unit('player', '修仙者', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.VITALITY]: 60,
    });

    const snapshot = unit.getSnapshot();

    expect(snapshot).toHaveProperty('unitId', 'player');
    expect(snapshot).toHaveProperty('name', '修仙者');
    expect(snapshot).toHaveProperty('currentHp');
    expect(snapshot).toHaveProperty('maxHp');
    expect(snapshot).toHaveProperty('currentMp');
    expect(snapshot).toHaveProperty('maxMp');
    expect(snapshot).toHaveProperty('attributes');
    expect(snapshot).toHaveProperty('buffs');
    expect(snapshot).toHaveProperty('isAlive', true);
    expect(snapshot).toHaveProperty('hpPercent');
    expect(snapshot).toHaveProperty('mpPercent');
  });

  it('应该正确重置回合状态', () => {
    const unit = new Unit('player', '修仙者', {
      [AttributeType.SPIRIT]: 50,
    });

    unit.isDefending = true;
    unit.isControlled = true;

    unit.resetTurnState();

    expect(unit.isDefending).toBe(false);
    expect(unit.isControlled).toBe(false);
  });

  it('应该正确处理死亡状态', () => {
    const unit = new Unit('player', '修仙者', {
      [AttributeType.VITALITY]: 50,
    });

    unit.takeDamage(unit.maxHp + 1000);
    expect(unit.currentHp).toBe(0);
    expect(unit.isAlive()).toBe(false);
  });

  it('应该正确恢复MP', () => {
    const unit = new Unit('player', '修仙者', {
      [AttributeType.SPIRIT]: 50,
    });

    unit.consumeMp(50);
    expect(unit.currentMp).toBeLessThan(unit.maxMp);

    unit.restoreMp(25);
    expect(unit.currentMp).toBeGreaterThan(unit.maxMp - 50);

    unit.restoreMp(1000); // 超恢复
    expect(unit.currentMp).toBe(unit.maxMp);
  });

  it('应该正确更新派生属性', () => {
    const unit = new Unit('player', '修仙者', {
      [AttributeType.SPIRIT]: 50,
      [AttributeType.VITALITY]: 50,
    });

    const originalMaxHp = unit.maxHp;
    const originalMaxMp = unit.maxMp;

    // Modify base attributes
    unit.attributes.setBaseValue(AttributeType.VITALITY, 60);
    unit.attributes.setBaseValue(AttributeType.SPIRIT, 70);

    unit.updateDerivedStats();

    expect(unit.maxHp).toBeGreaterThan(originalMaxHp);
    expect(unit.maxMp).toBeGreaterThan(originalMaxMp);
  });

  describe('Unit 标签系统', () => {
    it('新建单位应带有 COMBATANT 标签', () => {
      const unit = new Unit('test', '测试', {});

      expect(unit.tags.hasTag(GameplayTags.UNIT.COMBATANT)).toBe(true);
    });

    it('Unit 克隆应保留标签状态', () => {
      const unit = new Unit('test', '测试', {});
      unit.tags.addTags([GameplayTags.STATUS.IMMUNE_FIRE]);

      const cloned = unit.clone();

      expect(cloned.tags.hasTag(GameplayTags.STATUS.IMMUNE_FIRE)).toBe(true);
    });

    it('克隆的标签容器应独立', () => {
      const unit = new Unit('test', '测试', {});
      const cloned = unit.clone();

      cloned.tags.addTags([GameplayTags.STATUS.IMMUNE]);

      expect(unit.tags.hasTag(GameplayTags.STATUS.IMMUNE)).toBe(false);
      expect(cloned.tags.hasTag(GameplayTags.STATUS.IMMUNE)).toBe(true);
    });
  });
});
