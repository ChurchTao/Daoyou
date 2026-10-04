import { z } from 'zod';
import type { createBeastTradeSchemas } from '../beasts/trade.js';
import type { createInventorySchemas } from '../items/inventory.js';
import {
  ItemLibraryMaterialPayloadSchema,
  ItemLibraryConsumablePayloadSchema,
  ItemLibraryArtifactPayloadSchema,
} from '../items/library.js';

export function createMailAttachmentSchemas({
  BeastTransferSchema,
  MailInventoryGrantSchema,
}: {
  BeastTransferSchema: ReturnType<
    typeof createBeastTradeSchemas
  >['BeastTransferSchema'];
  MailInventoryGrantSchema: ReturnType<
    typeof createInventorySchemas
  >['ItemGrantSchema'];
}) {
  const MailAttachmentSchema = z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('beast_v1'),
      name: z.string().min(1),
      quantity: z.literal(1),
      beast: BeastTransferSchema,
    }),
    z
      .object({
        type: z.literal('inventory_v1'),
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        inventory: MailInventoryGrantSchema,
      })
      .strict(),
    z.object({
      type: z.literal('spirit_stones'),
      name: z.string().trim().min(1).max(100),
      quantity: z.number().int().min(1),
    }),
    z.object({
      type: z.literal('reputation'),
      name: z.string().trim().min(1).max(100),
      quantity: z.number().int().min(1),
    }),
    z.object({
      type: z.literal('cultivation_exp'),
      name: z.string().trim().min(1).max(100),
      quantity: z.number().int().min(1),
    }),
    z.object({
      type: z.literal('comprehension_insight'),
      name: z.string().trim().min(1).max(100),
      quantity: z.number().int().min(1),
    }),
    z.object({
      type: z.literal('material'),
      name: z.string().trim().min(1).max(100),
      quantity: z.number().int().min(1),
      data: ItemLibraryMaterialPayloadSchema.extend({
        quantity: z.number().int().min(1),
      }),
    }),
    z.object({
      type: z.literal('consumable'),
      name: z.string().trim().min(1).max(100),
      quantity: z.number().int().min(1),
      data: ItemLibraryConsumablePayloadSchema.extend({
        quantity: z.number().int().min(1),
      }),
    }),
    z.object({
      type: z.literal('artifact'),
      name: z.string().trim().min(1).max(100),
      quantity: z.number().int().min(1),
      data: ItemLibraryArtifactPayloadSchema,
    }),
  ]);
  const MailAttachmentsSchema = z.array(MailAttachmentSchema);
  return { MailAttachmentSchema, MailAttachmentsSchema };
}
