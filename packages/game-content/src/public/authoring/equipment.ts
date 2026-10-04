/** Public authoring/equipment capabilities. Keep implementation files private. */
export { default as EQUIPMENT_EQUIPMENT_SPECIAL_DATA } from '../../equipment/data/equipment-special.json' with { type: 'json' };
export { default as EQUIPMENT_EQUIPMENT_FORGING_SCHEMA } from '../../equipment/data/equipment-forging.schema.json' with { type: 'json' };
export { default as EQUIPMENT_EQUIPMENT_BASE_SCHEMA } from '../../equipment/data/equipment-base.schema.json' with { type: 'json' };
export { compileEquipmentEssence } from '../../equipment/special-compiler.js';
