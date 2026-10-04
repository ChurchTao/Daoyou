import {
  ALCHEMY_ALLOWED_MATERIAL_TYPES,
  type AlchemyMaterialType,
} from '@daoyou/game-content/alchemy';
import type { MaterialType } from '@daoyou/game-domain/inventory';

const ALCHEMY_ALLOWED_MATERIAL_TYPE_SET = new Set<MaterialType>(
  ALCHEMY_ALLOWED_MATERIAL_TYPES,
);

export type { AlchemyMaterialType };

export function isAlchemyMaterialType(
  type: MaterialType,
): type is AlchemyMaterialType {
  return ALCHEMY_ALLOWED_MATERIAL_TYPE_SET.has(type);
}
