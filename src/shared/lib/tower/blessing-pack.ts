import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import raw from './data/blessings.json';

export const TOWER_BLESSING_IDS = [
  'physical_power',
  'spell_power',
  'guard',
  'swiftness',
  'beast_power',
] as const;
export type TowerBlessingId = (typeof TOWER_BLESSING_IDS)[number];
export const TowerBlessingsPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(2),
  contentRevision: z.number().int().positive(),
  blessings: z
    .array(
      z.strictObject({
        id: z.enum(TOWER_BLESSING_IDS),
        name: z.string().min(1),
        icon: z.string().min(1),
        label: z.string().min(1),
        maxStacks: z.number().int().min(1).max(3),
        effect: z.strictObject({
          target: z.enum(['player', 'beasts']),
          attributes: z
            .array(
              z.enum([
                'physicalAtk',
                'magicAtk',
                'physicalDef',
                'magicDef',
                'speed',
              ]),
            )
            .min(1),
          perStack: z.number().positive().max(0.1),
        }),
      }),
    )
    .length(TOWER_BLESSING_IDS.length),
  choices: z.strictObject({
    count: z.number().int().min(1).max(3),
    afterFloors: z
      .array(z.number().int().min(0).max(19))
      .min(1)
      .refine(
        (nodes) => new Set(nodes).size === nodes.length,
        '祝福节点不得重复',
      ),
  }),
});
export function loadTowerBlessingsPack(data: unknown) {
  const result = TowerBlessingsPackShape.superRefine((pack, ctx) => {
    if (
      new Set(pack.blessings.map((b) => b.id)).size !==
      TOWER_BLESSING_IDS.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['blessings'],
        message: '祝福 ID 必须完整且唯一',
      });
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors(
        'tower/data/blessings.json',
        data,
        result.error.issues,
      ),
    );
  return result.data;
}
export const TOWER_BLESSINGS_PACK = loadTowerBlessingsPack(raw);
export function towerBlessingRule(
  id: TowerBlessingId,
  pack = TOWER_BLESSINGS_PACK,
) {
  return pack.blessings.find((b) => b.id === id)!;
}
