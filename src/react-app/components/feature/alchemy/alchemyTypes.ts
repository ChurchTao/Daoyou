import type { SectScenePresentation } from '@shared/engine/sect';
import type {
  AlchemyFormula,
  AlchemyFormulaDiscoveryCandidate,
  AlchemyYieldDisplayProfile,
  FormulaAnalysisResult,
} from '@shared/types/consumable';
import type { Consumable, Material } from '@shared/types/cultivator';

export type AlchemyWorkspacePhase =
  'preparing' | 'observing' | 'firing' | 'result';

export type AlchemyFacilityId = 'cabinet' | 'formulas' | 'guide' | 'furnace';

export type AlchemyFacilityAction =
  | 'improvised'
  | 'formula'
  | 'current'
  | 'materials'
  | 'formula-library'
  | 'guide-basics'
  | 'guide-reference';

export type AlchemySectContext = {
  facilityLevel: number;
  discountPercent: number;
  facilityLabel: string;
  scene: SectScenePresentation;
};

export type PreviewValidation = {
  valid: boolean;
  blockingReason?: string;
  warnings: string[];
};

export type ReadinessState = {
  key: string | null;
  estimatedSpiritStones: number | null;
  estimatedQi: number | null;
  validation: PreviewValidation | null;
  canAfford: boolean;
  error: string | null;
  loading: boolean;
};

export type FormulaProgress = {
  previousLevel: number;
  level: number;
  exp: number;
  gainedExp: number;
  leveledUp: boolean;
};

export type FormulaPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type AlchemyResultState = {
  consumable: Consumable | null;
  consumables: Consumable[];
  craftedConsumables: Consumable[];
  yieldProfile: AlchemyYieldDisplayProfile | null;
  formulaDiscovery: AlchemyFormulaDiscoveryCandidate | null;
  formulaProgress: FormulaProgress | null;
};

export type MaterialDraft = {
  ids: string[];
  map: Record<string, Material>;
  doses: Record<string, number>;
};

export type AlchemyCraftDraft = {
  mode: 'improvised' | 'formula';
  intent: string;
  formula: AlchemyFormula | null;
  materials: MaterialDraft;
};

export type AddMaterialResult = 'added' | 'already-added' | 'limit-reached';

export type FormulaAnalysisState = {
  value: FormulaAnalysisResult | null;
  loading: boolean;
  error: string | null;
  cooldownRemaining: number;
};
