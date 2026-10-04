import { z } from 'zod';
import type { createWildIndividualSchema, WildCombatantSchema } from './individual.js';


export function createWildEncounterSchema(WildIndividualSchema: ReturnType<typeof createWildIndividualSchema>) {
return z
  .object({
    id: z.uuid(),
    nodeId: z.string().min(1),
    seed: z.number().int(),
    createdAt: z.iso.datetime(),
    combatants: z.array(WildIndividualSchema).min(1).max(3),
  })
  .strict();

}

export type WildEncounter = z.infer<ReturnType<typeof createWildEncounterSchema>>;


export type WildEncounterView = Pick<
  WildEncounter,
  'id' | 'nodeId' | 'createdAt'
> & {
  combatants: z.infer<typeof WildCombatantSchema>[];
};


export function wildEncounterView(encounter: WildEncounter): WildEncounterView {
  return {
    id: encounter.id,
    nodeId: encounter.nodeId,
    createdAt: encounter.createdAt,
    combatants: encounter.combatants.map(
      ({ unitId, speciesId, level, isMutant }) => ({
        unitId,
        speciesId,
        level,
        ...(isMutant ? { isMutant: true } : {}),
      }),
    ),
  };
}
