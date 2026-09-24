import { z } from 'zod';
import type { ConsumableSpec } from '../types/consumable';
import {
  PILL_FAMILY_VALUES,
  PILL_QUOTA_CATEGORY_VALUES,
  TALISMAN_SESSION_MODE_VALUES,
} from '../types/consumable';

const amount = z.number().finite().nonnegative().max(2147483647);
const status = z.enum([
  'weakness',
  'minor_wound',
  'major_wound',
  'near_death',
  'breakthrough_focus',
  'protect_meridians',
  'clear_mind',
  'cultivation_boost',
]);
const operation = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('restore_resource'),
      resource: z.enum(['hp', 'mp']),
      mode: z.enum(['flat', 'percent']),
      value: amount,
    })
    .refine((v) => v.mode !== 'percent' || v.value <= 1),
  z.object({
    type: z.literal('change_gauge'),
    gauge: z.literal('pillToxicity'),
    delta: z.number().finite().min(-2147483647).max(2147483647),
  }),
  z.object({
    type: z.literal('remove_status'),
    status,
    removeAll: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('add_status'),
    status,
    stacks: z.number().int().positive().optional(),
    duration: z
      .union([
        z.object({ kind: z.literal('until_removed') }),
        z.object({
          kind: z.literal('time'),
          expiresAt: z.iso.datetime({ offset: true }),
        }),
      ])
      .optional(),
    usesRemaining: z.number().int().nonnegative().optional(),
    payload: z
      .record(
        z.string(),
        z.union([z.string(), z.number().finite(), z.boolean()]),
      )
      .optional(),
  }),
  z.object({
    type: z.literal('advance_track'),
    track: z.enum([
      'body.skin',
      'body.sinew_bone',
      'body.organs',
      'body.qi_blood',
      'body.primordial_spirit',
      'tempering.vitality',
      'tempering.spirit',
      'tempering.wisdom',
      'tempering.speed',
      'tempering.willpower',
      'marrow_wash',
    ]),
    value: amount,
  }),
  z.object({
    type: z.literal('gain_progress'),
    target: z.enum(['cultivation_exp', 'comprehension_insight']),
    value: amount,
  }),
  z.object({ type: z.literal('increase_lifespan'), value: amount }),
  z.object({ type: z.literal('gain_beast_cultivation'), value: amount }),
]);
const effect = {
  family: z.enum(PILL_FAMILY_VALUES),
  operations: z.array(operation).min(1).max(30),
  consumeRules: z.object({
    scene: z.literal('out_of_battle_only'),
    quotaCategory: z.enum(PILL_QUOTA_CATEGORY_VALUES),
  }),
};
/** Preserve production metadata, while validating executable effects at the facts boundary. */
export const ConsumableSpecSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pill'),
    ...effect,
    alchemyMeta: z
      .object({
        source: z.enum(['improvised', 'formula']),
        sourceMaterials: z.array(z.string()),
        stability: z.number().finite(),
        toxicityRating: z.number().finite(),
        tags: z.array(z.string()),
      })
      .passthrough(),
  }),
  z.object({
    kind: z.literal('spirit_fruit'),
    ...effect,
    source: z.object({
      kind: z.literal('spirit_field'),
      version: z.literal(1),
    }),
  }),
  z.object({
    kind: z.literal('talisman'),
    scenario: z.string().min(1),
    sessionMode: z.enum(TALISMAN_SESSION_MODE_VALUES),
    notes: z.string().optional(),
  }),
]);
export function parseConsumableSpec(value: unknown): ConsumableSpec {
  return ConsumableSpecSchema.parse(value) as ConsumableSpec;
}
