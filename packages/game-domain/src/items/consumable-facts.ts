import { z } from 'zod';

import { assertConsumableSpec } from '../consumables/identity.js';

import { CONSUMABLE_TYPE_VALUES } from '../inventory.js';

import { QUALITY_VALUES } from '@daoyou/constants/qualities';

import type { Consumable } from '../cultivator.js';


/** The same spec is used for new alchemy output and explicit vault withdrawals. */
export const ConsumableFactsSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(CONSUMABLE_TYPE_VALUES),
    quality: z.enum(QUALITY_VALUES),
    description: z.string().default(''),
    prompt: z.string().default(''),
    score: z.number().finite().default(0),
    spec: z.unknown().transform((value, ctx) => {
      try {
        return assertConsumableSpec(value);
      } catch {
        ctx.addIssue({ code: 'custom', message: '消耗品药效协议无效' });
        return z.NEVER;
      }
    }),
  })
  .strict();

export type ConsumableFacts = z.infer<typeof ConsumableFactsSchema>;


export function consumableFactsOf(item: Consumable): ConsumableFacts {
  return ConsumableFactsSchema.parse({
    name: item.name,
    type: item.type,
    quality: item.quality ?? '凡品',
    description: item.description ?? '',
    prompt: item.prompt ?? '',
    score: item.score ?? 0,
    spec: item.spec,
  });
}
