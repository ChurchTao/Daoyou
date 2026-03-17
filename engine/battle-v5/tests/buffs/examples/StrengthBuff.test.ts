import { StrengthBuff } from '../../../buffs/examples/StrengthBuff';
import { Unit } from '../../../units/Unit';
import { AttributeType, ModifierType } from '../../../core/types';

describe('StrengthBuff', () => {
  let unit: Unit;

  beforeEach(() => {
    unit = new Unit('test_unit', '测试单位', {
      [AttributeType.PHYSIQUE]: 50,
    });
  });

  it('应该正确初始化力量 Buff', () => {
    const buff = new StrengthBuff();
    expect(buff.id).toBe('strength_buff');
    expect(buff.name).toBe('力量提升');
    expect(buff.getDuration()).toBe(3);
  });

  it('应用时应该增加体魄属性', () => {
    const buff = new StrengthBuff();
    const originalPhysique = unit.attributes.getValue(AttributeType.PHYSIQUE);

    buff.onApply(unit);
    unit.updateDerivedStats();

    const newPhysique = unit.attributes.getValue(AttributeType.PHYSIQUE);
    expect(newPhysique).toBe(originalPhysique + 10);
  });

  it('移除时应该恢复体魄属性', () => {
    const buff = new StrengthBuff();
    buff.onApply(unit);
    unit.updateDerivedStats();

    const boostedPhysique = unit.attributes.getValue(AttributeType.PHYSIQUE);

    buff.onRemove(unit);
    unit.updateDerivedStats();

    const finalPhysique = unit.attributes.getValue(AttributeType.PHYSIQUE);
    expect(finalPhysique).toBeLessThan(boostedPhysique);
  });

  it('刷新时应该重置持续时间', () => {
    const buff = new StrengthBuff();
    buff.tickDuration();
    buff.tickDuration();
    expect(buff.getDuration()).toBe(1);

    buff.refreshDuration();
    expect(buff.getDuration()).toBe(3);
  });
});
