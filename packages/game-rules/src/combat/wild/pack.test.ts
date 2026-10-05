import {
  COMBAT_WILD_WILD_DATA as raw,
  COMBAT_WILD_WILD_SCHEMA as schema,
} from '@daoyou/game-content/authoring/combat';
import {
  BEAST_PROGRESSION,
  BEAST_RARE_SPECIES_IDS,
  BEAST_SPECIES,
} from '@daoyou/game-content/beasts';
import { WildPackShape, loadWildPack } from '@daoyou/game-content/combat/wild';
import { getMapNode } from '@daoyou/game-content/world/map';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BeastSchema } from '../../beasts/schema.js';
import {
  generateWildEncounter,
  generateWildIndividual,
  wildAllocation,
} from './generator.js';

const nodeId = raw.regions[0].nodeId;
describe('野外寻觅配置与个体生成', () => {
  it('Schema 同步', () =>
    expect(z.toJSONSchema(WildPackShape, { reused: 'ref' })).toEqual(schema));
  it('拒绝未知物种、重复节点与颠倒范围', () => {
    const missing = structuredClone(raw);
    missing.regions[0].species[0].speciesId = 'unknown';
    expect(() => loadWildPack(missing)).toThrow('未知物种');
    const duplicate = structuredClone(raw);
    duplicate.regions.push(duplicate.regions[0]);
    expect(() => loadWildPack(duplicate)).toThrow('区域重复');
    const invalid = structuredClone(raw);
    invalid.regions[0].species[0].minLevel = 30;
    expect(() => loadWildPack(invalid)).toThrow('等级上下界颠倒');
  });
  it('同种子一致，不同种子有数量、组合和等级变化，成年与0级幼崽同时存在', () => {
    expect(generateWildEncounter(nodeId, 72)).toEqual(
      generateWildEncounter(nodeId, 72),
    );
    const encounters = Array.from({ length: 256 }, (_, seed) =>
      generateWildEncounter(nodeId, seed),
    );
    expect(new Set(encounters.map((e) => e.length))).toEqual(
      new Set([1, 2, 3]),
    );
    expect(new Set(encounters.flat().map((c) => c.speciesId)).size).toBe(4);
    expect(encounters.flat().some((c) => c.level === 0)).toBe(true);
    expect(
      encounters
        .flat()
        .every((c) => c.level === 0 || (c.level >= 5 && c.level <= 15)),
    ).toBe(true);
    expect(() => generateWildEncounter('unknown', 0)).toThrow(
      'UNKNOWN_WILD_REGION',
    );
  });
  it('节点配置独立决定物种与成年等级，幼崽概率边界准确', () => {
    const data = structuredClone(raw);
    data.regions[0].nodeId = 'other-node';
    data.regions[0].species[0].minLevel =
      data.regions[0].species[0].maxLevel = 30;
    data.regions[0].species = [data.regions[0].species[0]];
    data.encounter.minCount = data.encounter.maxCount = 3;
    data.encounter.cubChance = 0;
    const adult = generateWildEncounter('other-node', 23, loadWildPack(data));
    expect(adult).toHaveLength(3);
    expect(
      adult.every(
        (c) =>
          c.level === 30 &&
          c.speciesId === data.regions[0].species[0].speciesId,
      ),
    ).toBe(true);
    data.encounter.cubChance = 1;
    expect(
      generateWildEncounter('other-node', 23, loadWildPack(data)).every(
        (c) => c.level === 0,
      ),
    ).toBe(true);
  });
  it('成年均衡加点有波动，所有等级点数守恒，幼崽保留50点自由属性', () => {
    for (const level of [0, 5, 9, 15, 30, 180]) {
      for (let seed = 0; seed < 100; seed++) {
        const values = Object.values(wildAllocation(level, seed));
        expect(values.reduce((a, b) => a + b, 0)).toBe(
          level * (BEAST_PROGRESSION.pointsPerLevel - 2),
        );
        const mean = (level * (BEAST_PROGRESSION.pointsPerLevel - 2)) / 5;
        values.forEach((v) => {
          expect(v).toBeGreaterThanOrEqual(Math.floor(mean * 0.7));
          expect(v).toBeLessThanOrEqual(Math.ceil(mean * 1.3));
        });
      }
    }
    expect(
      new Set(
        Array.from({ length: 30 }, (_, seed) =>
          JSON.stringify(wildAllocation(15, seed)),
        ),
      ).size,
    ).toBeGreaterThan(10);
    const cub = generateWildIndividual(
      {
        unitId: 'enemy',
        speciesId: raw.regions[0].species[0].speciesId,
        level: 0,
      },
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      41,
    );
    expect(BeastSchema.parse(cub.beast).unallocatedPoints).toBe(50);
    expect(Object.values(cub.beast.allocatedAttributes)).toEqual([
      0, 0, 0, 0, 0,
    ]);
  });
});

