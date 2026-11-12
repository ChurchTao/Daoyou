import { z } from 'zod';

import { readSpiritSeedSpec } from '../spirit-field/seedMaterial.js';
import type { SpiritSeedSpec } from '../spirit-field/types.js';

import { ELEMENT_VALUES } from '@daoyou/constants/elements';

import { QUALITY_VALUES } from '@daoyou/constants/qualities';

import { REALM_VALUES } from '@daoyou/constants/realms';

export interface SeedFacts {
  name: string;
  seedSpec: SpiritSeedSpec;
}

export const SeedFactsSchema: z.ZodType<SeedFacts> = z
  .object({
    name: z.string().optional(),
    seedSpec: z.unknown().transform((value, ctx) => {
      const spec = readSpiritSeedSpec({ seedSpec: value });
      if (!spec) {
        ctx.addIssue({
          code: 'custom',
          message: '灵种资产事实无效，无法读取',
        });
        return z.NEVER;
      }
      return spec;
    }),
  })
  .strict()
  .transform((facts) => ({ ...facts, name: facts.seedSpec.plant.seedName }));

/** Public shelf and mail previews carry only display facts. */
export const SeedPreviewFactsSchema = z
  .object({
    seedPreview: z
      .object({
        legacy: z.boolean().optional(),
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
}): SeedFacts {
  const spec = readSpiritSeedSpec(material.details);
  if (material.type !== 'seed' || !spec || material.rank !== spec.plant.quality)
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['seedSpec'],
        message: '灵种资产事实无效，无法读取',
      },
    ]);
  return SeedFactsSchema.parse({ seedSpec: spec });
}
