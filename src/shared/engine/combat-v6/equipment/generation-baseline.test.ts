import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generateForgedEquipment } from './forging';
import { generateDaoEquipmentV1, generateDaoEquipmentV2 } from './generator';
import { DAO_EQUIPMENT_SLOTS } from './types';

// 经确认的第二版数值基线：炼气、化神、金丹，覆盖 V1/V2/V3 生成入口。
const baselines = [
  {
    slot: 'weapon',
    level: 10,
    hash: '825fb687331d1c48e14501123974456507029a01f92abc11c682a53f1159876a',
  },
  {
    slot: 'weapon',
    level: 90,
    hash: '4faef72e6eb242298cd893b75909ccf9ac4a0b1e6329281092352743dfa825b1',
  },
  {
    slot: 'weapon',
    level: 50,
    hash: '3ed1a7c81b9648f55a17cc6b8d80f80e5da876517506e7d87a3e54c51c9186ff',
  },
  {
    slot: 'head',
    level: 10,
    hash: 'd62be7dbb632fcf72e3fb7705a58184cdf8917890c16b3eb0bde7bf391a82d4c',
  },
  {
    slot: 'head',
    level: 90,
    hash: '8a18d26d2ecce669976c3df8321743a759de830ceb34ce747c569ff02c475fe9',
  },
  {
    slot: 'head',
    level: 50,
    hash: 'ae74abf76a1a81b454aaa63f7e6b4d28bbf1a3ced8e61aac07a440bfbf2ea87d',
  },
  {
    slot: 'armor',
    level: 10,
    hash: 'bcf6dd65a81adecad0623f3cf6b7319a81917b978190f582a52b1c55f2b8ea9a',
  },
  {
    slot: 'armor',
    level: 90,
    hash: 'd44eb1adb6994a225580a851c7c9f5648aba68689df1dad8cd3b96c57894ac4e',
  },
  {
    slot: 'armor',
    level: 50,
    hash: '6888c682f1b796755c8f09895f8fe8b7adf8db4cce8d160ac9cd494278a07d5f',
  },
  {
    slot: 'necklace',
    level: 10,
    hash: 'c68541f5bfbbd6f4bfcc99442fd8c88da89ad4fd8a034706340a4034f676c50e',
  },
  {
    slot: 'necklace',
    level: 90,
    hash: '5e1ba2575f8e1956a617fd4c8b7c5540abb1c2eca905243dcb9ef4b4b803ad28',
  },
  {
    slot: 'necklace',
    level: 50,
    hash: '7f2f18a954469cc7bbde6ba199f7ad977e6b55f7085c78134ba3ed71a7e79c5a',
  },
  {
    slot: 'belt',
    level: 10,
    hash: '3847d9162b3a07e4d3b90c0cc94edf82d0d8759fb9d5c151eb4afbe79ff29f40',
  },
  {
    slot: 'belt',
    level: 90,
    hash: '3b57697a5b8cd4cd1e26d4178e82cf900f87a31f2772db42819296e3e81404e6',
  },
  {
    slot: 'belt',
    level: 50,
    hash: 'f6787366a38deba2a038987b94f7632e6f73741760c82ea07eb3aa1344955eb2',
  },
  {
    slot: 'footwear',
    level: 10,
    hash: '2817b3342ae1b8cb46afc7f0aa4c5f3935318818fec3e62002f0f8e39f51eb1e',
  },
  {
    slot: 'footwear',
    level: 90,
    hash: 'cf1d4b16d86087b82cac68c4be742134ab5b5e7ef7c0cc535b9d59985013116d',
  },
  {
    slot: 'footwear',
    level: 50,
    hash: 'a35c0e72946f94265319c18e7dd421499c0bef89867094ec0f82c992f11201c4',
  },
] as const;

function digest(
  slot: (typeof DAO_EQUIPMENT_SLOTS)[number],
  equipmentLevel: number,
) {
  const results = Array.from({ length: 256 }, (_, seed) => {
    const input = {
      id: 'baseline',
      createdAt: '2026-09-11T00:00:00.000Z',
      templateId: `dao_equipment.standard.${slot}.v1`,
      equipmentLevel,
      seed,
    };
    return [
      generateDaoEquipmentV1({
        ...input,
        generatorVersion: 'dao_equipment_generator_v1',
      }),
      generateDaoEquipmentV2({
        ...input,
        generatorVersion: 'dao_equipment_generator_v2',
      }),
      ...[
        { ore: 5, essence: 0, attributes: 0 },
        { ore: 0, essence: 0, attributes: 5 },
        { ore: 2, essence: 1, attributes: 2 },
      ].map((boosts) => generateForgedEquipment({ ...input, boosts })),
    ];
  });
  return createHash('sha256').update(JSON.stringify(results)).digest('hex');
}

it.each(baselines)(
  'preserves realm-tier output for $slot at level $level across 256 seeds',
  ({ slot, level, hash }) => {
    expect(digest(slot, level)).toBe(hash);
  },
);
