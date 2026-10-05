import { SeededRng } from '@daoyou/combat-core/rng';
import {
  DAO_EQUIPMENT_TEMPLATE_ID,
  DAO_EQUIPMENT_TEMPLATES_V1,
} from '@daoyou/game-content/equipment/base';
import {
  DAO_WEAPON_TYPES,
  type InventoryEquipment,
} from '@daoyou/game-domain/equipment';
import { scaleFateAdjustedCost } from '../character/fates.js';
import { generateForgedEquipment } from '../equipment/forging.js';
import { equipmentRecycleUnitPrice } from '../inventory/recyclePrice.js';

const prices = {
  10: { min: 4500, max: 5500 },
  30: { min: 14000, max: 17000 },
} as const;

export function sampleEquipmentMarketStock(input: {
  equipmentLevel: 10 | 30;
  seed: number;
  createdAt: string;
}): Array<{ instanceData: InventoryEquipment; price: number }> {
  if (
    !Number.isInteger(input.seed) ||
    input.seed < 0 ||
    input.seed > 0xffffffff
  )
    throw new Error('坊市货架种子必须为无符号32位整数');
  const rng = new SeededRng(input.seed);
  const range = prices[input.equipmentLevel];
  const entries = [
    ...DAO_WEAPON_TYPES.map((weaponType) => ({
      templateId: DAO_EQUIPMENT_TEMPLATE_ID.Weapon,
      weaponType,
    })),
    ...DAO_EQUIPMENT_TEMPLATES_V1.filter(
      (template) => template.slot !== 'weapon',
    ).map((template) => ({ templateId: template.id, weaponType: undefined })),
  ];
  return entries.map(({ templateId, weaponType }, index) => {
    const generated = generateForgedEquipment({
      id: `market-equipment-${input.equipmentLevel}-${input.seed}-${index}`,
      templateId,
      equipmentLevel: input.equipmentLevel,
      seed: Math.floor(rng.next() * 0x100000000),
      createdAt: input.createdAt,
      weaponType,
      baseQuality: 0,
      boosts: { ore: 0, essence: 0, attributes: 0 },
    });
    if (!generated.ok)
      throw new Error(
        generated.diagnostics.map((entry) => entry.message).join('；'),
      );
    return {
      instanceData: generated.instance,
      price: range.min + Math.floor(rng.next() * (range.max - range.min + 1)),
    };
  });
}

export function equipmentMarketPurchasePrice(
  basePrice: number,
  equipmentLevel: number,
  multiplier = 1,
): number {
  return Math.max(
    equipmentRecycleUnitPrice({ equipmentLevel }) + 1,
    scaleFateAdjustedCost(basePrice, multiplier),
  );
}
