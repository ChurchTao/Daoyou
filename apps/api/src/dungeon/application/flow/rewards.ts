import type { RealmType } from '@daoyou/constants/realms';
import { DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM } from '@daoyou/game-content/rewards/dungeon';
import { getMapNode } from '@daoyou/game-content/world/map';
import type { DungeonRewardPlan } from '@daoyou/game-domain/dungeon';
import {
  type DungeonRewardEntry,
  type DungeonRewardSource,
} from '@daoyou/game-domain/dungeon';
import { MaterialFactsSchema } from '@daoyou/game-domain/inventory';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import {
  planDungeonReward,
  planDungeonStepResources,
} from '@daoyou/game-rules/rewards/dungeon';
import { resolveDungeonMapConfig } from '@daoyou/game-rules/world/dungeon';
import type { DungeonState } from '@server/dungeon/application/flow/types.js';
import { generateRealmMaterials } from '@server/inventory/application/MaterialRewardService.js';
import type { DbExecutor } from '@server/lib/drizzle/db.js';

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
  return { key, ...resources, items: await resolvePlanItems(plan, executor) };
}

/** 把掉落计划解析成具体物品：材料按种子从材料库取，重试结果不变。 */
export async function resolvePlanItems(
  plan: DungeonRewardPlan,
  executor?: DbExecutor,
) {
  const materials = await generateRealmMaterials(
    plan.materialRealm,
    plan.materialCount,
    plan.materialSeed,
    true,
    executor,
    DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM[plan.materialRealm],
  );
  return [
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
  ];
}
