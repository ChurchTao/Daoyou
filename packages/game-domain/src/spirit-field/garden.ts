import type { ElementType } from '@daoyou/constants/elements';
import type { Quality } from '@daoyou/constants/qualities';
import type { RealmType } from '@daoyou/constants/realms';
import type { PillFamily } from '../consumable.js';

export const SPIRIT_GARDEN_SPECIES_IDS = [
  'green_vine',
  'dew_grass',
  'red_fruit',
  'moon_lotus',
  'stone_fungus',
  'beast_berry',
  'jade_bamboo',
  'longevity_tree',
] as const;
export type SpiritGardenSpeciesId = (typeof SPIRIT_GARDEN_SPECIES_IDS)[number];
export const SPIRIT_GARDEN_BRANCHES = ['abundance', 'essence'] as const;
export type SpiritGardenBranch = (typeof SPIRIT_GARDEN_BRANCHES)[number];
export interface SpiritGardenOutput {
  name: string;
  description: string;
  kind: 'herb' | 'tcdb' | 'spirit_fruit';
  fruitFamily?: PillFamily;
  quantity: number;
  cycleMs: number;
}
export interface SpiritGardenSpecies {
  id: SpiritGardenSpeciesId;
  name: string;
  description: string;
  element: ElementType;
  matureMs: number;
  branchMs: number;
  evolveMs: number;
  unlockCount: number;
  baseOutput: SpiritGardenOutput;
  branches: Record<
    SpiritGardenBranch,
    { name: string; description: string; output: SpiritGardenOutput }
  >;
}
export interface SpiritGardenProduct {
  speciesId: SpiritGardenSpeciesId;
  name: string;
  description: string;
  element: ElementType;
  kind: 'herb' | 'tcdb' | 'spirit_fruit';
  fruitFamily?: PillFamily;
  quality: Quality;
  quantity: number;
}
export interface SpiritGardenPlant {
  id: string;
  speciesId: SpiritGardenSpeciesId;
  seedName: string;
  quality: Quality;
  activeGrowthMs: number;
  settledAt: number;
  productionMs: number;
  storedProductionMs: number;
  firstYieldGranted: boolean;
  branch: SpiritGardenBranch | null;
  evolved: boolean;
  pending: SpiritGardenProduct[];
}
export interface SpiritGardenPlot {
  index: number;
  plant: SpiritGardenPlant | null;
}
export interface SpiritGardenCodexEntry {
  speciesId: SpiritGardenSpeciesId;
  matured: boolean;
  branches: SpiritGardenBranch[];
  evolved: boolean;
}
export interface SpiritGardenState {
  version: 2;
  plots: SpiritGardenPlot[];
  collection: SpiritGardenPlant[];
  codex: SpiritGardenCodexEntry[];
}
export interface SpiritGardenPlantView extends SpiritGardenPlant {
  speciesName: string;
  description: string;
  stage: 'seedling' | 'mature' | 'nurtured' | 'evolved';
  outputQuality: Quality;
  output: SpiritGardenOutput;
  matureMs: number;
  branchMs: number;
  evolveMs: number;
  nextYieldMs: number;
  canBranch: boolean;
  canEvolve: boolean;
  evolveReason: string | null;
  evolveCost: {
    spiritStones: number;
    materialKind: 'herb';
    materialQuality: Quality;
    quantity: 1;
    minRealm: RealmType;
  };
  storageFull: boolean;
}
