import { z } from 'zod';
import { DAO_EQUIPMENT_SLOTS } from '../engine/combat-v6/equipment/types';
import { ForgingLevelSchema } from '../forging/rules';
import { ItemGrantSchema } from '../inventory';
import { ConsumableFactsSchema } from '../items/definitions/consumables';
import { MaterialFactsSchema } from '../items/definitions/materials';
import { SeedFactsSchema } from '../items/definitions/seeds';
import { MailAttachmentsSchema } from '../lib/itemLibrary';

const ref = {
  id: z.string().min(1).max(160),
  revision: z.number().int().nonnegative(),
};
export const ForgeRequestSchema = z
  .object({
    blueprint: z.object(ref).strict(),
    materials: z
      .array(
        z.object({ ...ref, quantity: z.number().int().min(1).max(5) }).strict(),
      )
      .min(1)
      .max(5),
  })
  .strict()
  .refine(
    (v) => new Set(v.materials.map((m) => m.id)).size === v.materials.length,
    '不能重复提交同一材料格',
  );
export type ForgeRequest = z.infer<typeof ForgeRequestSchema>;
export type ForgeView = {
  ownerLevel: number;
  spiritStones: number;
  qi: number;
};
export const WithdrawMaterialSchema = z
  .object({
    kind: z.enum(['material', 'consumable']).default('material'),
    id: z.uuid(),
    quantity: z.number().int().min(1).max(3960),
    expectedQuantity: z.number().int().positive(),
  })
  .strict();
export const VaultQuerySchema = z
  .object({
    kind: z.enum(['material', 'consumable']).default('material'),
    page: z.coerce.number().int().min(0).max(1000000).default(0),
    search: z.string().max(80).default(''),
  })
  .strict();
export type VaultView = {
  items: {
    kind: 'material' | 'consumable';
    name: string;
    type: string;
    rank: string;
    description: string;
    element: string | null;
    id: string;
    quantity: number;
  }[];
  total: number;
  page: number;
};
export const DevGrantSchema = z
  .object({
    cultivatorId: z.uuid(),
    grants: z
      .array(
        z.discriminatedUnion('type', [
          z
            .object({
              type: z.literal('mail'),
              format: z
                .enum(['historical', 'new_reward'])
                .default('new_reward'),
              attachments: MailAttachmentsSchema.min(1).max(20),
            })
            .strict(),
          z.object({ type: z.literal('item'), item: ItemGrantSchema }).strict(),
          z
            .object({
              type: z.literal('vault-seed'),
              facts: SeedFactsSchema,
              quantity: z.number().int().min(1).max(99),
            })
            .strict(),
          z
            .object({
              type: z.literal('vault-consumable'),
              facts: ConsumableFactsSchema,
              quantity: z.number().int().min(1).max(3960),
            })
            .strict(),
          z
            .object({
              type: z.literal('beast'),
              speciesId: z.string().min(1).max(100),
              skills: z.array(z.string().min(1).max(160)).min(1).max(8).optional(),
            })
            .strict(),
          z
            .object({
              type: z.literal('vault-material'),
              facts: MaterialFactsSchema,
              quantity: z.number().int().min(1).max(3960),
            })
            .strict(),
          z
            .object({
              type: z.literal('equipment'),
              slot: z.enum(DAO_EQUIPMENT_SLOTS),
              level: ForgingLevelSchema,
            })
            .strict(),
          z
            .object({
              type: z.literal('spirit-stones'),
              amount: z.number().int().min(1).max(1000000),
            })
            .strict(),
          z
            .object({
              type: z.literal('qi'),
              amount: z.number().int().min(1).max(300),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(40),
  })
  .strict();
