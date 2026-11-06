import type { AttrName } from '@daoyou/combat-core/constants';

/** Panel probabilities are ratios. Point-based contributions retain their integer rounding. */
export function floorPanelValue(attr: AttrName, value: number): number {
  return attr === 'critRate' || attr === 'spellCritRate' || attr === 'physicalFuryRate'
    ? value
    : Math.floor(value);
}
