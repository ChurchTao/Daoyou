import { MaterialGenerator } from '@/engine/material/creation/MaterialGenerator';
import type { GeneratedMaterial } from '@/engine/material/creation/types';

/**
 * Generate a batch of random materials using AI (Structured Output).
 * Useful for market listings, loot drops, etc.
 *
 * @param count - Number of items to generate (default 10)
 */
export async function generateRandomMaterials(
  count: number = 10,
): Promise<GeneratedMaterial[]> {
  return MaterialGenerator.generateRandom(count);
}

export type { GeneratedMaterial };
