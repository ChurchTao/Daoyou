import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generateForgedEquipment } from './forging';
import { generateDaoEquipmentV1, generateDaoEquipmentV2 } from './generator';
import { DAO_EQUIPMENT_SLOTS } from './types';

// Captured before G1 migration: complete V1/V2/V3 outputs, including downstream RNG.
const baselines = [
  {
    slot: 'weapon',
    level: 10,
    hash: '4e667db374de7128bfab48c25822acf58b1982db33256f081d27f736dbf75cde',
  },
  {
    slot: 'weapon',
    level: 90,
    hash: '33ac2b3439268d549526d18efb66718ae855d1616a5fa28eccd67d8c9e021126',
  },
  {
    slot: 'weapon',
    level: 180,
    hash: '6dee764f927a449acb40765b2a7be413cf3948e1b875f0c61e35bc93d1e8087a',
  },
  {
    slot: 'head',
    level: 10,
    hash: '026e311b51e47e1110ee6130fe6d536a99dadcb03ea1ad97fe7c2759b57548d6',
  },
  {
    slot: 'head',
    level: 90,
    hash: '4a2e79b4bfd8c42bcf9fa0021067a18776dacb2c00b705761c928a4513421b70',
  },
  {
    slot: 'head',
    level: 180,
    hash: 'bddb13189f1b38ff0161cbf501b2094bede6cba46b8b47e221ffee3e4f179fae',
  },
  {
    slot: 'armor',
    level: 10,
    hash: 'a5e5b860be186b830dbc7f36fe0468fa1313dfebabf922600c1de1f5cad03301',
  },
  {
    slot: 'armor',
    level: 90,
    hash: '54e8fb7e024ca83d8a12b8b1b9c8e0f586e63ce403941f162e9691b164676291',
  },
  {
    slot: 'armor',
    level: 180,
    hash: 'fd152e01f2f8517e407c10476ae655e8631bf94439342bfb7b6cfe85066009df',
  },
  {
    slot: 'necklace',
    level: 10,
    hash: '95169b941fdc975dfc8aaeee2f6761dd86c9eea25e643064c284bd8d674512b6',
  },
  {
    slot: 'necklace',
    level: 90,
    hash: 'b0e0993ffa63a096b95e011da43639f12b30414dcde18cd493d55fa4f6f78f73',
  },
  {
    slot: 'necklace',
    level: 180,
    hash: '0eb2f13e0fce5e0e8d25007a5daeda74722af923831dfe0a879ed27abf44b6a0',
  },
  {
    slot: 'belt',
    level: 10,
    hash: '53c6194b28b2ffd74028c78cb51d76ba2f9189b6d34d41e8887c0b4816f83b02',
  },
  {
    slot: 'belt',
    level: 90,
    hash: '9a9c3f787cc7ae9c50517891e19b768d6185558404ec97a89e2f74b812e84c81',
  },
  {
    slot: 'belt',
    level: 180,
    hash: '496cec435ad28c6364c3acca2fa7d225abb5ae492e7494aea234209ea07d2c29',
  },
  {
    slot: 'footwear',
    level: 10,
    hash: 'c3df1d7dea7c852ef8b850ce8c549c3649f2748fa30fb426c731c898d8902f18',
  },
  {
    slot: 'footwear',
    level: 90,
    hash: '0d248d3c16c74e65039d6f780156ab5066c448b8453d9ff94c173b4b76c47f5e',
  },
  {
    slot: 'footwear',
    level: 180,
    hash: 'a459b42c4c094ae0a13893d29cb0f656bf7c951275f855347ac303b8b1e5e36d',
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
  'preserves pre-G1 output for $slot at level $level across 256 seeds',
  ({ slot, level, hash }) => {
    expect(digest(slot, level)).toBe(hash);
  },
);
