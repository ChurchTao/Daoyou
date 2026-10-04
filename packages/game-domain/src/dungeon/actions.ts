import { z } from 'zod';

export const DungeonMaterialSelectionsSchema = z
  .array(
    z
      .object({
        costIndex: z.number().int().min(0).max(31),
        items: z
          .array(
            z
              .object({
                itemId: z.string().min(1).max(160),
                revision: z.number().int().nonnegative(),
                quantity: z.number().int().positive().max(9999),
              })
              .strict(),
          )
          .min(1)
          .max(40),
      })
      .strict(),
  )
  .max(32);

export type DungeonMaterialSelection = z.infer<
  typeof DungeonMaterialSelectionsSchema
>[number];

export interface DungeonEncounterView {
  id: string;
  description: string;
  enemies: string[];
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  beast: string | null;
}
