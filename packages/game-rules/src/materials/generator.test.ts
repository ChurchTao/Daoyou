import type { MaterialRandomOptions } from '@daoyou/game-domain/materials/generation';
import { describe, expect, it } from 'vitest';
import { MaterialGenerator } from './generator.js';

describe('material generation type boundary', () => {
  it('draws a herb at the zero RNG boundary instead of a zero-weight seed', () => {
    for (const regionTags of [
      undefined,
      ['元武国'],
      ['乱星海'],
      ['云梦山脉'],
    ]) {
      const skeletons = MaterialGenerator.generateRandomSkeletons(
        2,
        { regionTags },
        () => 0,
      );
      expect(skeletons.map((item) => item.type)).toEqual(['herb', 'herb']);
      expect(skeletons.every((item) => item.quantity >= 1)).toBe(true);
    }
  });

  it('rejects non-material types received through an untyped runtime caller', () => {
    for (const specifiedType of ['seed', 'unknown'])
      expect(() =>
        MaterialGenerator.generateRandomSkeletons(
          1,
          { specifiedType } as unknown as MaterialRandomOptions,
          () => 0,
        ),
      ).toThrow('不支持的材料生成类型');
  });
});
