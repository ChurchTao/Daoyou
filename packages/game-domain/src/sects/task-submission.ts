import type { DaoEquipmentSlot } from '../equipment/types.js';
import type { ElementType } from '@daoyou/constants/elements';
import type { Quality } from '@daoyou/constants/qualities';
import type { MaterialType } from '../inventory.js';
import type { PillFamily, PillAppearanceGrade } from '../consumable.js';
import type { SectPillTraitKey } from './task-requirements.js';

export interface SectPillSubmissionFacts {
  kind: 'pill';
  id: string;
  name: string;
  quality: Quality;
  quantity: number;
  family: PillFamily;
  appearance?: PillAppearanceGrade;
  traits: SectPillTraitKey[];
}

export interface SectEquipmentSubmissionFacts {
  kind: 'equipment';
  id: string;
  name: string;
  quantity: 1;
  slot: DaoEquipmentSlot;
  equipmentLevel: number;
  isEquipped: boolean;
}

export interface SectMaterialSubmissionFacts {
  kind: 'material';
  id: string;
  name: string;
  quality: Quality;
  quantity: number;
  materialType: MaterialType;
  element?: ElementType;
}

export type SectSubmissionItemFacts =
  | SectPillSubmissionFacts
  | SectEquipmentSubmissionFacts
  | SectMaterialSubmissionFacts;

export type SectDeliveryViolationCode =
  | 'wrong_kind'
  | 'quality_too_low'
  | 'quantity_too_low'
  | 'duplicate_item'
  | 'invalid_quantity'
  | 'quantity_too_high'
  | 'total_mismatch'
  | 'wrong_family'
  | 'missing_trait'
  | 'appearance_mismatch'
  | 'wrong_slot'
  | 'level_too_low'
  | 'wrong_material_type'
  | 'wrong_element'
  | 'item_equipped';

export interface SectDeliveryViolation {
  code: SectDeliveryViolationCode;
  message: string;
}

export interface DeliveryMatchResult {
  eligible: boolean;
  violations: SectDeliveryViolation[];
}

export interface SectMaterialDeliverySelection {
  item: SectMaterialSubmissionFacts;
  quantity: number;
}
