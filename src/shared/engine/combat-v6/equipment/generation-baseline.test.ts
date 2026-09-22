import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generateForgedEquipment } from './forging';
import { generateDaoEquipmentV1, generateDaoEquipmentV2 } from './generator';
import { DAO_EQUIPMENT_SLOTS } from './types';
import { forgedName } from '../../../forging/names';

// 经确认的14器蕴与38器诀产出池基线：炼气、化神、金丹。
// V4 八行由 elements.test.ts、V5 器形与命名由 weapons.test.ts 验证；这里锁定 V3 的旧数值随机流。
const baselines = [
  {
    slot: 'weapon',
    level: 10,
    hash: '2000971a143fee5f0977c15bfeb359df9212f9666bcfb36de9a4dac3a74af5bf',
  },
  {
    slot: 'weapon',
    level: 90,
    hash: 'e43b208878180e72fa7a7df128596586f9cd1276f4ea3a4cfce5a463cd8360cb',
  },
  {
    slot: 'weapon',
    level: 50,
    hash: 'f597cc780f99d35f8aeea6d3ddf6fa9608415ceb443f388f7d7386880b508125',
  },
  {
    slot: 'head',
    level: 10,
    hash: '54e78b5a74047193a77f891e545a87fdd0625549ed1a74fa8065962c10b1f0b3',
  },
  {
    slot: 'head',
    level: 90,
    hash: '9fac3c40a3da4fb25f8b4f27609dc51c38b87cca624fce134588b814294e3db5',
  },
  {
    slot: 'head',
    level: 50,
    hash: '37ff566219696071ea98840a54c09e94720cbab42cd58a48e6e4b13c1b2c3c97',
  },
  {
    slot: 'armor',
    level: 10,
    hash: '43b1605459c688d3c87ea615d8dfe999183e9852e95b4634e28c0ed292422194',
  },
  {
    slot: 'armor',
    level: 90,
    hash: 'a51bb2f7c7e425950122a4ab29aafaaef6f2aa384018fe1899b57f8d1319baab',
  },
  {
    slot: 'armor',
    level: 50,
    hash: '2b1fac655caf76204acc4bf172c9115b89af6ca9318ca2d137de8af10baeb222',
  },
  {
    slot: 'necklace',
    level: 10,
    hash: '5238b217dbf342b20ede5b9af61fbde3d07943a2e03f21a38d7f2872c662adea',
  },
  {
    slot: 'necklace',
    level: 90,
    hash: '4432e4b9aa689470d3309f1e9e8552deefda57c016813c6f8617c5e2444c6407',
  },
  {
    slot: 'necklace',
    level: 50,
    hash: '5b15bada5676730e9d7e867de59d02c3d7fd6dddf5831f321167b9490d07b9e6',
  },
  {
    slot: 'belt',
    level: 10,
    hash: '80af41d96281bae6965b7113a709b30ae1f187bc7f70f5d3904c2d79a9002d2c',
  },
  {
    slot: 'belt',
    level: 90,
    hash: '7ee3881bed1859d3ece8e2cbd548a67d70271777211d1595ef08338188284778',
  },
  {
    slot: 'belt',
    level: 50,
    hash: '5ea732ee6ead0c2f43ba93a86cd2d71c2e097dd1107da2463e36f753493b4a14',
  },
  {
    slot: 'footwear',
    level: 10,
    hash: '8d34ccd231f0e1bd9da49fab95ca6e294818ff2d39066f87e2a6c3e0231a0e07',
  },
  {
    slot: 'footwear',
    level: 90,
    hash: '57cd033b0c5dc866c112feac22359a5d1217a1830d5b59ebeea4f8c3ca49ddf0',
  },
  {
    slot: 'footwear',
    level: 50,
    hash: '1fafc842d0907918c69eace383c707ebc5dd9849c17cde978d785626c37cd73c',
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
      ].map((boosts) => {
        const result = generateForgedEquipment({ ...input, boosts });
        if (!result.ok) return result;
        const { element: _element, weaponType: _weaponType, ...instance } = result.instance;
        return { ...result, instance: { ...instance, name: forgedName(slot, equipmentLevel, seed), generatorVersion: 'dao_equipment_generator_v3' } };
      }),
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
