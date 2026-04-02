import { CreationProductType, MaterialFingerprint } from '../../types';

export interface MaterialFacts {
  productType: CreationProductType;
  fingerprints: MaterialFingerprint[];
  normalizedTags: string[];
  recipeTags: string[];
  requestedTags: string[];
  dominantTags: string[];
  totalEnergy: number;
}