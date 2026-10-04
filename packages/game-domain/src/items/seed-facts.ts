import { z } from 'zod';

import { readSpiritFieldSeedSpec } from '../spirit-field/seedMaterial.js';

import { ELEMENT_VALUES } from '@daoyou/constants/elements';

import { QUALITY_VALUES } from '@daoyou/constants/qualities';

import { REALM_VALUES } from '@daoyou/constants/realms';

export const SeedFactsSchema = z
  .object({
    name: z.string().optional(),
    seedSpec: z.unknown().transform((value, ctx) => {
      const spec = readSpiritFieldSeedSpec({ seedSpec: value });
      if (!spec) {
        ctx.addIssue({
          code: 'custom',
          message: '灵种生长事实无效，无法取出或播种',
        });
        return z.NEVER;
      }
      return spec;
    }),
  })
  .strict()
  .transform((facts) => ({ ...facts, name: facts.seedSpec.plant.seedName }));


/** Public shelf facts omit the seed's hidden cultivation rules. */
export const SeedPreviewFactsSchema = z
  .object({
    seedPreview: z
      .object({
        quality: z.enum(QUALITY_VALUES),
        element: z.enum(ELEMENT_VALUES),
        minRealm: z.enum(REALM_VALUES),
        seedDescription: z.string(),
        clueTexts: z.array(z.string()),
      })
      .strict(),
  })
  .strict();


export function seedFactsOf(material: {
  type: unknown;
  rank: unknown;
  details?: unknown;
}) {
  const spec = readSpiritFieldSeedSpec(material.details);
  if (material.type !== 'seed' || !spec || material.rank !== spec.plant.quality)
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['seedSpec'],
        message: '灵种生长事实无效，无法取出或播种',
      },
    ]);
  return SeedFactsSchema.parse({ seedSpec: spec });
}
