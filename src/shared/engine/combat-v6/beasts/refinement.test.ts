import { expect, it } from 'vitest';
import { z } from 'zod';
import { BEAST_SPECIES } from './content';
import schema from './data/refinement.schema.json';
import { generateCapturedBeast } from './generator';
import { gainBeastExp } from './progression';
import { beastRefinementReason, refineBeast } from './refinement';
import {
  BEAST_REFINEMENT,
  BeastRefinementPackShape,
  loadBeastRefinementPack,
} from './refinement-config';
import { BeastSchema } from './schema';
import { rollBeastTraits } from './trait-generator';
const id = '00000000-0000-4000-8000-000000000001';
const [normal, advanced] = BEAST_REFINEMENT.items;
it('洗炼配置与schema同步且非法数量与重复ID拒绝', () => {
  expect(schema).toEqual(z.toJSONSchema(BeastRefinementPackShape));
  const copy = structuredClone(BEAST_REFINEMENT);
  copy.items.push(copy.items[0]);
  expect(() => loadBeastRefinementPack(copy)).toThrow();
  const bad = structuredClone(BEAST_REFINEMENT);
  bad.items[0].consumeQuantity = 100;
  expect(() => loadBeastRefinementPack(bad)).toThrow();
});
it.each(BEAST_SPECIES)(
  '$name 按携带境界选择药露，当前等级不影响档位',
  (species) => {
    const beast = generateCapturedBeast(id, id, species.id, 100, 1);
    expect(beastRefinementReason(beast, normal.id, 180)).toBe(
      species.carryLevel >= 65 ? '此物种需使用上品归元灵露。' : '',
    );
    expect(beastRefinementReason(beast, advanced.id, 180)).toBe('');
    const next = refineBeast(beast, advanced.id, 180, 42);
    expect(next.level).toBe(0);
    expect(beastRefinementReason(next, normal.id, 180)).toBe(
      beastRefinementReason(beast, normal.id, 180),
    );
    expect(() => refineBeast(beast, advanced.id, 0, 42)).toThrow('携带境界');
  },
);
it('两档药露不改变随机结果，且可以重复洗炼0级灵兽', () => {
  const beast = generateCapturedBeast(id, id, BEAST_SPECIES[0].id, 90, 9);
  expect(refineBeast(beast, normal.id, 180, 42)).toEqual(
    refineBeast(beast, advanced.id, 180, 42),
  );
  const next = refineBeast(beast, normal.id, 180, 42);
  expect(refineBeast(next, normal.id, 180, 42)).toEqual({
    ...next,
    revision: next.revision + 1,
  });
});
it('归零、重抽、恢复寿命，保留身份与寿命上限，旧技能不返还', () => {
  const base = generateCapturedBeast(id, id, BEAST_SPECIES[0].id, 90, 9);
  const old = BeastSchema.parse({
    ...base,
    name: '旧名字',
    exp: 300,
    unallocatedPoints: 0,
    allocatedAttributes: {
      constitution: 0,
      strength: 450,
      magic: 0,
      endurance: 0,
      agility: 0,
    },
    skills: ['beast.advanced-combo'],
    skillSlotCapacity: 1,
    maxLifespan: 1200,
    currentLifespan: 0,
    generationVersion: 'summoned_beast_v1',
  });
  const before = structuredClone(old);
  const next = refineBeast(old, normal.id, 180, 42);
  expect(old).toEqual(before);
  expect(next).toMatchObject({
    ...rollBeastTraits(BEAST_SPECIES[0], 42),
    id,
    ownerCultivatorId: id,
    name: '旧名字',
    speciesId: old.speciesId,
    level: 0,
    exp: 0,
    unallocatedPoints: 0,
    allocatedAttributes: {
      constitution: 0,
      strength: 0,
      magic: 0,
      endurance: 0,
      agility: 0,
    },
    maxLifespan: 1200,
    currentLifespan: 1200,
    revision: old.revision + 1,
  });
  expect(next.skills).not.toContain('beast.advanced-combo');
  expect(next.skillSlotCapacity).toBe(next.skills.length);
  expect(gainBeastExp(next, 100, 180)).toMatchObject({
    level: 1,
    unallocatedPoints: 5,
  });
  expect(() => refineBeast(old, 'book.beast.combo', 180, 42)).toThrow(
    '不是归元灵露',
  );
});
it('洗炼技能格可以增加或减少，始终等于新出生技能数', () => {
  const species = BEAST_SPECIES.find((s) => s.name === '银翅螳螂')!;
  const base = generateCapturedBeast(id, id, species.id, 60, 3);
  const counts = new Set<number>();
  for (let seed = 0; seed < 100; seed++)
    counts.add(refineBeast(base, advanced.id, 180, seed).skillSlotCapacity);
  expect([...counts].sort()).toEqual([2, 3, 4]);
});
