import {
  FOUNDATION_LESSON_DOSE,
  FOUNDATION_LESSON_INTENT,
  FOUNDATION_LESSON_MATERIALS,
} from '@daoyou/game-content/alchemy';
import { describe, expect, it } from 'vitest';
import { foundationLessonPlan } from './foundation-lesson.js';

describe('筑基丹授课配伍', () => {
  const materials = Object.values(FOUNDATION_LESSON_MATERIALS).map((item, index) => ({
    ...item,
    materialRef: String(index),
    dose: FOUNDATION_LESSON_DOSE,
  }));

  it('按相同配伍和丹意稳定取得破境药性，投料顺序不限', () => {
    const reversed = [...materials].reverse();
    expect(foundationLessonPlan(reversed, FOUNDATION_LESSON_INTENT)).toMatchObject({
      intentVector: [{ key: 'breakthrough_support', weight: 1 }],
      materialVectors: reversed.map(({ materialRef }) => ({
        materialRef,
        properties: [{ key: 'breakthrough_support', weight: 1 }],
      })),
    });
  });

  it('其他用量、丹意或同名异质材料继续走寻常配伍', () => {
    const [root, leaf] = materials;
    expect(foundationLessonPlan([{ ...root!, dose: 1 }, leaf!], FOUNDATION_LESSON_INTENT)).toBeNull();
    expect(foundationLessonPlan([{ ...root!, description: '药性不同' }, leaf!], FOUNDATION_LESSON_INTENT)).toBeNull();
    expect(foundationLessonPlan([root!, root!], FOUNDATION_LESSON_INTENT)).toBeNull();
    expect(foundationLessonPlan(materials, '炼一炉能补充气血的丹')).toBeNull();
  });
});
