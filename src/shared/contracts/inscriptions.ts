import { z } from 'zod';
import type { InscriptionCost } from '../inscriptions/rules';
import type { ItemGrant } from '../inventory';

const ref = z.strictObject({
  id: z.string().min(1).max(160),
  revision: z.number().int().nonnegative(),
});
const material = ref.extend({ quantity: z.number().int().min(1).max(99) });
const common = {
  requestId: z.uuid(),
  expectedCost: z.strictObject({
    qi: z.number().int().nonnegative(),
    spiritStones: z.number().int().nonnegative(),
  }),
};
const equipment = {
  equipment: ref,
  socket: z.union([z.literal(0), z.literal(1)]),
  inscription: ref,
};
export const InscriptionRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({
    ...common,
    action: z.literal('draw'),
    materials: z.array(material).min(1).max(4),
    expectedTenths: z.number().int().positive(),
  }),
  z.strictObject({
    ...common,
    action: z.literal('strengthen'),
    inscriptions: z.array(material).min(1).max(2),
  }),
  z.strictObject({
    ...common,
    ...equipment,
    action: z.literal('engrave'),
    replace: z.boolean(),
  }),
  z.strictObject({
    ...common,
    ...equipment,
    action: z.literal('strengthen_socket'),
  }),
]);
export type InscriptionRequest = z.infer<typeof InscriptionRequestSchema>;
export type InscriptionView = {
  ownerId: string;
  qi: number;
  spiritStones: number;
  blockedReason: string | null;
};
export type InscriptionResult = {
  requestId: string;
  action: InscriptionRequest['action'];
  cost: InscriptionCost;
  grants: ItemGrant[];
  equipmentId?: string;
};
