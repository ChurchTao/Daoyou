import {
  REALM_ORDER,
  REALM_VALUES,
  type RealmType,
} from '@daoyou/constants/realms';
import { findItemDefinition } from '@daoyou/game-content/items';
import { BLUEPRINTS } from '@daoyou/game-content/items/equipment';
import { MYSTERY_BAG_REWARD_DATA } from '@daoyou/game-content/items/mystery-bags';
import {
  FORGING_MATERIAL_TYPES,
  MYSTERY_BAG_IDS,
  MaterialFactsSchema,
  type ItemGrant,
  type MysteryBagId,
} from '@daoyou/game-domain/inventory';
import { getLevelRealmStage } from '@daoyou/game-domain/progression';
import { z } from 'zod';
import { RewardItemSchema, rewardDisplayItem } from '../rewards/items.js';

const TOTAL_CHANCE = 10_000;
const materialRank = z.enum(['地品', '天品', '仙品', '神品']);
const materialType = z.enum(['herb', ...FORGING_MATERIAL_TYPES]);
const chanceBps = z.number().int().min(1).max(TOTAL_CHANCE);
const quantity = z.number().int().min(1).max(99);
const spiritStones = z.number().int().min(1).max(99_990_000);
const realm = z.enum(REALM_VALUES);

function blueprintCandidates(minRealm: RealmType, maxRealm: RealmType) {
  const min = REALM_ORDER[minRealm];
  const max = REALM_ORDER[maxRealm];
  return BLUEPRINTS.filter(({ level }) => {
    const order = REALM_ORDER[getLevelRealmStage(level).realm];
    return order >= min && order <= max;
  });
}

const reward = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('spirit_stones'),
    chanceBps,
    min: spiritStones,
    max: spiritStones,
  }),
  z.strictObject({ type: z.literal('superior_book'), chanceBps, quantity }),
  z
    .strictObject({
      type: z.literal('blueprint'),
      chanceBps,
      quantity,
      minRealm: realm,
      maxRealm: realm,
    })
    .refine(
      ({ minRealm, maxRealm }) =>
        blueprintCandidates(minRealm, maxRealm).length > 0,
      { path: ['maxRealm'], message: '图纸境界范围内没有可抽取的图纸' },
    ),
  z.strictObject({
    type: z.literal('material'),
    chanceBps,
    quantity,
    rank: materialRank,
  }),
  z
    .strictObject({
      type: z.literal('item'),
      chanceBps,
      item: RewardItemSchema.refine(
        ({ definitionId }) =>
          findItemDefinition(definitionId)?.kind !== 'mystery_bag',
        '奖池不能包含神秘储物袋',
      ),
      maxQuantity: quantity.optional(),
    })
    .refine(
      ({ item, maxQuantity }) =>
        maxQuantity === undefined ||
        (maxQuantity >= item.quantity &&
          RewardItemSchema.safeParse({ ...item, quantity: maxQuantity })
            .success),
      { path: ['maxQuantity'], message: '道具数量上限无效' },
    ),
]);

const packSchema = z.strictObject({
  materialFallbacks: z.record(
    materialRank,
    MaterialFactsSchema.omit({ rank: true }).extend({ type: materialType }),
  ),
  pools: z.record(
    z.enum(MYSTERY_BAG_IDS),
    z
      .array(reward)
      .min(1)
      .max(100)
      .superRefine((pool, ctx) => {
        if (
          pool.reduce((sum, entry) => sum + entry.chanceBps, 0) !== TOTAL_CHANCE
        )
          ctx.addIssue({
            code: 'custom',
            message: '各档奖池概率之和必须为 10000 基点',
          });
        for (const [index, entry] of pool.entries()) {
          if (entry.type === 'spirit_stones' && entry.min > entry.max)
            ctx.addIssue({
              code: 'custom',
              path: [index],
              message: '灵石下限不能高于上限',
            });
        }
      }),
  ),
});

export function loadMysteryBagRewards(input: unknown) {
  return packSchema.parse(input);
}

const rewards = loadMysteryBagRewards(MYSTERY_BAG_REWARD_DATA);
type MysteryBagReward = z.infer<typeof reward>;

export function rollMysteryBagReward(
  id: MysteryBagId,
  randomInt: (max: number) => number,
) {
  let roll = randomInt(TOTAL_CHANCE);
  for (const entry of rewards.pools[id]) {
    roll -= entry.chanceBps;
    if (roll < 0) return entry;
  }
  throw new Error('神秘储物袋抽奖值超出范围');
}

export function rollMysteryBagItemGrant(
  entry: Extract<MysteryBagReward, { type: 'item' | 'blueprint' }>,
  randomInt: (max: number) => number,
): ItemGrant {
  if (entry.type === 'blueprint') {
    const candidates = blueprintCandidates(entry.minRealm, entry.maxRealm);
    return {
      definitionId: candidates[randomInt(candidates.length)]!.id,
      quantity: entry.quantity,
    };
  }
  const min = entry.item.quantity;
  return {
    ...entry.item,
    quantity:
      entry.maxQuantity === undefined
        ? min
        : min + randomInt(entry.maxQuantity - min + 1),
  };
}

export function mysteryBagMaxSpiritStones(id: MysteryBagId): number {
  return rewards.pools[id].reduce(
    (max, entry) =>
      entry.type === 'spirit_stones' ? Math.max(max, entry.max) : max,
    0,
  );
}

export function mysteryBagFallbackMaterial(rank: z.infer<typeof materialRank>) {
  return { ...rewards.materialFallbacks[rank], rank };
}

function describeReward(entry: MysteryBagReward): string {
  switch (entry.type) {
    case 'spirit_stones': {
      const min = entry.min.toLocaleString('zh-CN');
      const max = entry.max.toLocaleString('zh-CN');
      return `灵石 × ${min === max ? min : `${min}–${max}`}`;
    }
    case 'superior_book':
      return `随机高级传承灵印 × ${entry.quantity}`;
    case 'blueprint': {
      const realms =
        entry.minRealm === entry.maxRealm
          ? entry.minRealm
          : `${entry.minRealm}–${entry.maxRealm}`;
      return `${realms}随机道装图纸 × ${entry.quantity}`;
    }
    case 'material':
      return `随机${entry.rank}材料 × ${entry.quantity}`;
    case 'item': {
      const min = entry.item.quantity;
      const max = entry.maxQuantity ?? min;
      return `${rewardDisplayItem(entry.item).name} × ${min === max ? min : `${min}–${max}`}`;
    }
  }
}

export function describeMysteryBagRewards(id: MysteryBagId) {
  return rewards.pools[id].map((entry) => ({
    label: describeReward(entry),
    chance: `${entry.chanceBps / 100}%`,
  }));
}
