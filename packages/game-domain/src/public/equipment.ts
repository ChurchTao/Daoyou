/** Public equipment capabilities. Keep implementation files private. */
export {
  DAO_EQUIPMENT_GENERATOR_VERSION,
  DAO_EQUIPMENT_GENERATOR_VERSION_V2,
  DAO_EQUIPMENT_GENERATOR_VERSION_V3,
  DAO_EQUIPMENT_GENERATOR_VERSION_V4,
  DAO_EQUIPMENT_GENERATOR_VERSION_V5,
  DAO_EQUIPMENT_SLOTS,
} from '../equipment/types.js';
export type {
  CombatV6PanelAttr,
  CompileDaoEquipmentLoadoutV1Result,
  CompileDaoEquipmentSpecialLoadoutV1Result,
  DaoEquipmentArtDefV1,
  DaoEquipmentAttribute,
  DaoEquipmentAttributeRoll,
  DaoEquipmentEssenceDefV1,
  DaoEquipmentGenerationResult,
  DaoEquipmentGeneratorVersion,
  DaoEquipmentInstanceV1,
  DaoEquipmentLoadoutV1,
  DaoEquipmentPanelRoll,
  DaoEquipmentProjectionV1,
  DaoEquipmentSlot,
  DaoEquipmentSpecialProjectionV1,
  DaoEquipmentTemplateV1,
  DaoFormationInscriptionDefV1,
  DaoFormationInscriptionStateV1,
  GenerateDaoEquipmentV1Input,
  GenerateDaoEquipmentV2Input,
} from '../equipment/types.js';
export {
  DAO_WEAPON_TYPES,
  daoWeaponTypeOf,
  equipmentWeaponTypeProblem,
} from '../equipment/weapons.js';
export type { DaoWeaponType } from '../equipment/weapons.js';
export {
  EquipmentCrafterNameSchema,
  FORGE_INTENT_MAX_LENGTH,
  ForgeIntentSchema,
  ForgedEquipmentCopySchema,
  ForgedEquipmentDescSchema,
  ForgedEquipmentNameSchema,
} from '../equipment/narrative.js';
export {
  EQUIPMENT_LEVELS,
  OPEN_EQUIPMENT_LEVELS,
  isEquipmentLevel,
  isOpenEquipmentLevel,
} from '../equipment/levels.js';
export {
  DAO_EQUIPMENT_ESSENCE_ID,
  DAO_RAGE_PASSIVE_ID,
  DAO_RAGE_RESOURCE_ID,
} from '../equipment/special-ids.js';
export { EQUIPMENT_SLOT_NAMES } from '../equipment/slot-names.js';
export { FormationInscriptionsSchema } from '../equipment/inscriptions.js';
export {
  EQUIPMENT_ATTRIBUTE_NAMES,
  createInventoryEquipmentSchema,
} from '../equipment/inventory.js';
export type { InventoryEquipment } from '../equipment/inventory.js';
export { ForgingLevelSchema } from '../equipment/forging-level.js';
