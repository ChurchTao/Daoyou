import { MAX_PLAYER_ITEM_QUANTITY } from './itemQuantity';

/** Migrated verbatim from the old creation input limits. */
export const ALCHEMY_INPUT_CONSTRAINTS = {
  minMaterialKinds: 1,
  maxMaterialKinds: 6,
  minQuantityPerMaterial: 1,
  maxQuantityPerMaterial: MAX_PLAYER_ITEM_QUANTITY,
} as const;
export const ALCHEMY_MAX_DOSE = MAX_PLAYER_ITEM_QUANTITY;
