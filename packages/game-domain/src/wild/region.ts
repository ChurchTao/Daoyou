import { REALM_ORDER, type RealmType } from '@daoyou/constants/realms';
import { z } from 'zod';

const text = z.string().min(1).max(200);

export const WildRegionSchema = z.strictObject({
  nodeId: text,
  id: text,
  name: text,
  description: text,
  searchText: text,
  rareChance: z.number().min(0).max(1).optional(),
  realmRequirement: z.enum(
    Object.keys(REALM_ORDER) as [RealmType, ...RealmType[]],
  ),
  scenery: z.enum([
    'meadow',
    'mine',
    'volcanic',
    'lake',
    'stone',
    'river',
    'forest',
    'cave',
    'storm',
  ]),
  species: z
    .array(
      z.strictObject({
        speciesId: text,
        minLevel: z.number().int().min(1).max(180),
        maxLevel: z.number().int().min(1).max(180),
      }),
    )
    .min(1),
});

export type WildRegion = z.infer<typeof WildRegionSchema>;
