import type { DaoEquipmentSlot } from '@shared/engine/combat-v6/equipment/types';
import { CULTIVATION_BOOST_STATUS_KEY } from '@shared/lib/cultivationBoost';
import {
  QUALITY_ORDER,
  type ElementType,
  type MaterialType,
  type Quality,
} from '@shared/types/constants';
import type {
  PillAppearanceGrade,
  PillFamily,
  PillSpec,
} from '@shared/types/consumable';
import type {
  SectDeliveryRequirement,
  SectMaterialDeliveryRequirement,
  SectPillTraitKey,
} from './taskRequirements';

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

const APPEARANCE_ORDER: Record<PillAppearanceGrade, number> = {
  low: 0,
  middle: 1,
  high: 2,
  perfect: 3,
};

export function projectSectPillTraits(
  spec: Pick<PillSpec, 'operations'>,
): SectPillTraitKey[] {
  const traits = new Set<SectPillTraitKey>();
  for (const operation of spec.operations) {
    if (operation.type === 'restore_resource')
      traits.add(operation.resource === 'hp' ? 'restore_hp' : 'restore_mp');
    else if (
      operation.type === 'change_gauge' &&
      operation.gauge === 'pillToxicity' &&
      operation.delta < 0
    )
      traits.add('detox');
    else if (operation.type === 'gain_progress')
      traits.add(
        operation.target === 'cultivation_exp'
          ? 'gain_cultivation'
          : 'gain_insight',
      );
    else if (operation.type === 'increase_lifespan')
      traits.add('increase_lifespan');
    else if (operation.type === 'advance_track')
      traits.add(
        operation.track === 'marrow_wash' ? 'marrow_wash' : 'tempering',
      );
    else if (operation.type === 'add_status') {
      if (operation.status === CULTIVATION_BOOST_STATUS_KEY)
        traits.add('gain_cultivation');
      else if (
        ['breakthrough_focus', 'protect_meridians', 'clear_mind'].includes(
          operation.status,
        )
      )
        traits.add('breakthrough_support');
    }
  }
  return [...traits];
}

export function matchSectDeliveryRequirement(
  requirement: SectDeliveryRequirement,
  candidate: SectSubmissionItemFacts,
): DeliveryMatchResult {
  const violations: SectDeliveryViolation[] = [];
  const add = (code: SectDeliveryViolationCode, message: string) =>
    violations.push({ code, message });

  if (candidate.kind !== requirement.kind) {
    add('wrong_kind', '物品类型与委托要求不符');
    return { eligible: false, violations };
  }
  if (
    candidate.kind !== 'equipment' &&
    requirement.kind !== 'equipment' &&
    QUALITY_ORDER[candidate.quality] < QUALITY_ORDER[requirement.minQuality]
  )
    add('quality_too_low', `品质低于${requirement.minQuality}`);
  if (candidate.quantity < requirement.quantity)
    add('quantity_too_low', `数量不足 ${requirement.quantity}`);

  if (requirement.kind === 'pill' && candidate.kind === 'pill') {
    // family records the dominant intent; compound-pill eligibility follows
    // the effects actually projected from operations.
    const hasRequiredTrait = candidate.traits.includes(requirement.trait);
    if (!hasRequiredTrait && candidate.family !== requirement.family)
      add('wrong_family', '丹药主类别不符合要求');
    if (!hasRequiredTrait) add('missing_trait', '丹药不具备指定功效');
    const actual = candidate.appearance;
    const matches =
      actual !== undefined &&
      (requirement.appearance.mode === 'exact'
        ? actual === requirement.appearance.grade
        : APPEARANCE_ORDER[actual] >=
          APPEARANCE_ORDER[requirement.appearance.grade]);
    if (!matches) add('appearance_mismatch', '丹药品相不符合要求');
  } else if (
    requirement.kind === 'equipment' &&
    candidate.kind === 'equipment'
  ) {
    if (candidate.isEquipped) add('item_equipped', '已装备道装不能提交');
    if (candidate.slot !== requirement.slot)
      add('wrong_slot', '道装部位不符合要求');
    if (candidate.equipmentLevel < requirement.minEquipmentLevel)
      add('level_too_low', `道装等级低于 ${requirement.minEquipmentLevel} 级`);
  } else if (requirement.kind === 'material' && candidate.kind === 'material') {
    if (candidate.materialType !== requirement.materialType)
      add('wrong_material_type', '材料类型不符合要求');
    if (requirement.element && candidate.element !== requirement.element)
      add('wrong_element', '材料属性不符合要求');
  }

  return { eligible: violations.length === 0, violations };
}

export function matchSectDeliveryCandidate(
  requirement: SectDeliveryRequirement,
  candidate: SectSubmissionItemFacts,
): DeliveryMatchResult {
  return matchSectDeliveryRequirement(
    requirement.kind === 'material'
      ? { ...requirement, quantity: 1 }
      : requirement,
    candidate,
  );
}

export function matchSectMaterialDeliverySelection(
  requirement: SectMaterialDeliveryRequirement,
  selections: readonly SectMaterialDeliverySelection[],
): DeliveryMatchResult {
  const violations: SectDeliveryViolation[] = [];
  const ids = new Set<string>();
  let total = 0;

  for (const selection of selections) {
    if (ids.has(selection.item.id)) {
      violations.push({
        code: 'duplicate_item',
        message: '同一份材料不能重复选择',
      });
      continue;
    }
    ids.add(selection.item.id);

    if (!Number.isInteger(selection.quantity) || selection.quantity <= 0) {
      violations.push({
        code: 'invalid_quantity',
        message: '材料提交数量无效',
      });
      continue;
    }
    total += selection.quantity;
    if (selection.quantity > selection.item.quantity) {
      violations.push({
        code: 'quantity_too_high',
        message: `${selection.item.name}数量不足`,
      });
    }
    violations.push(
      ...matchSectDeliveryCandidate(requirement, selection.item).violations,
    );
  }

  if (total !== requirement.quantity) {
    violations.push({
      code: 'total_mismatch',
      message: `所选材料总数须为 ${requirement.quantity}`,
    });
  }

  return { eligible: violations.length === 0, violations };
}
