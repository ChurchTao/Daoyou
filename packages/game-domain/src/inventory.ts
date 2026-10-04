// 装备槽位
export const EQUIPMENT_SLOT_VALUES = ['weapon', 'armor', 'accessory'] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOT_VALUES)[number];


// 消耗品类型
export const CONSUMABLE_TYPE_VALUES = ['丹药', '符箓', '灵果'] as const;

export type ConsumableType = (typeof CONSUMABLE_TYPE_VALUES)[number];


// 材料类型
export const MATERIAL_TYPE_VALUES = [
  'seed',
  'herb',
  'ore',
  'monster',
  'tcdb',
  'aux',
  'gongfa_manual',
  'skill_manual',
] as const;

export type MaterialType = (typeof MATERIAL_TYPE_VALUES)[number];
