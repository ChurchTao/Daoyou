import { z } from 'zod';
import type { createBeastSchema } from '../beasts/schema.js';


export const WildCombatantSchema = z.strictObject({
  unitId: z.string().min(1),
  speciesId: z.string().min(1),
  level: z.number().int().min(0).max(180),
  isMutant: z.boolean().optional(),
});

export type WildCombatant = z.infer<typeof WildCombatantSchema>;

export function createWildIndividualSchema(BeastSchema: ReturnType<typeof createBeastSchema>) {
return WildCombatantSchema.extend({
  beast: BeastSchema,
}).refine(
  (c) =>
    c.speciesId === c.beast.speciesId &&
    c.level === c.beast.level &&
    !!c.isMutant === !!c.beast.isMutant,
  '野外个体与遭遇信息不一致',
);
}

export type WildIndividual = z.infer<ReturnType<typeof createWildIndividualSchema>>;
