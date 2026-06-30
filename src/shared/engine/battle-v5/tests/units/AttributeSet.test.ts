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
      0.265806,
      6,
    );
    expect(attributes.getValue(AttributeType.ACCURACY)).toBeCloseTo(
      0.265806,
      6,
    );
  });

  it('caps derived accuracy at 30%', () => {
    const attributes = new AttributeSet({
      [AttributeType.WISDOM]: 3000,
      [AttributeType.WILLPOWER]: 3000,
    });

    expect(attributes.getBaseValue(AttributeType.ACCURACY)).toBeCloseTo(
      0.299259,
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
      0.226349,
      6,
    );
    expect(cappedAttributes.getBaseValue(AttributeType.EVASION_RATE)).toBeCloseTo(
      0.259264,
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
      0.315806,
      6,
    );
    expect(attributes.getValue(AttributeType.EVASION_RATE)).toBeCloseTo(
      0.266349,
      6,
    );
  });
});
