import type {
  TowerReward,
  TowerRewardPreview,
} from '@daoyou/game-domain/tower';
import { rollDrops } from '../drops/index.js';
import { SeededRng } from '@daoyou/combat-core/rng';
import { blueprintDropEntries } from './blueprint-distribution.js';
import { getRealmStageLevel as combatCharacterLevel } from '@daoyou/game-domain/progression';
import { itemDefinition } from '../inventory/index.js';
import { hashTowerSeed } from '../tower/helpers.js';
import { REALM_ORDER, type RealmType } from '@daoyou/constants/realms';
import { CHARACTER_MANUALS_V1 } from '@daoyou/game-content/manuals';
import { TOWER_REWARD_PACK } from './tower-pack.js';

function eligibleRewardItems(
  drop: (typeof TOWER_REWARD_PACK)['floors'][number]['drops'][number],
  realm: RealmType,
  pack: typeof TOWER_REWARD_PACK,
) {
  const ids =
    drop.source.kind === 'item'
      ? [drop.source.definitionId]
      : pack.pools[drop.source.poolId].entries;
  const advanced = REALM_ORDER[realm] >= REALM_ORDER['化神'];
  if (drop.source.kind === 'pool' && pack.pools[drop.source.poolId].kind === 'blueprint') {
    const allowed = new Set(
      blueprintDropEntries(
        realm,
        drop.id === 'blueprint-extra' ? 'near' : 'lower',
      ).map((entry) => entry.rewardId),
    );
    return ids.filter((id) => allowed.has(id));
  }
  return ids.filter((id) => {
    const item = itemDefinition(id);
    if (item.kind === 'blueprint') return false;
    if (item.kind !== 'manual_jade') return true;
    const manual = CHARACTER_MANUALS_V1.find((row) => row.id === item.manualId);
    if (!manual) return false;
    return advanced
      ? REALM_ORDER[manual.realm] >= REALM_ORDER['化神']
      : manual.realm === realm;
  });
}

export function towerRewardPreviews(
  realm: RealmType,
  pack = TOWER_REWARD_PACK,
): TowerRewardPreview[] {
  return pack.floors
    .map((row) => ({
      floor: row.floor,
      spiritStones:
        combatCharacterLevel(realm, '初期') * row.spiritStonesPerLevel,
      reputation: row.reputation,
      drops: row.drops.map((drop) => ({
        id: drop.id,
        random: drop.source.kind === 'pool',
        definitionIds: eligibleRewardItems(drop, realm, pack),
        chance: drop.chance,
        quantity: drop.quantity,
        label:
          drop.source.kind === 'item'
            ? itemDefinition(drop.source.definitionId).name
            : pack.pools[drop.source.poolId].label,
        realmLimited:
          drop.source.kind === 'pool' &&
          pack.pools[drop.source.poolId].kind !== 'beast_book',
      })),
    }))
    .sort((a, b) => a.floor - b.floor);
}

/** Server supplies the run seed and admitted realm. Frozen receipts are never rerolled. */
export function planTowerReward(
  floor: number,
  seed: number,
  realm: RealmType,
  pack = TOWER_REWARD_PACK,
): TowerReward {
  const row = pack.floors.find((row) => row.floor === floor);
  if (!row) throw new Error('无效的幻境奖励楼层');
  const level = combatCharacterLevel(realm, '初期');
  const items: TowerReward['items'] = [];
  if (row.drops.length) {
    const result = rollDrops(
      {
        id: `tower.floor.${floor}`,
        version: pack.contentRevision,
        groups: row.drops.map((drop) => {
          const eligible = eligibleRewardItems(drop, realm, pack);
          const blueprintWeights = new Map(
            drop.source.kind === 'pool' &&
            pack.pools[drop.source.poolId].kind === 'blueprint'
              ? blueprintDropEntries(
                  realm,
                  drop.id === 'blueprint-extra' ? 'near' : 'lower',
                ).map((entry) => [entry.rewardId, entry.weight])
              : [],
          );
          return {
            id: drop.id,
            chance: drop.chance,
            entries: eligible.map((rewardId) => ({
              rewardId,
              weight: blueprintWeights.get(rewardId) ?? 1,
              quantity: { min: drop.quantity, max: drop.quantity },
            })),
          };
        }),
      },
      (group) => {
        const rng = new SeededRng(
          hashTowerSeed(
            `${seed}:tower:${floor}:${pack.contentRevision}:${group}`,
          ),
        );
        return () => rng.next();
      },
    );
    for (const reward of result.rewards) {
      const existing = items.find(
        (item) => item.definitionId === reward.rewardId,
      );
      if (existing) existing.quantity += reward.quantity;
      else
        items.push({
          definitionId: reward.rewardId,
          quantity: reward.quantity,
        });
    }
  }
  return {
    floor,
    spiritStones: level * row.spiritStonesPerLevel,
    reputation: row.reputation,
    items,
  };
}
