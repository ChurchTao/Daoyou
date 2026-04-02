import { AffixCandidate, CreationProductType } from '../../types';

export interface AffixSelectionFacts {
  productType: CreationProductType;
  candidates: AffixCandidate[];
  remainingEnergy: number;
  sessionTags: string[];
  maxSelections: number;
  selectionCount: number;
  selectedAffixIds: string[];
  selectedExclusiveGroups: string[];
}