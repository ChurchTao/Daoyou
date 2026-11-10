import type { Material } from '@daoyou/game-domain/character';
import type { SpiritSeedRandomOptions } from '@daoyou/game-domain/spirit-field';
import {
  buildSpiritGardenSeed,
  SPIRIT_GARDEN_SPECIES,
} from '@daoyou/game-rules/spirit-field';
import { SpiritSeedGenerator as SpiritSeedSkeletonGenerator } from '@daoyou/game-rules/spirit-field/generation';
import { randomInt } from 'node:crypto';

/** 灵种来自固定物种目录；品质仍沿用货架的品阶范围，不再调用模型。 */
export class SpiritSeedGenerator {
  static generateRandom(
    count: number,
    options: SpiritSeedRandomOptions & { includeLockedSpecies?: boolean } = {},
  ): Array<Omit<Material, 'id'>> {
    const species = SPIRIT_GARDEN_SPECIES.filter(
      (entry) =>
        (options.includeLockedSpecies || entry.unlockCount === 0) &&
        (!options.specifiedElement ||
          entry.element === options.specifiedElement),
    );
    if (species.length === 0) throw new Error('当前灵种目录没有符合条件的物种');
    return SpiritSeedSkeletonGenerator.generateRandomSkeletons(
      count,
      options,
    ).map((skeleton) => {
      const entry = species[randomInt(species.length)]!;
      return buildSpiritGardenSeed(entry.id, skeleton.rank, skeleton.quantity);
    });
  }
}
