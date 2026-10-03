import {
  ALCHEMY_ALLOWED_MATERIAL_TYPES,
  type AlchemyMaterialType,
} from '@daoyou/shared/config/alchemyConfig';
import type { MaterialType } from '@daoyou/shared/types/constants';

const ALCHEMY_ALLOWED_MATERIAL_TYPE_SET = new Set<MaterialType>(
  ALCHEMY_ALLOWED_MATERIAL_TYPES,
);

export type { AlchemyMaterialType };

export function isAlchemyMaterialType(
  type: MaterialType,
): type is AlchemyMaterialType {
  return ALCHEMY_ALLOWED_MATERIAL_TYPE_SET.has(type);
}
