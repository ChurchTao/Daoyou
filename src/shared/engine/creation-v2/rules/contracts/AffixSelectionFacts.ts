import {
  AffixCandidate,
  AffixSlot,
  CreationProductType,
} from '../../types';
import type { ElementType } from '@shared/types/constants';
import type { AffixSlotLayoutStep } from '../../config/AffixSelectionConstraints';

export interface SelectedGongfaSchoolPlan {
  primarySelected: boolean;
  primaryElement?: ElementType;
  resonanceCount: number;
  supportCount: number;
}

export interface AffixSelectionFacts {
  productType: CreationProductType;
  candidates: AffixCandidate[];
  remainingEnergy: number;
  inputTags: string[];
  maxSelections: number;
  selectionCount: number;
  selectedAffixIds: string[];
  selectedExclusiveGroups: string[];
  selectedAbilityTags?: string[];
  selectedSlots: AffixSlot[];
  currentSlot: AffixSlotLayoutStep;
  elementBias?: ElementType;
  selectedGongfaSchoolPlan?: SelectedGongfaSchoolPlan;
}
