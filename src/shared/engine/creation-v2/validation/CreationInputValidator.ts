import { CREATION_INPUT_CONSTRAINTS } from '../config/CreationBalance';
import { CreationSessionInput } from '../types';

export interface CreationInputValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateCreationInput(
  input: CreationSessionInput,
): CreationInputValidationResult {
  const { materials } = input;
  const {
    minMaterialKinds,
    maxMaterialKinds,
    minQuantityPerMaterial,
    maxQuantityPerMaterial,
  } = CREATION_INPUT_CONSTRAINTS;

  if (materials.length < minMaterialKinds || materials.length > maxMaterialKinds) {
    return {
      valid: false,
      reason: `材料种类数量必须在 ${minMaterialKinds}-${maxMaterialKinds} 之间，当前为 ${materials.length}`,
    };
  }

  for (const material of materials) {
    if (
      material.quantity < minQuantityPerMaterial ||
      material.quantity > maxQuantityPerMaterial
    ) {
      return {
        valid: false,
        reason:
          `材料「${material.name}」数量必须在 ` +
          `${minQuantityPerMaterial}-${maxQuantityPerMaterial} 之间，当前为 ${material.quantity}`,
      };
    }
  }

  return { valid: true };
}
