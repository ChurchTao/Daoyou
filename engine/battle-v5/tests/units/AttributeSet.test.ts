import { AttributeSet } from '../../units/AttributeSet';
import { AttributeType, ModifierType } from '../../core/types';

describe('AttributeSet', () => {
  it('应该正确初始化5维属性', () => {
    const attrs = new AttributeSet({
      [AttributeType.SPIRIT]: 80,
      [AttributeType.VITALITY]: 60,
    });

    expect(attrs.getValue(AttributeType.SPIRIT)).toBe(80);
    expect(attrs.getValue(AttributeType.VITALITY)).toBe(60);
    expect(attrs.getValue(AttributeType.SPEED)).toBe(10); // 默认值
  });

  it('应该按6阶段顺序计算修改器', () => {
    const attrs = new AttributeSet({ [AttributeType.SPIRIT]: 100 });

    // BASE: 100
    expect(attrs.getBaseValue(AttributeType.SPIRIT)).toBe(100);

    // FIXED: +20
    attrs.addModifier({
      id: 'fixed1',
      attrType: AttributeType.SPIRIT,
      type: ModifierType.FIXED,
      value: 20,
      source: {},
    });

    // ADD: +10%
    attrs.addModifier({
      id: 'add1',
      attrType: AttributeType.SPIRIT,
      type: ModifierType.ADD,
      value: 0.1,
      source: {},
    });

    // MULTIPLY: ×1.2
    attrs.addModifier({
      id: 'mult1',
      attrType: AttributeType.SPIRIT,
      type: ModifierType.MULTIPLY,
      value: 1.2,
      source: {},
    });

    // 计算: (100 + 20) × 1.1 × 1.2 = 120 × 1.1 × 1.2 = 158.4 → 158
    expect(attrs.getValue(AttributeType.SPIRIT)).toBe(158);
  });

  it('应该正确计算派生属性', () => {
    const attrs = new AttributeSet({
      [AttributeType.VITALITY]: 50,
      [AttributeType.SPIRIT]: 30,
      [AttributeType.WILLPOWER]: 40,
    });

    // HP = 200 + 50*12 + 30*4 = 200 + 600 + 120 = 920
    expect(attrs.getMaxHp()).toBe(920);

    // MP = 100 + 30*5 + 10*3 = 100 + 150 + 30 = 280
    expect(attrs.getMaxMp()).toBe(280);

    // ATK = VITALITY*5 = 250
    expect(attrs.getValue(AttributeType.ATK)).toBe(250);

    // DEF = VITALITY*3 = 150
    expect(attrs.getValue(AttributeType.DEF)).toBe(150);

    // MAGIC_ATK = SPIRIT*5 = 150
    expect(attrs.getValue(AttributeType.MAGIC_ATK)).toBe(150);

    // MAGIC_DEF = WILLPOWER*3 = 120
    expect(attrs.getValue(AttributeType.MAGIC_DEF)).toBe(120);
  });

  it('应该支持克隆', () => {
    const attrs1 = new AttributeSet({ [AttributeType.SPIRIT]: 80 });
    attrs1.addModifier({
      id: 'mod1',
      attrType: AttributeType.SPIRIT,
      type: ModifierType.ADD,
      value: 0.1,
      source: {},
    });

    const attrs2 = attrs1.clone();

    expect(attrs2.getValue(AttributeType.SPIRIT)).toBe(88); // 80 × 1.1

    // 修改副本不影响原版
    attrs2.setBaseValue(AttributeType.SPIRIT, 100);
    expect(attrs1.getValue(AttributeType.SPIRIT)).toBe(88);
    expect(attrs2.getValue(AttributeType.SPIRIT)).toBe(110); // 100 × 1.1
  });
});
