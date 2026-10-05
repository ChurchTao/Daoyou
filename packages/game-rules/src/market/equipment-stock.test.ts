import {
  DAO_EQUIPMENT_SLOTS,
  DAO_WEAPON_TYPES,
  type DaoEquipmentInstanceV1,
} from '@daoyou/game-domain/equipment';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import { describe, expect, it } from 'vitest';
import { compileDaoEquipmentSpecialLoadoutV1 } from '../equipment/compiler.js';
import { InventoryEquipmentSchema } from '../inventory/equipment.js';
import { equipmentRecycleUnitPrice } from '../inventory/recyclePrice.js';
import {
  equipmentMarketPurchasePrice,
  sampleEquipmentMarketStock,
} from './equipment-stock.js';

const input = {
  equipmentLevel: 10,
  seed: 17,
  createdAt: '2026-10-06T00:00:00.000Z',
} as const;

describe('成品道装坊市', () => {
  it('相同输入重现完整货架，不修改输入或共用装备对象', () => {
    const before = structuredClone(input);
    const first = sampleEquipmentMarketStock(input);
    const second = sampleEquipmentMarketStock(input);
    expect(first).toEqual(second);
    expect(input).toEqual(before);
    first[0].instanceData.baseStats[0].value = -1;
    expect(second[0].instanceData.baseStats[0].value).toBeGreaterThan(0);
  });

  it('不同种子改变装备数值和售价，而非只改变身份', () => {
    const facts = (seed: number) =>
      sampleEquipmentMarketStock({ ...input, seed }).map(
        ({ instanceData, price }) => ({
          baseStats: instanceData.baseStats,
          attributeBonuses: instanceData.attributeBonuses,
          essenceIds: instanceData.essenceIds,
          artId: instanceData.artId,
          element: instanceData.element,
          price,
        }),
      );
    expect(facts(1)).not.toEqual(facts(2));
  });

  it.each([10, 30] as const)(
    '%s级每批覆盖九种器形与其余五个槽位',
    (equipmentLevel) => {
      const stock = sampleEquipmentMarketStock({ ...input, equipmentLevel });
      const weapons = stock.filter(
        ({ instanceData }) => instanceData.slot === 'weapon',
      );
      expect(stock).toHaveLength(14);
      expect(
        new Set(stock.map(({ instanceData }) => instanceData.id)).size,
      ).toBe(14);
      expect(
        weapons.map(({ instanceData }) => instanceData.weaponType),
      ).toEqual(DAO_WEAPON_TYPES);
      for (const slot of DAO_EQUIPMENT_SLOTS.filter(
        (entry) => entry !== 'weapon',
      ))
        expect(
          stock.filter(({ instanceData }) => instanceData.slot === slot),
        ).toHaveLength(1);
    },
  );

  it.each([
    [10, '炼气', 4500, 5500],
    [30, '筑基', 14000, 17000],
  ] as const)(
    '%s级货品在%s初期可用，完整生成属性且价格不越界',
    (equipmentLevel, realm, min, max) => {
      const requiredLevel = getRealmStageLevel(realm, '初期');
      for (const seed of [0, 1, 17, 72, 0xffffffff]) {
        const stock = sampleEquipmentMarketStock({
          ...input,
          equipmentLevel,
          seed,
        });
        for (const { instanceData, price } of stock) {
          expect(instanceData.equipmentLevel).toBe(equipmentLevel);
          expect(instanceData.requiredLevel).toBe(requiredLevel);
          expect(instanceData.generatorVersion).toBe(
            'dao_equipment_generator_v5',
          );
          expect(instanceData.baseQuality).toBe(0);
          expect(instanceData.desc).toBeUndefined();
          expect(InventoryEquipmentSchema.parse(instanceData)).toEqual(
            instanceData,
          );
          expect(
            compileDaoEquipmentSpecialLoadoutV1(
              { [instanceData.slot]: instanceData as DaoEquipmentInstanceV1 },
              requiredLevel,
            ).ok,
          ).toBe(true);
          expect(Number.isInteger(price)).toBe(true);
          expect(price).toBeGreaterThanOrEqual(min);
          expect(price).toBeLessThanOrEqual(max);
        }
      }
    },
  );

  it.each([10, 30] as const)('%s级折后售价始终高于回收价', (equipmentLevel) => {
    const basePrice = equipmentLevel === 10 ? 4500 : 14000;
    const recyclePrice = equipmentRecycleUnitPrice({ equipmentLevel });
    expect(equipmentMarketPurchasePrice(basePrice, equipmentLevel)).toBe(
      basePrice,
    );
    expect(equipmentMarketPurchasePrice(basePrice, equipmentLevel, 0.8)).toBe(
      Math.floor(basePrice * 0.8),
    );
    for (const multiplier of [0.5, 0, -1]) {
      const price = equipmentMarketPurchasePrice(
        basePrice,
        equipmentLevel,
        multiplier,
      );
      expect(price).toBe(recyclePrice + 1);
      expect(price).toBeGreaterThan(recyclePrice);
    }
    expect(equipmentMarketPurchasePrice(basePrice, equipmentLevel, 1.5)).toBe(
      Math.round(basePrice * 1.5),
    );
  });

  it.each([-1, 1.5, 0x100000000, NaN])('拒绝非法货架种子%s', (seed) => {
    expect(() => sampleEquipmentMarketStock({ ...input, seed })).toThrow(
      '货架种子',
    );
  });
});
