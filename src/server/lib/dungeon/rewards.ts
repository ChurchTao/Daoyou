import type { DbExecutor } from '@server/lib/drizzle/db';
import { generateRealmMaterials } from '@server/lib/services/MaterialRewardService';
import { getRealmStageLevel } from '@shared/config/realmProgression';
import { MaterialFactsSchema } from '@shared/items/definitions/materials';
import {
  getMapNode,
  resolveDungeonMapConfig,
} from '@shared/lib/game/mapSystem';
import {
  planDungeonReward,
  planDungeonStepResources,
  type DungeonRewardEntry,
  type DungeonRewardSource,
} from '@shared/rewards/dungeon';
import type { RealmType } from '@shared/types/constants';
import type { DungeonState } from './types';

/** Resolve library facts before recording rewards; retries reuse recorded facts. */
export async function resolveDungeonReward(
  state: DungeonState,
  key: string,
  source: DungeonRewardSource,
  executor?: DbExecutor,
): Promise<DungeonRewardEntry> {
  const existing = state.v6Rewards?.find((reward) => reward.key === key);
  if (existing) return existing;
  if (state.rewardSeed === undefined) throw new Error('旧秘境会话需维护处理');
  const map = getMapNode(state.mapNodeId);
  if (!map || !('realm_requirement' in map)) throw new Error('秘境地图无效');
  const seed = state.rewardSeed;
  const mapRealm = map.realm_requirement as RealmType;
  const level = getRealmStageLevel(mapRealm, '初期');
  const plan = planDungeonReward(seed, key, source, level);
  const resources = planDungeonStepResources(seed, key, source, {
    mapRealm,
    playerRealm: state.playerInfo.realm.split(' ')[0] as RealmType,
    dangerScore: state.dangerScore,
    difficultyTier: resolveDungeonMapConfig(map).difficultyTier,
  });
  const materials = await generateRealmMaterials(
    plan.materialRealm,
    plan.materialCount,
    plan.materialSeed,
    true,
    executor,
  );
  return {
    key,
    ...resources,
    items: [
      ...plan.items,
      ...materials.map((material) => ({
        definitionId: 'material.v1',
        quantity: 1,
        instanceData: MaterialFactsSchema.parse({
          name: material.name,
          type: material.type,
          rank: material.rank,
          element: material.element ?? null,
          description: material.description ?? '',
        }),
      })),
    ],
  };
}
