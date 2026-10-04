import { z } from 'zod';
import type { Command } from '@daoyou/combat-core/types';




export const CombatV6TrainingCommandSchema = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('attack'), target: z.string().min(1).max(200) })
    .strict(),
  z
    .object({
      type: z.literal('skill'),
      skillId: z.string().min(1).max(200),
      targets: z.array(z.string().min(1).max(200)).max(8),
    })
    .strict(),
  z.object({ type: z.literal('defend') }).strict(),
  z
    .object({ type: z.literal('protect'), target: z.string().min(1).max(200) })
    .strict(),
  z.object({ type: z.literal('flee') }).strict(),
  z
    .object({ type: z.literal('summon'), petId: z.string().min(1).max(200) })
    .strict(),
  z.object({ type: z.literal('recall') }).strict(),
]);



export type CombatV6TrainingCommandV1 = z.infer<
  typeof CombatV6TrainingCommandSchema
> &
  Command;




export const CombatV6CommandGroupSchema = z
  .array(
    z
      .object({
        unitId: z.string().min(1).max(200),
        command: CombatV6TrainingCommandSchema,
      })
      .strict(),
  )
  .min(1)
  .max(2);



export type CombatV6CommandGroup = z.infer<typeof CombatV6CommandGroupSchema>;
