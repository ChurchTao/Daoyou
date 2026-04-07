import {
  AffixCandidate,
  AffixCategory,
  CreationProductType,
} from '../../types';

export interface AffixSelectionBucketCaps {
  highTierTotal?: number;
  mythic?: number;
}

export interface AffixSelectionConstraints {
  categoryCaps: Partial<Record<AffixCategory, number>>;
  bucketCaps?: AffixSelectionBucketCaps;
}

export interface AffixSelectionFacts {
  productType: CreationProductType;
  candidates: AffixCandidate[];
  remainingEnergy: number;
  sessionTags: string[];
  maxSelections: number;
  selectionCount: number;
  selectedAffixIds: string[];
  selectedExclusiveGroups: string[];
  selectedCategoryCounts: Partial<Record<AffixCategory, number>>;
  selectionConstraints: AffixSelectionConstraints;
}