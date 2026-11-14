import type { Material } from '@daoyou/game-domain/character';
import type { SpiritGardenSeedRandomOptions } from '@daoyou/game-domain/spirit-field';
import {
  buildSpiritGardenSeed,
  getSpiritGardenSeedCandidates,
  pickSpiritGardenSeedQuality,
} from '@daoyou/game-rules/spirit-field';
import { randomInt } from 'node:crypto';

/** Select a catalog species in the shelf's rolled quality, without model calls. */
export class SpiritGardenSeedGenerator {
  static generateRandom(
    count: number,
    options: SpiritGardenSeedRandomOptions = {},
  ): Array<Omit<Material, 'id'>> {
    return Array.from({ length: Math.max(0, Math.floor(count)) }, () => {
      const quality = pickSpiritGardenSeedQuality(options);
      const candidates = getSpiritGardenSeedCandidates(
        quality,
        options.specifiedElement,
      );
      if (candidates.length === 0)
        throw new Error('当前灵种目录没有符合品阶与五行条件的物种');
      const species = candidates[randomInt(candidates.length)]!;
      return buildSpiritGardenSeed(species.id, quality, 1);
    });
  }
}
