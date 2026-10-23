/** Public equipment/projection capabilities. Keep implementation files private. */
export {
  compileDaoEquipmentSpecialLoadoutV1,
  daoEquipmentRequiredLevel,
} from '../../equipment/compiler.js';
export type { CompileDaoEquipmentSpecialOptions } from '../../equipment/compiler.js';
export { daoFormationMaxLevel } from '../../equipment/inscriptions.js';

export {
  equipmentRollDifference,
  previewEquipmentReplacement,
} from '../../equipment/preview.js';
export type { EquipmentReplacementPreview } from '../../equipment/preview.js';
