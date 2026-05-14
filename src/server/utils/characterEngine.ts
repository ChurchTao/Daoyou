import { CharacterGenerator } from '@shared/engine/cultivator/creation/CharacterGenerator';
import type { Cultivator } from '@shared/types/cultivator';

/**
 * @deprecated Use CharacterGenerator.generate() directly from @shared/engine/cultivator/creation/CharacterGenerator
 */
export async function generateCultivatorFromAI(
  userInput: string,
): Promise<{ cultivator: Cultivator; balanceNotes: string }> {
  return CharacterGenerator.generate(userInput);
}
