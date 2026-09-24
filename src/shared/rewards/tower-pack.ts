import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import {
  equipmentRealm,
  isOpenEquipmentLevel,
} from '../engine/combat-v6/equipment/realm';
import { combatCharacterLevel } from '../engine/combat-v6/projection/character-level';
import { findItemDefinition } from '../items/registry';
import { TOWER_MIN_REALM } from '../lib/tower/helpers';
import raw from './data/tower.json';

const integer = z.number().int().min(0).max(1000000);
const drop = z.strictObject({
  id: z.string().min(1),
  chance: z.number().min(0).max(1),
  quantity: integer.min(1).max(99),
  source: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('item'), definitionId: z.string() }),
    z.strictObject({ kind: z.literal('pool'), poolId: z.string() }),
  ]),
});
export const TowerRewardPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(3),
  contentRevision: integer.min(1),
  pools: z.record(
    z.string(),
    z.strictObject({
      label: z.string().min(1),
      kind: z.enum(['beast_book', 'blueprint']),
      entries: z.array(z.string()).min(1),
    }),
  ),
  floors: z
    .array(
      z.strictObject({
        floor: integer.min(1).max(20),
        spiritStonesPerLevel: integer,
        reputation: integer,
        drops: z.array(drop).max(10),
      }),
    )
    .length(20),
});
export function loadTowerRewardPack(data: unknown) {
  const result = TowerRewardPackShape.safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors(
        'rewards/data/tower.json',
        data,
        result.error.issues,
      ),
    );
  const pack = result.data;
  if (new Set(pack.floors.map((row) => row.floor)).size !== 20)
    throw new Error('tower.json：必须完整覆盖1–20层且不能重复');
  for (const pool of Object.values(pack.pools)) {
    if (
      new Set(pool.entries).size !== pool.entries.length ||
      pool.entries.some((id) => findItemDefinition(id)?.kind !== pool.kind)
    )
      throw new Error('tower.json：物品池引用无效、类型错误或重复');
  }
  for (const pool of Object.values(pack.pools)) {
    if (
      pool.kind === 'blueprint' &&
      !pool.entries.some((id) => {
        const item = findItemDefinition(id)!;
        return (
          isOpenEquipmentLevel(item.level!) &&
          equipmentRealm(item.level!).requiredLevel <=
            combatCharacterLevel(TOWER_MIN_REALM, '初期')
        );
      })
    )
      throw new Error('tower.json：图纸池必须包含最低挑战境界可用的已开放图纸');
  }
  for (const row of pack.floors) {
    if (new Set(row.drops.map((drop) => drop.id)).size !== row.drops.length)
      throw new Error('tower.json：掉落组ID重复');
    for (const drop of row.drops) {
      if (drop.source.kind === 'pool') {
        if (!pack.pools[drop.source.poolId])
          throw new Error('tower.json：未知奖励池');
      } else if (
        findItemDefinition(drop.source.definitionId)?.kind !==
        'beast_refinement'
      ) {
        throw new Error('tower.json：固定奖励必须是已注册归元灵露');
      }
    }
  }
  return pack;
}
export const TOWER_REWARD_PACK = loadTowerRewardPack(raw);
