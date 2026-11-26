import {
  FOUNDATION_LESSON_DOSE,
  FOUNDATION_LESSON_INTENT,
  FOUNDATION_LESSON_MATERIALS,
} from '@daoyou/game-content/alchemy';
import type { AlchemyRecipePlan } from '@daoyou/game-domain/consumables';
import type { MaterialFacts } from '@daoyou/game-domain/inventory';

type LessonMaterial = Pick<
  MaterialFacts,
  'name' | 'type' | 'rank' | 'description'
> & {
  element?: MaterialFacts['element'];
  materialRef: string;
  dose: number;
};

export function foundationLessonPlan(
  materials: readonly LessonMaterial[],
  intent: string,
): AlchemyRecipePlan | null {
  const recipe = Object.values(FOUNDATION_LESSON_MATERIALS);
  if (
    intent !== FOUNDATION_LESSON_INTENT ||
    materials.length !== recipe.length ||
    !recipe.every((ingredient) =>
      materials.some(
        (material) =>
          material.name === ingredient.name &&
          material.type === ingredient.type &&
          material.rank === ingredient.rank &&
          material.element === ingredient.element &&
          material.description === ingredient.description &&
          material.dose === FOUNDATION_LESSON_DOSE,
      ),
    )
  )
    return null;

  return {
    materialVectors: materials.map(({ materialRef, name }) => ({
      materialRef,
      materialName: name,
      properties: [{ key: 'breakthrough_support', weight: 1 }],
    })),
    intentVector: [{ key: 'breakthrough_support', weight: 1 }],
    focusMode: 'focused',
  };
}
