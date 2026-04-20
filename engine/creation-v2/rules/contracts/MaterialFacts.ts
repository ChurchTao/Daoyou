import {
  CreationProductType,
  MaterialEnergyProfile,
  MaterialFingerprint,
  MaterialQualityProfile,
} from '../../types';

export interface MaterialFacts {
  productType: CreationProductType;
  fingerprints: MaterialFingerprint[];
  normalizedTags: string[];
  recipeTags: string[];
  requestedTags: string[];
  dominantTags: string[];
  energyProfile: MaterialEnergyProfile;
  qualityProfile: MaterialQualityProfile;
  unlockScore: number;
}