it('二十六个节点覆盖全部物种，地图名称、境界与关联配置一致', () => {
  expect(raw.regions).toHaveLength(26);
  expect(
    new Set(raw.regions.flatMap((r) => r.species.map((s) => s.speciesId))),
  ).toEqual(new Set(BEAST_SPECIES.map((s) => s.id)));
  for (const r of raw.regions) {
    const node = getMapNode(r.nodeId)!;
    expect(node.wild_encounter_id).toBe(r.id);
    expect(node.name.endsWith(r.name)).toBe(true);
    expect(node.realm_requirement).toBe(r.realmRequirement);
    expect(node.description).toContain(r.description);
    expect(node.dungeon_config).toBeUndefined();
  }
});
it('混居节点对每种成年个体应用独立等级范围，幼崽始终0级', () => {
  const pack = loadWildPack(raw);
  for (const r of pack.regions) {
    const seen = new Set<string>();
    for (const chance of [0, 1]) {
      const sample = structuredClone(pack);
      sample.regions.find((region) => region.id === r.id)!.rareChance = chance;
      for (let seed = 0; seed < 256; seed++)
        for (const c of generateWildEncounter(r.nodeId, seed, sample)) {
          const entry = r.species.find((s) => s.speciesId === c.speciesId)!;
          expect(entry).toBeDefined();
          seen.add(c.speciesId);
          if (c.level !== 0) {
            expect(c.level).toBeGreaterThanOrEqual(entry.minLevel);
            expect(c.level).toBeLessThanOrEqual(entry.maxLevel);
          }
        }
    }
    expect(seen).toEqual(new Set(r.species.map((s) => s.speciesId)));
  }
});

it('稀有池必须配置概率、保留普通池，概率不得越界或引用空池', () => {
  const source = loadWildPack(raw);
  const index = source.regions.findIndex((r) => r.rareChance !== undefined);
  const missing = structuredClone(source);
  delete missing.regions[index].rareChance;
  expect(() => loadWildPack(missing)).toThrow('稀有概率');
  const emptyCommon = structuredClone(source);
  emptyCommon.regions[index].species = emptyCommon.regions[
    index
  ].species.filter((s) => BEAST_RARE_SPECIES_IDS.has(s.speciesId));
  expect(() => loadWildPack(emptyCommon)).toThrow('普通物种');
  const noRare = structuredClone(source);
  noRare.regions[0].rareChance = 0.008;
  expect(() => loadWildPack(noRare)).toThrow('稀有物种');
  for (const value of [-0.01, 1.01]) {
    const invalid = structuredClone(source);
    invalid.regions[index].rareChance = value;
    expect(() => loadWildPack(invalid)).toThrow('rareChance');
  }
});

it('稀有概率逐位置独立控制，普通低阶物种使用栖息地等级', () => {
  const pack = loadWildPack(raw);
  const region = pack.regions.find((r) => r.realmRequirement === '合体')!;
  pack.encounter.minCount = pack.encounter.maxCount = 3;
  pack.encounter.cubChance = pack.encounter.mutantChance = 0;
  for (const chance of [0, 1]) {
    region.rareChance = chance;
    for (let seed = 0; seed < 100; seed++) {
      for (const c of generateWildEncounter(region.nodeId, seed, pack)) {
        expect(BEAST_RARE_SPECIES_IDS.has(c.speciesId)).toBe(chance === 1);
        expect(c.level).toBeGreaterThanOrEqual(125);
        expect(c.level).toBeLessThanOrEqual(135);
      }
    }
  }
  region.rareChance = 0.008;
  pack.encounter.mutantChance = 0.008;
  const rareBySlot = [0, 0, 0];
  let both = 0;
  let mixed = false;
  for (let seed = 0; seed < 50000; seed++) {
    const group = generateWildEncounter(region.nodeId, seed, pack);
    group.forEach((c, slot) => {
      if (BEAST_RARE_SPECIES_IDS.has(c.speciesId)) {
        rareBySlot[slot]++;
        if (c.isMutant) {
          both++;
          expect(c.level).toBe(0);
        }
      }
    });
    const count = group.filter((c) =>
      BEAST_RARE_SPECIES_IDS.has(c.speciesId),
    ).length;
    mixed ||= count > 0 && count < 3;
  }
  rareBySlot.forEach((count) => {
    expect(count / 50000).toBeGreaterThan(0.0065);
    expect(count / 50000).toBeLessThan(0.0095);
  });
  expect(both).toBeGreaterThan(0);
  expect(both).toBeLessThan(25);
  expect(mixed).toBe(true);
  const seed = 74;
  expect(generateWildEncounter(region.nodeId, seed, pack)).toEqual(
    generateWildEncounter(region.nodeId, seed, pack),
  );
  const mutations = (chance: number) => {
    region.rareChance = chance;
    return Array.from({ length: 1000 }, (_, seed) =>
      generateWildEncounter(region.nodeId, seed, pack).map((c) => !!c.isMutant),
    );
  };
  expect(mutations(0)).toEqual(mutations(1));
});
it('拒绝低于携带等级的成年体与尚未开放物种的区域', () => {
  const level = structuredClone(raw);
  level.regions[1].species[0].minLevel = 1;
  expect(() => loadWildPack(level)).toThrow('携带等级');
  const realm = structuredClone(raw);
  realm.regions[1].realmRequirement = '炼气';
  expect(() => loadWildPack(realm)).toThrow('携带境界');
});
