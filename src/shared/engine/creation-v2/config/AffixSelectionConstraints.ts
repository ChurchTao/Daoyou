import type { AffixSlot, CreationProductType } from '../types';
import { CREATION_PROJECTION_BALANCE } from './CreationBalance';

export interface AffixSlotLayoutStep {
  index: number;
  slots: AffixSlot[];
  required: boolean;
}

const PRODUCT_SLOT_LAYOUTS: Record<CreationProductType, AffixSlotLayoutStep[]> = {
  skill: [
    { index: 1, slots: ['core'], required: true },
    { index: 2, slots: ['modifier'], required: false },
    { index: 3, slots: ['modifier'], required: false },
    { index: 4, slots: ['modifier'], required: false },
    { index: 5, slots: ['modifier'], required: false },
  ],
  gongfa: [
    { index: 1, slots: ['core'], required: true },
    { index: 2, slots: ['identity'], required: false },
    { index: 3, slots: ['resonance', 'modifier'], required: false },
    { index: 4, slots: ['modifier'], required: false },
    { index: 5, slots: ['modifier'], required: false },
  ],
  artifact: [
    { index: 1, slots: ['core'], required: true },
    { index: 2, slots: ['identity', 'modifier'], required: false },
    { index: 3, slots: ['modifier'], required: false },
    { index: 4, slots: ['modifier'], required: false },
    { index: 5, slots: ['modifier'], required: false },
  ],
};

export function resolveAffixSlotLayout(
  productType: CreationProductType,
  openSlotCount: number,
): AffixSlotLayoutStep[] {
  if (openSlotCount <= 0) return [];

  const layout = PRODUCT_SLOT_LAYOUTS[productType] ?? [];
  return layout.slice(0, Math.min(openSlotCount, layout.length));
}

export { CREATION_PROJECTION_BALANCE };
