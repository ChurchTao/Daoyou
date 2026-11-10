import type { Material } from '@daoyou/game-domain/character';
import type { SpiritSeedRandomOptions } from '@daoyou/game-domain/spirit-field';
import {
  buildSpiritGardenSeed,
  SPIRIT_GARDEN_SPECIES,
} from '@daoyou/game-rules/spirit-field';
import { SpiritSeedGenerator as SpiritSeedSkeletonGenerator } from '@daoyou/game-rules/spirit-field/generation';
import { randomInt } from 'node:crypto';

/** Select a catalog species in the shelf's rolled quality, without model calls. */
export class SpiritSeedGenerator {
  static generateRandom(
    count: number,
    options: SpiritSeedRandomOptions = {},
  ): Array<Omit<Material, 'id'>> {
    return SpiritSeedSkeletonGenerator.generateRandomSkeletons(
      count,
      options,
    ).map((skeleton) => {
      const candidates = SPIRIT_GARDEN_SPECIES.filter(
        (entry) =>
          entry.quality === skeleton.rank &&
          (!options.specifiedElement ||
            entry.element === options.specifiedElement),
      );
      if (candidates.length === 0)
        throw new Error('当前灵种目录没有符合品阶与五行条件的物种');
      const species = candidates[randomInt(candidates.length)]!;
      return buildSpiritGardenSeed(
        species.id,
        skeleton.rank,
        skeleton.quantity,
      );
    });
  }
}
