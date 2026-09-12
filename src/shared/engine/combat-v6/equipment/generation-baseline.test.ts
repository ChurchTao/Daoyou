import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generateForgedEquipment } from './forging';
import { generateDaoEquipmentV1, generateDaoEquipmentV2 } from './generator';
import { DAO_EQUIPMENT_SLOTS } from './types';

// 九境界档位与初期门槛的完整 V1/V2/V3 输出基线。
const baselines = [
  {
    slot: 'weapon',
    level: 10,
    hash: '49ad3e35e0bff7a0b5c74a617eb4c870407e6ff75c93603f9becf94bf38724ab',
  },
  {
    slot: 'weapon',
    level: 90,
    hash: '792aec0984022087d6da62a6bcc72fd99f437e8041d4d020b9d5b5ab1cfb119f',
  },
  {
    slot: 'weapon',
    level: 170,
    hash: '8f76f38881fa90a7495ac9bfaa9c292e599e720348366ea8b768f222496a9413',
  },
  {
    slot: 'head',
    level: 10,
    hash: 'c998a93ff16102b0f93fc961b51f3926ff81d4736eb66bd84d9dd7fdf9a611e9',
  },
  {
    slot: 'head',
    level: 90,
    hash: 'ee4604ca1d923c86f53fb11ef08490d2174fac2e35e789170eccdbafb824dc1f',
  },
  {
    slot: 'head',
    level: 170,
    hash: '7f3c09704b6126eb66971addfcec820e35f2310bc61eb671174e336c120dd6c4',
  },
  {
    slot: 'armor',
    level: 10,
    hash: 'b3cab8b1b45fa3fe5b2eb15391990729da7f739b4e0320ba362ffa7b33a605f2',
  },
  {
    slot: 'armor',
    level: 90,
    hash: '8eff045139c8b86b67a4e5f93aa29b19a53a93ca92c8741353184396362a0c54',
  },
  {
    slot: 'armor',
    level: 170,
    hash: 'd418afc2a7289c0b320077fac8f61fa7fcd9b67d18304132bf64dc7e64c925e1',
  },
  {
    slot: 'necklace',
    level: 10,
    hash: '2dd41a1b4ebc2658362ce1eda42e3b467b5c8a8bfb5a3d4b3389502bbf09b179',
  },
  {
    slot: 'necklace',
    level: 90,
    hash: '7815abc6ba3ec71d15857131f8bedd12c60c9f251c22b6ebfce4414d523da6fe',
  },
  {
    slot: 'necklace',
    level: 170,
    hash: '8c4c6ea83bcd20ba908722e273ae4c6696aa56a316b5be850201189a76b0a715',
  },
  {
    slot: 'belt',
    level: 10,
    hash: '0afbf4628b191025eb9139f5e2621fc97a5afc3eceaa1a50bdcb86449424b43e',
  },
  {
    slot: 'belt',
    level: 90,
    hash: '101593c4762cda6bf7aa5091f7282972272f50f25b33a448f94df5138f81a0a0',
  },
  {
    slot: 'belt',
    level: 170,
    hash: '3309543ebe4f922de20a6ac023e42c2888ca429ea862519e29ed5add3b10abf7',
  },
  {
    slot: 'footwear',
    level: 10,
    hash: 'e594223dcba3019addd0b3e8535483e8b76817df4ade6cf5cd0d10374baeb6a5',
  },
  {
    slot: 'footwear',
    level: 90,
    hash: '8d2bcb178d0c41936f279c5e3408f6f35c75c18b5af453fae57d5eabe395f43e',
  },
  {
    slot: 'footwear',
    level: 170,
    hash: 'b27713b55abbe42490566e3766dedf112edc20400417951f18283a594273f6f1',
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
