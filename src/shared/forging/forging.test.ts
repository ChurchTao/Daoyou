import { describe, expect, it } from 'vitest';
import { allowsLocalDevTools } from '../config/deployment';
import { compileDaoEquipmentSpecialLoadoutV1 } from '../engine/combat-v6/equipment/compiler';
import {
  generateForgedEquipment,
  rollHigher,
} from '../engine/combat-v6/equipment/forging';
import { generateDaoEquipmentV2 } from '../engine/combat-v6/equipment/generator';
import { DAO_EQUIPMENT_SLOTS } from '../engine/combat-v6/equipment/types';
import { addItems, sameStack, sortBag } from '../inventory';
import { BLUEPRINTS } from '../items/definitions/equipment-blueprints';
import { MaterialFactsSchema } from '../items/definitions/materials';
import { forgedName } from './names';
import { forgingBoosts, forgingCost } from './rules';

const facts = MaterialFactsSchema.parse({
  name: '玄铁',
  type: 'ore',
  rank: '地品',
});
describe('blueprint forging', () => {
  it('registers unique blueprints for all slots and levels', () => {
    expect(BLUEPRINTS).toHaveLength(108);
    expect(new Set(BLUEPRINTS.map((b) => b.id)).size).toBe(108);
  });
  it('charges fixed costs at tier boundaries', () => {
    expect(forgingCost(10)).toEqual({
      spiritStones: 100,
      qi: 7,
      quantity: 1,
      rank: '凡品',
    });
    expect(forgingCost(40).quantity).toBe(1);
    expect(forgingCost(50).rank).toBe('灵品');
    expect(forgingCost(60)).toEqual({
      spiritStones: 3600,
      qi: 17,
      quantity: 2,
      rank: '灵品',
    });
    expect(forgingCost(180)).toEqual({
      spiritStones: 32400,
      qi: 41,
      quantity: 5,
      rank: '地品',
    });
    expect(() => forgingCost(15)).toThrow();
  });
  it('rejects overlevel, excessive, insufficient and under-quality inputs', () => {
    expect(() => forgingBoosts(20, 19, [{ facts, quantity: 1 }])).toThrow(
      '人物等级',
    );
    expect(() => forgingBoosts(20, 20, [{ facts, quantity: 2 }])).toThrow(
      '恰好',
    );
    expect(() => forgingBoosts(20, 20, [])).toThrow('恰好');
    expect(() =>
      forgingBoosts(180, 180, [
        { facts: { ...facts, rank: '凡品' }, quantity: 5 },
      ]),
    ).toThrow('品质');
    for (const type of ['herb', 'seed', 'skill_manual', 'gongfa_manual'])
      expect(MaterialFactsSchema.safeParse({ ...facts, type }).success).toBe(
        false,
      );
  });
  it('groups aux and monster together without quality multipliers', () => {
    expect(
      forgingBoosts(180, 180, [
        { facts: { ...facts, type: 'aux' }, quantity: 2 },
        { facts: { ...facts, type: 'monster', rank: '神品' }, quantity: 3 },
      ]),
    ).toEqual({ ore: 0, essence: 0, attributes: 5 });
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
  it('preserves original rolls and special draws, validates boosted results in all slots', () => {
    let raised = 0;
    for (const slot of DAO_EQUIPMENT_SLOTS)
      for (let seed = 1; seed <= 80; seed++) {
        const input = {
          id: `forge-${slot}-${seed}`,
          createdAt: '2026-09-07T00:00:00Z',
          seed,
          templateId: `dao_equipment.standard.${slot}.v1`,
          equipmentLevel: 180,
        };
        const base = generateDaoEquipmentV2({
          ...input,
          generatorVersion: 'dao_equipment_generator_v2',
        });
        const zero = generateForgedEquipment({
          ...input,
          boosts: { ore: 0, essence: 0, attributes: 0 },
        });
        const result = generateForgedEquipment({
          ...input,
          boosts: { ore: 2, essence: 1, attributes: 2 },
        });
        expect(base.ok && result.ok && zero.ok).toBe(true);
        if (!base.ok || !result.ok || !zero.ok) continue;
        expect(zero.instance).toEqual({
          ...base.instance,
          generatorVersion: 'dao_equipment_generator_v3',
          name: forgedName(slot, 180, seed),
        });
        expect(result.instance.artId).toBe(base.instance.artId);
        expect(result.instance.attributeBonuses.map((r) => r.attr)).toEqual(
          base.instance.attributeBonuses.map((r) => r.attr),
        );
        result.instance.baseStats.forEach((r, index) => {
          expect(r.value).toBeGreaterThanOrEqual(
            base.instance.baseStats[index].value,
          );
          if (r.value > base.instance.baseStats[index].value) raised++;
        });
        expect(result.instance.essenceIds.length).toBeGreaterThanOrEqual(
          base.instance.essenceIds.length,
        );
        expect(
          compileDaoEquipmentSpecialLoadoutV1({ [slot]: result.instance }, 180)
            .ok,
        ).toBe(true);
        expect(
          compileDaoEquipmentSpecialLoadoutV1(
            {
              [slot]: {
                ...result.instance,
                name: '非名称池中的名字',
              },
            },
            180,
          ).ok,
        ).toBe(false);
      }
    expect(raised).toBeGreaterThan(0);
  });
  it('keeps materials with different facts separate and merges identical facts', () => {
    let id = 0;
    const nextId = () => `m-${++id}`;
    let bag = addItems(
      [],
      { definitionId: 'material.v1', quantity: 98, instanceData: facts },
      'bag',
      false,
      nextId,
    );
    bag = addItems(
      bag,
      { definitionId: 'material.v1', quantity: 3, instanceData: facts },
      'bag',
      false,
      nextId,
    );
    expect(bag.map((i) => i.quantity)).toEqual([99, 2]);
    bag = addItems(
      bag,
      {
        definitionId: 'material.v1',
        quantity: 2,
        instanceData: { ...facts, rank: '神品' },
      },
      'bag',
      false,
      nextId,
    );
    expect(sameStack(bag[0], bag[2])).toBe(false);
    expect(sortBag(bag).reduce((n, i) => n + i.quantity, 0)).toBe(103);
    expect(() =>
      addItems(
        [],
        { definitionId: 'material.v1', quantity: 1 },
        'bag',
        false,
        nextId,
      ),
    ).toThrow();
  });
  it('never enables dev tools for staging, production or a missing deployment', () => {
    expect(allowsLocalDevTools('local', 'development')).toBe(true);
    for (const env of [undefined, 'staging', 'production'])
      expect(allowsLocalDevTools(env, 'development')).toBe(false);
    expect(allowsLocalDevTools('local', 'production')).toBe(false);
  });
});
