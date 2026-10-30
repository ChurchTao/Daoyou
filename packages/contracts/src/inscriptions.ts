import { z } from 'zod';
import { MAX_CRAFT_MATERIAL_QUANTITY } from '@daoyou/game-domain/inventory';
import type { InscriptionCost } from '@daoyou/game-domain/inscriptions';
import type { ItemGrant } from '@daoyou/game-domain/inventory';

const ref = z.strictObject({
  id: z.string().min(1).max(160),
  revision: z.number().int().nonnegative(),
});
const material = ref.extend({
  quantity: z.number().int().min(1).max(MAX_CRAFT_MATERIAL_QUANTITY),
});
const common = {
  requestId: z.uuid(),
  expectedCost: z.strictObject({
    qi: z.number().int().nonnegative(),
    spiritStones: z.number().int().nonnegative(),
  }),
};
const socketIndex = z.union([z.literal(0), z.literal(1)]);
const equipment = {
  equipment: ref,
  socket: socketIndex,
  inscription: ref,
};
const imprintStep = {
  socket: socketIndex,
  inscription: ref,
  replace: z.boolean(),
};
const socketStep = z.discriminatedUnion('mode', [
  z.strictObject({ ...imprintStep, mode: z.literal('engrave') }),
  z.strictObject({ ...imprintStep, mode: z.literal('strengthen_socket') }),
  z.strictObject({ socket: socketIndex, mode: z.literal('remove') }),
]);
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
  z.strictObject({
    ...common,
    action: z.literal('inscribe'),
    equipment: ref,
    steps: z.array(socketStep).min(1).max(2),
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
