import { CharacterGenerator } from '@/engine/cultivator/creation/CharacterGenerator';
import type { Cultivator } from '@/types/cultivator';

/**
 * @deprecated Use CharacterGenerator.generate() directly from @/engine/cultivator/creation/CharacterGenerator
 */
export async function generateCultivatorFromAI(
  userInput: string,
): Promise<{ cultivator: Cultivator; balanceNotes: string }> {
  return CharacterGenerator.generate(userInput);
}