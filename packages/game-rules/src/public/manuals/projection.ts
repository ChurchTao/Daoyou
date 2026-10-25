/** Public manuals/projection capabilities. Keep implementation files private. */
export { manualAttributeValue } from '../../manuals/attributes.js';
export {
  MAX_MANUALS_PER_SLOT,
  MANUAL_SLOT_REALMS,
  getManualSlotCount,
  manualSlot,
  isAdvancedManual,
  manualLearningSlot,
  manualLearnedSlot,
  canEquipManualInSlot,
  validateManualStateV1,
} from '../../manuals/compiler.js';
export { manualMechanismValue } from '../../manuals/mechanism-value.js';
