import { z } from 'zod';

export const DIVINATION_DIRECTION_IDS = [
  'forging',
  'alchemy',
  'beast',
  'retreat',
  'breakthrough',
  'dungeon',
  'wild',
  'spirit_field',
] as const;

export type DivinationDirection = (typeof DIVINATION_DIRECTION_IDS)[number];

export const DivinationDirectionSchema = z.enum(DIVINATION_DIRECTION_IDS);

export const DivinationDiceSchema = z.tuple([
  z.number().int().min(1).max(6),
  z.number().int().min(1).max(6),
  z.number().int().min(1).max(6),
]);

export type DivinationDice = z.infer<typeof DivinationDiceSchema>;

export const DIVINATION_OMEN_IDS = [
  'seed',
  'earth',
  'flame',
  'still',
  'clouds',
  'heaven',
  'steps',
  'stream',
  'wind',
  'moonrise',
  'roots',
  'mirror',
  'herons',
  'bridge',
  'stars',
  'jade',
  'mist',
  'lotus',
  'bamboo',
  'stone',
  'sail',
  'rain',
  'pine',
  'plum',
  'lamp',
  'horizon',
] as const;

export type DivinationOmen = {
  readonly id: (typeof DIVINATION_OMEN_IDS)[number];
  readonly name: string;
  readonly verse: string;
  readonly meaning: string;
};
