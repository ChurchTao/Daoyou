import {
  CreationProductType,
  MaterialEnergyProfile,
  MaterialFingerprint,
} from '../../types';

export interface MaterialFacts {
  productType: CreationProductType;
  fingerprints: MaterialFingerprint[];
  normalizedTags: string[];
  recipeTags: string[];
  dominantTags: string[];
  energyProfile: MaterialEnergyProfile;
  unlockScore: number;
}
