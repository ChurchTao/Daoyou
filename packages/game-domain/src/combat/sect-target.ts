import { z } from 'zod';
import type { SectBattleOpponent } from './sect-battle.js';
import { REALM_STAGE_VALUES, REALM_VALUES } from '@daoyou/constants/realms';

export const SectV6TargetSchema = z
  .object({
    schemaVersion: z.literal(2),
    kind: z.enum(['preset', 'cultivator']),
    challengeTitle: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    realm: z.enum(REALM_VALUES),
    realmStage: z.enum(REALM_STAGE_VALUES),
    sourceCultivatorId: z.uuid().optional(),
    sourceSectId: z.string().optional(),
    sourceSectName: z.string().optional(),
    lockedAt: z.iso.datetime(),
    seed: z.number().int().nonnegative(),
    contentVersion: z.literal('combat-v6-sect-task-v1'),
    resourcePolicy: z.enum(['full', 'persistent']),
    opponent: z.custom<SectBattleOpponent>((value) => {
      const opponent = value as SectBattleOpponent | undefined;
      return (
        opponent?.version === 'sect-v6-opponent-v1' &&
        Array.isArray(opponent.units) &&
        opponent.units.length > 0 &&
        opponent.units.every(
          (unit) => unit.side === 1 && !!unit.id && !unit.benched,
        ) &&
        Array.isArray(opponent.skills) &&
        Array.isArray(opponent.statusDefs)
      );
    }),
  })
  .strict();

export type SectV6Target = z.infer<typeof SectV6TargetSchema>;
