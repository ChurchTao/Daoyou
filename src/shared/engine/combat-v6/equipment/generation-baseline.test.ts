import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generateForgedEquipment } from './forging';
import { generateDaoEquipmentV1, generateDaoEquipmentV2 } from './generator';
import { DAO_EQUIPMENT_SLOTS } from './types';

// 经确认的14器蕴产出池与部位限制基线：炼气、化神、金丹，覆盖 V1/V2/V3 生成入口。
const baselines = [
  {
    slot: 'weapon',
    level: 10,
    hash: '1b7f68b46b680ad2cd0b76b691e238cda47ad88cc4ee500bf6bce449b81da13b',
  },
  {
    slot: 'weapon',
    level: 90,
    hash: 'e56c39fadfeb7d578ecb5520c19dad1c40477976900e1da97bb19c8a9316a1fd',
  },
  {
    slot: 'weapon',
    level: 50,
    hash: '4aa6e952c36dd0abdafbfec0ff077a24f4969f0c568621ded65ad89108f61b5c',
  },
  {
    slot: 'head',
    level: 10,
    hash: '214e7a9a20306d43d861ae4089843e466cae619008efba84d92c8469285c5024',
  },
  {
    slot: 'head',
    level: 90,
    hash: '6a7535256874879d3b478eceabe30e7c4af2807d2a1c3408f8be1729fafaa7e0',
  },
  {
    slot: 'head',
    level: 50,
    hash: '02a02146d84ded2b8bf773b16e47412fe7c95c6aaea0f24549351ef395261ae0',
  },
  {
    slot: 'armor',
    level: 10,
    hash: '038b2f9976c5e246db2d9e7c691c22ebd1bad6da2078ce78981cef87811d52db',
  },
  {
    slot: 'armor',
    level: 90,
    hash: '0ac869a6890a7ec9f41ac0e100eadfc0b86b1505ad5a3324657aa148e5c35bda',
  },
  {
    slot: 'armor',
    level: 50,
    hash: '30acab154ebc74298f3c21f5d43e99de2cdc6cc5ade029f61b8d16cc4a59a5dc',
  },
  {
    slot: 'necklace',
    level: 10,
    hash: '7dfe41ca0f8b9bb9096fe7ecdac818313f616ba29d9abbfbb1b367bde1c0d2de',
  },
  {
    slot: 'necklace',
    level: 90,
    hash: 'b665e1b2dfc7d3e6054f8de756a5fe0d78db72683dcc338e8fa36cb43d3f5f30',
  },
  {
    slot: 'necklace',
    level: 50,
    hash: 'e53a26fc70141e581e28aedab5454cde50ec9388ae728a244f6ddd3e37bae640',
  },
  {
    slot: 'belt',
    level: 10,
    hash: '0f1e332aee1a0487b5ceff4893db6f31459c45a522d3f3a1b10bfb159635113f',
  },
  {
    slot: 'belt',
    level: 90,
    hash: '6c652b768e239c983d22557663ca9a916c89bdd183ccc4ef2013fe8912454588',
  },
  {
    slot: 'belt',
    level: 50,
    hash: '6e17b5d4b93afa9fe84aef67d3d18f05fdcf6245d752404566e9e39080e98334',
  },
  {
    slot: 'footwear',
    level: 10,
    hash: '9b76a84217190f872383c66e10c637d4187a7aea18e72c6c248f18d7e0c1c470',
  },
  {
    slot: 'footwear',
    level: 90,
    hash: '1e068c2b7545203e22e4de15f943449cac010b3e19bb68f879dafe3b4eb24d04',
  },
  {
    slot: 'footwear',
    level: 50,
    hash: '29fcb8934a30e7b2ea71fb21791f9f3c112f62d4428126a3b9c0a6d80e822246',
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
