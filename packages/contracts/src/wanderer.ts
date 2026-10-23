import { z } from 'zod';

export const WandererStateSchema = z
  .object({
    id: z.string().min(1).max(40),
    regionId: z.string().min(1).max(40),
    regionName: z.string().min(1).max(40),
    x: z.number().gt(0).lt(1),
    y: z.number().gt(0).lt(1),
    startsAt: z.number().int(),
    expiresAt: z.number().int(),
    serverNow: z.number().int(),
    wantedSpeciesId: z.string().min(1).max(160),
    wantedSpeciesName: z.string().min(1).max(40),
    bookPrice: z.number().int().positive().nullable(),
    dewPrice: z.number().int().positive(),
    incensePrice: z.number().int().positive(),
  })
  .strict();
export type WandererState = z.infer<typeof WandererStateSchema>;

export const WandererBeastOfferSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    speciesId: z.string(),
    speciesName: z.string(),
    level: z.number().int().nonnegative(),
    revision: z.number().int().nonnegative(),
    lead: z.boolean(),
    isLocked: z.boolean(),
    bottles: z.number().int().min(2).max(12),
  })
  .strict();
export type WandererBeastOffer = z.infer<typeof WandererBeastOfferSchema>;

export const WandererBeastSaleSchema = z
  .object({
    requestId: z.uuid(),
    beastId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    expectedBottles: z.number().int().min(2).max(12),
  })
  .strict();
export type WandererBeastSale = z.infer<typeof WandererBeastSaleSchema>;

export const WandererPurchaseSchema = z
  .object({
    requestId: z.uuid(),
    expectedPrice: z.number().int().positive(),
  })
  .strict();
export type WandererPurchase = z.infer<typeof WandererPurchaseSchema>;

export type WandererBeastSaleResult = {
  beastName: string;
  bottles: number;
};

export type WandererBookPurchaseResult = {
  itemName: string;
  skillName: string;
  definitionId: string;
  price: number;
  nextPrice: number | null;
  spiritStones: number;
};

export type WandererDewPurchaseResult = {
  itemName: string;
  quantity: number;
  price: number;
  spiritStones: number;
};

export type WandererIncensePurchaseResult = {
  itemName: string;
  quantity: number;
  price: number;
  spiritStones: number;
};
