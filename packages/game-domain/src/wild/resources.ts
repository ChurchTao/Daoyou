import { z } from 'zod';

export const WildResourcesSchema = z
  .object({
    hp: z.number().finite().nonnegative(),
    mp: z.number().finite().nonnegative(),
    maxHp: z.number().finite().positive(),
    maxMp: z.number().finite().nonnegative(),
  })
  .strict();

export type WildResources = {
  hp: number;
  mp: number;
  maxHp: number;
  maxMp: number;
};
