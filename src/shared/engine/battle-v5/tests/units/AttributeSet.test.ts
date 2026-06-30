import { describe, expect, it } from 'vitest';
import { AttributeSet } from '../../units/AttributeSet';
import { AttributeType, ModifierType } from '../../core/types';

describe('AttributeSet derived hit and evasion attributes', () => {
  it('derives accuracy from wisdom and willpower', () => {
    const attributes = new AttributeSet({
      [AttributeType.WISDOM]: 1000,
      [AttributeType.WILLPOWER]: 1000,
    });

    expect(attributes.getBaseValue(AttributeType.ACCURACY)).toBeCloseTo(
      0.269508,
      6,
    );
    expect(attributes.getValue(AttributeType.ACCURACY)).toBeCloseTo(
      0.269508,
      6,
    );
  });

  it('keeps derived accuracy on a diminishing-return curve', () => {
    const attributes = new AttributeSet({
      [AttributeType.WISDOM]: 3000,
      [AttributeType.WILLPOWER]: 3000,
    });

    expect(attributes.getBaseValue(AttributeType.ACCURACY)).toBeCloseTo(
      0.30087,
      6,
    );
  });

  it('derives evasion from speed with diminishing returns', () => {
    const attributes = new AttributeSet({
      [AttributeType.SPEED]: 1000,
    });
    const cappedAttributes = new AttributeSet({
      [AttributeType.SPEED]: 3000,
    });

    expect(attributes.getBaseValue(AttributeType.EVASION_RATE)).toBeCloseTo(
      0.229677,
      6,
    );
    expect(cappedAttributes.getBaseValue(AttributeType.EVASION_RATE)).toBeCloseTo(
      0.260741,
      6,
    );
  });

  it('keeps modifier support on derived accuracy and evasion', () => {
    const attributes = new AttributeSet({
      [AttributeType.WISDOM]: 1000,
      [AttributeType.WILLPOWER]: 1000,
      [AttributeType.SPEED]: 1000,
    });

    attributes.addModifier({
      id: 'accuracy_bonus',
      attrType: AttributeType.ACCURACY,
      type: ModifierType.FIXED,
      value: 0.05,
      source: 'test',
    });
    attributes.addModifier({
      id: 'evasion_bonus',
      attrType: AttributeType.EVASION_RATE,
      type: ModifierType.FIXED,
      value: 0.04,
      source: 'test',
    });

    expect(attributes.getValue(AttributeType.ACCURACY)).toBeCloseTo(
      0.319508,
      6,
    );
    expect(attributes.getValue(AttributeType.EVASION_RATE)).toBeCloseTo(
      0.269677,
      6,
    );
  });

  it('derives fixed combat attributes linearly from primary attributes', () => {
    const attributes = new AttributeSet({
      [AttributeType.VITALITY]: 100,
      [AttributeType.SPEED]: 50,
      [AttributeType.SPIRIT]: 100,
      [AttributeType.WILLPOWER]: 50,
    });

    expect(attributes.getBaseValue(AttributeType.ATK)).toBe(429);
    expect(attributes.getBaseValue(AttributeType.DEF)).toBe(204);
    expect(attributes.getBaseValue(AttributeType.MAGIC_ATK)).toBe(429);
    expect(attributes.getBaseValue(AttributeType.MAGIC_DEF)).toBe(204);
    expect(attributes.getBaseValue(AttributeType.MAX_HP)).toBe(1960);
    expect(attributes.getBaseValue(AttributeType.MAX_MP)).toBe(1550);
  });
});
