import { describe, expect, it } from 'vitest';
import { compileDaoEquipmentSpecialLoadoutV1 } from '../equipment/compiler.js';
import { generateForgedEquipment, rollHigher } from '../equipment/forging.js';
import { DAO_EQUIPMENT_SLOTS } from '@daoyou/game-domain/equipment';
import { MaterialFactsSchema } from '@daoyou/game-domain/inventory';
import { forgingBaseQuality, forgingBoosts, forgingCost } from './rules.js';

const facts = MaterialFactsSchema.parse({
  name: '玄铁',
  type: 'ore',
  rank: '地品',
});
describe('blueprint forging', () => {
  it('charges fixed costs at tier boundaries', () => {
    expect(forgingCost(10)).toEqual({
      spiritStones: 100,
      qi: 7,
      quantity: 1,
      rank: '凡品',
      enhanceRankSteps: 2,
    });
    expect(forgingCost(30).quantity).toBe(1);
    expect(forgingCost(50).rank).toBe('灵品');
    expect(forgingCost(50)).toEqual({
      spiritStones: 2500,
      qi: 15,
      quantity: 2,
      rank: '灵品',
      enhanceRankSteps: 2,
    });
    expect(forgingCost(170)).toEqual({
      spiritStones: 45156,
      qi: 39,
      quantity: 5,
      rank: '天品',
      enhanceRankSteps: 2,
    });
    expect(() => forgingCost(15)).toThrow();
    expect(forgingCost(110).spiritStones).toBe(18906);
    expect(forgingCost(130).spiritStones).toBe(26406);
    expect(forgingCost(150).spiritStones).toBe(35156);
  });
  it('高阶最低品质上移两阶内顶满，渡劫天品起步、神品顶满', () => {
    const pile = (
      level: number,
      rank: '玄品' | '真品' | '地品' | '天品' | '仙品' | '神品',
    ) => {
      const quantity = forgingCost(level).quantity;
      return [{ facts: { ...facts, rank }, quantity }];
    };
    expect(forgingBaseQuality(90, pile(90, '地品'))).toBe(1);
    expect(() => forgingBaseQuality(110, pile(110, '玄品'))).toThrow('真品');
    expect(forgingBaseQuality(110, pile(110, '真品'))).toBe(0);
    expect(forgingBaseQuality(110, pile(110, '地品'))).toBe(0.5);
    expect(forgingBaseQuality(110, pile(110, '天品'))).toBe(1);
    expect(() => forgingBaseQuality(130, pile(130, '真品'))).toThrow('地品');
    expect(forgingBaseQuality(130, pile(130, '天品'))).toBe(0.5);
    expect(forgingBaseQuality(130, pile(130, '仙品'))).toBe(1);
    expect(forgingBaseQuality(150, pile(150, '天品'))).toBe(0.5);
    expect(forgingBaseQuality(150, pile(150, '仙品'))).toBe(1);
    expect(() => forgingBaseQuality(170, pile(170, '地品'))).toThrow('天品');
    expect(forgingBaseQuality(170, pile(170, '仙品'))).toBe(0.5);
    expect(forgingBaseQuality(170, pile(170, '神品'))).toBe(1);
    expect(forgingBoosts(170, 165, pile(170, '神品'))).toEqual({
      ore: 5,
      essence: 0,
      attributes: 0,
    });
    expect(() => forgingBoosts(170, 160, pile(170, '神品'))).toThrow(
      '人物境界',
    );
  });
  it('rejects overlevel, excessive, insufficient and under-quality inputs', () => {
    expect(() => forgingBoosts(30, 20, [{ facts, quantity: 1 }])).toThrow(
      '人物境界',
    );
    expect(() => forgingBoosts(10, 20, [{ facts, quantity: 2 }])).toThrow(
      '恰好',
    );
    expect(() => forgingBoosts(10, 20, [])).toThrow('恰好');
    expect(() =>
      forgingBoosts(90, 180, [
        { facts: { ...facts, rank: '凡品' }, quantity: 3 },
      ]),
    ).toThrow('品质');
    expect(() =>
      forgingBoosts(10, 20, [
        { facts: { ...facts, type: 'herb' }, quantity: 1 },
      ]),
    ).toThrow('不能用于铸造');
    expect(
      MaterialFactsSchema.safeParse({ ...facts, type: 'seed' }).success,
    ).toBe(false);
  });
  it('groups aux and monster together without quality multipliers', () => {
    expect(
      forgingBoosts(90, 180, [
        { facts: { ...facts, type: 'aux' }, quantity: 1 },
        { facts: { ...facts, type: 'monster', rank: '神品' }, quantity: 2 },
      ]),
    ).toEqual({ ore: 0, essence: 0, attributes: 3 });
  });
  it('uses the exact 1.8% boundary and never decreases a roll', () => {
    expect(
      rollHigher(
        10,
        0.018,
        () => 0.0179,
        () => 20,
      ),
    ).toBe(20);
    expect(
      rollHigher(
        10,
        0.018,
        () => 0.018,
        () => 20,
      ),
    ).toBe(10);
    expect(
      rollHigher(
        10,
        0.09,
        () => 0,
        () => 5,
      ),
    ).toBe(10);
  });
  it.each(DAO_EQUIPMENT_SLOTS)('material boosts keep %s rolls and loadout legal', (slot) => {
    const input = {
      id: `forge-${slot}`,
      createdAt: '2026-09-07T00:00:00Z',
      seed: 17,
      templateId: `dao_equipment.standard.${slot}.v1`,
      equipmentLevel: 90,
    };
    const base = generateForgedEquipment({
      ...input,
      boosts: { ore: 0, essence: 0, attributes: 0 },
    });
    const boosted = generateForgedEquipment({
      ...input,
      boosts: { ore: 2, essence: 1, attributes: 2 },
    });
    if (!base.ok || !boosted.ok) throw new Error('锻造失败');
    expect(boosted.instance.artId).toBe(base.instance.artId);
    expect(boosted.instance.essenceIds).toEqual(expect.arrayContaining(base.instance.essenceIds));
    for (const key of ['baseStats', 'attributeBonuses'] as const) {
      expect(boosted.instance[key].map(({ attr }) => attr)).toEqual(
        base.instance[key].map(({ attr }) => attr),
      );
      boosted.instance[key].forEach(({ value }, index) => {
        expect(value).toBeGreaterThanOrEqual(base.instance[key][index].value);
      });
    }
    expect(compileDaoEquipmentSpecialLoadoutV1({ [slot]: boosted.instance }, 180).ok).toBe(true);
  });
});
