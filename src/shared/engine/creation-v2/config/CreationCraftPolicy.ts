import {
  MATERIAL_TYPE_VALUES,
  type MaterialType,
} from '@shared/types/constants';
import type { CreationProductType } from '../types';

export const CREATION_CRAFT_TYPES = [
  'refine',
  'create_skill',
  'create_gongfa',
] as const;

export type CreationCraftType = (typeof CREATION_CRAFT_TYPES)[number];

export const CREATION_PRODUCT_TYPE_BY_CRAFT_TYPE = {
  refine: 'artifact',
  create_skill: 'skill',
  create_gongfa: 'gongfa',
} as const satisfies Record<CreationCraftType, CreationProductType>;

export const CREATION_ALLOWED_MATERIAL_TYPES_BY_PRODUCT = {
  artifact: ['ore', 'monster', 'tcdb', 'aux'],
  skill: ['herb', 'monster', 'tcdb', 'aux', 'skill_manual'],
  gongfa: ['herb', 'monster', 'tcdb', 'aux', 'gongfa_manual'],
} as const satisfies Record<CreationProductType, readonly MaterialType[]>;

export const CREATION_MATCHING_MANUAL_TYPE_BY_PRODUCT = {
  skill: 'skill_manual',
  gongfa: 'gongfa_manual',
} as Partial<Record<CreationProductType, MaterialType>>;

const CREATION_ALLOWED_MATERIAL_TYPE_SETS: Record<
  CreationProductType,
  ReadonlySet<MaterialType>
> = {
  artifact: new Set(CREATION_ALLOWED_MATERIAL_TYPES_BY_PRODUCT.artifact),
  skill: new Set(CREATION_ALLOWED_MATERIAL_TYPES_BY_PRODUCT.skill),
  gongfa: new Set(CREATION_ALLOWED_MATERIAL_TYPES_BY_PRODUCT.gongfa),
};

export function isCreationCraftType(value: string): value is CreationCraftType {
  return (CREATION_CRAFT_TYPES as readonly string[]).includes(value);
}

export function getCreationProductTypeFromCraftType(
  craftType: string,
): CreationProductType | undefined {
  if (!isCreationCraftType(craftType)) {
    return undefined;
  }

  return CREATION_PRODUCT_TYPE_BY_CRAFT_TYPE[craftType];
}

export function getAllowedMaterialTypesForProduct(
  productType: CreationProductType,
): readonly MaterialType[] {
  return CREATION_ALLOWED_MATERIAL_TYPES_BY_PRODUCT[productType];
}

export function getAllowedMaterialTypesForCraftType(
  craftType: CreationCraftType,
): readonly MaterialType[] {
  return getAllowedMaterialTypesForProduct(
    CREATION_PRODUCT_TYPE_BY_CRAFT_TYPE[craftType],
  );
}

export function getForbiddenMaterialTypesForProduct(
  productType: CreationProductType,
): MaterialType[] {
  const allowed = CREATION_ALLOWED_MATERIAL_TYPE_SETS[productType];
  return MATERIAL_TYPE_VALUES.filter((materialType) => !allowed.has(materialType));
}

export function isMaterialTypeAllowedForProduct(
  productType: CreationProductType,
  materialType: MaterialType,
): boolean {
  return CREATION_ALLOWED_MATERIAL_TYPE_SETS[productType].has(materialType);
}

export function getMatchingManualTypeForProduct(
  productType: CreationProductType,
): MaterialType | undefined {
  return CREATION_MATCHING_MANUAL_TYPE_BY_PRODUCT[productType];
}

export function hasMatchingManualForProduct(
  productType: CreationProductType,
  materialTypes: Iterable<MaterialType>,
): boolean {
  const matchingManualType = getMatchingManualTypeForProduct(productType);
  if (!matchingManualType) {
    return false;
  }

  for (const materialType of materialTypes) {
    if (materialType === matchingManualType) {
      return true;
    }
  }

  return false;
}

export function hasMissingMatchingManualForProduct(
  productType: CreationProductType,
  materialTypes: Iterable<MaterialType>,
): boolean {
  const matchingManualType = getMatchingManualTypeForProduct(productType);
  if (!matchingManualType) {
    return false;
  }

  return !hasMatchingManualForProduct(productType, materialTypes);
}