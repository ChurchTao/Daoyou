import { describe, expect, it } from 'vitest';
import { RecycleRequestSchema } from '../contracts/recycle';
import { generateForgedEquipment } from '../engine/combat-v6/equipment/forging';
import { buildSpiritFieldSeedDetails } from '../engine/spirit-field/seedMaterial';
import type { SpiritFieldPlantSnapshot } from '../engine/spirit-field/types';
import { consumableFactsOf } from '../items/definitions/consumables';
import { seedFactsOf } from '../items/definitions/seeds';
import type { Consumable } from '../types/cultivator';
import { recycleBlockingReason } from './recycle';
import {
  blueprintRecycleUnitPrice,
  equipmentRecycleUnitPrice,
  manualJadeRecycleUnitPrice,
  seedRecycleUnitPrice,
} from './recyclePrice';

describe('回收边界', () => {
  it('允许随身和储藏室的灵果回收', () => {
    const fruit: Consumable = {
      name: '青露灵果',
      type: '灵果',
      quality: '玄品',
      quantity: 1,
      spec: {
        kind: 'spirit_fruit',
        family: 'healing',
        operations: [
          {
            type: 'restore_resource',
            resource: 'hp',
            mode: 'percent',
            value: 0.08,
          },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        source: { kind: 'spirit_field', version: 1 },
      },
    };
    const item = {
      id: 'fruit',
      definitionId: 'consumable.v1',
      instanceData: consumableFactsOf(fruit),
      location: 'bag' as const,
    };
    expect(recycleBlockingReason(item)).toBeNull();
    expect(recycleBlockingReason({ ...item, location: 'storage' })).toBeNull();
  });

  it('同一选择不能通过重复行超过单格数量', () => {
    const item = { id: 'stack', revision: 2, quantity: 60 };
    expect(
      RecycleRequestSchema.safeParse({ phase: 'preview', items: [item, item] })
        .success,
    ).toBe(false);
    for (const quantity of [0, -1, 1.5, 100]) {
      expect(
        RecycleRequestSchema.safeParse({
          phase: 'preview',
          items: [{ ...item, quantity }],
        }).success,
      ).toBe(false);
    }
  });
  it('允许同一物品事实的不同格位分别选量，不接受客户端价格', () => {
    const items = [
      { id: 'stack-a', revision: 1, quantity: 2 },
      { id: 'stack-b', revision: 3, quantity: 1 },
    ];
    expect(
      RecycleRequestSchema.safeParse({ phase: 'preview', items }).success,
    ).toBe(true);
    expect(
      RecycleRequestSchema.safeParse({ phase: 'preview', items, total: 999999 })
        .success,
    ).toBe(false);
  });
  it('实例材料允许随身和储藏室回收', () => {
    const item = {
      id: 'material',
      definitionId: 'material.v1',
      instanceData: { name: '玄铁', type: 'ore', rank: '凡品' },
    };
    expect(recycleBlockingReason({ ...item, location: 'bag' })).toBeNull();
    expect(recycleBlockingReason({ ...item, location: 'storage' })).toBeNull();
  });
  it('合法灵种与功法玉简可以回收，损坏事实仍被拒绝', () => {
    const plant: SpiritFieldPlantSnapshot = {
      id: 'recycle-seed',
      seedName: '青露种',
      seedDescription: '可培育灵果。',
      clueTexts: [],
      quality: '玄品',
      element: '木',
      minRealm: '炼气',
      growthForm: 'shrub',
      harvestPart: 'fruit',
      preferredMethods: [],
      avoidedMethods: [],
      preferredHabitats: [],
      avoidedHabitats: [],
      growthTraits: [],
      useTags: [],
      outcomeBiases: [],
      creationTags: [],
      stageDurationMs: {
        germination: 60_000,
        nourishing: 60_000,
        forming: 60_000,
      },
      baseYieldMin: 1,
      baseYieldMax: 2,
    };
    const seed = {
      id: 'seed',
      definitionId: 'seed.v1',
      location: 'bag' as const,
      instanceData: seedFactsOf({
        type: 'seed',
        rank: '玄品',
        details: buildSpiritFieldSeedDetails(plant),
      }),
    };
    expect(recycleBlockingReason(seed)).toBeNull();
    expect(seedRecycleUnitPrice('玄品')).toBe(300);
    expect(recycleBlockingReason({ ...seed, instanceData: {} })).not.toBeNull();
    const jade = {
      id: 'jade',
      definitionId: 'jade.character_manual.changchun',
      location: 'bag' as const,
      instanceData: null,
    };
    expect(recycleBlockingReason(jade)).toBeNull();
    expect(manualJadeRecycleUnitPrice('character_manual.changchun')).toBe(45);
    expect(recycleBlockingReason({ ...jade, location: 'storage' })).toBeNull();
    expect(recycleBlockingReason({ ...jade, instanceData: {} })).not.toBeNull();
  });
  it('背包图纸与有效未穿戴道装可以回收，报价按铸造成本计算', () => {
    const blueprint = {
      id: 'blueprint',
      definitionId: 'blueprint.weapon.10',
      location: 'bag' as const,
      instanceData: null,
    };
    expect(recycleBlockingReason(blueprint)).toBeNull();
    expect(blueprintRecycleUnitPrice(10)).toBe(20);
    expect(recycleBlockingReason({ ...blueprint, location: 'storage' })).toBeNull();
    const generated = generateForgedEquipment({
      id: 'equipment',
      createdAt: '2026-09-25T00:00:00Z',
      seed: 42,
      templateId: 'dao_equipment.standard.weapon.v1',
      equipmentLevel: 10,
      boosts: { ore: 1, essence: 0, attributes: 0 },
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const equipment = {
      id: 'equipment',
      definitionId: 'equipment.v6',
      location: 'bag' as const,
      instanceData: generated.instance,
    };
    expect(recycleBlockingReason(equipment)).toBeNull();
    expect(
      equipmentRecycleUnitPrice({ equipmentLevel: 10, baseQuality: 0 }),
    ).toBe(50);
    expect(
      equipmentRecycleUnitPrice({ equipmentLevel: 10, baseQuality: 1 }),
    ).toBe(75);
    expect(
      recycleBlockingReason({ ...equipment, location: 'equipped' }),
    ).not.toBeNull();
    expect(recycleBlockingReason({ ...equipment, id: 'other' })).not.toBeNull();
  });
  it('不把未知定义或损坏的道装、消耗品当作可回收物品', () => {
    for (const definitionId of ['equipment.v6', 'unknown', 'consumable.v1']) {
      expect(
        recycleBlockingReason({
          id: 'invalid',
          definitionId,
          location: 'bag',
          instanceData: {},
        }),
      ).not.toBeNull();
    }
    expect(
      recycleBlockingReason({
        id: 'blueprint',
        definitionId: 'blueprint.weapon.10',
        location: 'bag',
        instanceData: {},
      }),
    ).not.toBeNull();
  });
});
