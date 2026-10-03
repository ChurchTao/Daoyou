import { TYPE_DESCRIPTIONS } from '@daoyou/shared/engine/material/creation/config';
import {
  calculateDungeonMaterialCost,
  calculateDungeonResourceCost,
  calculateDungeonStatLoss,
} from '@daoyou/shared/lib/dungeon/costPolicy';
import {
  getMapNode,
  resolveDungeonMapConfig,
  type SatelliteNode,
} from '@daoyou/shared/lib/game/mapSystem';
import { REALM_VALUES, type RealmType } from '@daoyou/shared/types/constants';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { generateAiObject } from '@server/utils/aiClient.js';
import { stableCompactStringify } from '@server/utils/llmPayload.js';
import { buildDungeonRoundLlmContext } from './llmContext.js';
import {
  createDungeonRoundLlmSchema,
  DungeonRoundSchema,
  type DungeonOptionCost,
  type DungeonRound,
  type DungeonRoundLlmContext,
  type DungeonState,
} from './types.js';

const DUNGEON_MATERIAL_TYPE_GUIDE = Object.entries(TYPE_DESCRIPTIONS)
  .map(([key, desc]) => `${key}=${desc}`)
  .join('；');

function calculateRealmGap(playerRealm: string, mapRealm: RealmType): number {
  // 提取玩家境界（去掉阶段）
  const playerRealmName = playerRealm.split(' ')[0] as RealmType;

  const playerIndex = REALM_VALUES.indexOf(playerRealmName);
  const mapIndex = REALM_VALUES.indexOf(mapRealm);

  if (playerIndex === -1 || mapIndex === -1) {
    console.warn('[DungeonService] 无法识别境界:', { playerRealm, mapRealm });
    return 0;
  }

  return playerIndex - mapIndex;
}

function getPhase(
  currentRound: number,
  maxRounds: number,
  realmGap: number,
): string {
  // 境界碾压场景：简化剧情，降低风险
  if (realmGap >= 2) {
    if (currentRound === 1) return '探索期：境界占优，宜顺势探查。';
    if (currentRound < maxRounds - 1) return '收获期：可稳取资源，代价宜轻。';
    if (currentRound === maxRounds - 1) return '收尾期：阻碍将尽，风险应低。';
    return '圆满期：可稳妥结局，满载而归。';
  }

  // 正常场景
  if (currentRound === 1) return '潜入期：先探环境、阵法与入口。';
  if (currentRound < maxRounds - 1) return '变局期：引入转折，开始消耗资源。';
  if (currentRound === maxRounds - 1)
    return '夺宝期：副本高潮，风险应显著抬升。';
  return '结尾期：根据前情收束结局与余波。';
}

export async function generateDungeonRound(
  state: DungeonState,
): Promise<DungeonRound> {
  const mapNode = getMapNode(state.mapNodeId);
  const mapRealm =
    mapNode && 'realm_requirement' in mapNode
      ? (mapNode as SatelliteNode).realm_requirement
      : ('筑基' as RealmType);
  const mapConfig = mapNode
    ? resolveDungeonMapConfig(mapNode)
    : resolveDungeonMapConfig({
        id: 'fallback-dungeon-map',
        name: '未知秘境',
        parent_id: 'fallback',
        type: '秘境',
        realm_requirement: mapRealm,
        tags: [],
        description: '',
      });
  const realmGap = calculateRealmGap(state.playerInfo.realm, mapRealm);
  const phase = getPhase(state.currentRound, state.maxRounds, realmGap);
  const userContext: DungeonRoundLlmContext = buildDungeonRoundLlmContext({
    state,
    mapConfig,
    realmGap,
    phase,
  });

  const { system: roundPrompt, user: roundUserPrompt } = renderPrompt(
    'dungeon-round',
    {
      materialTypeTable: DUNGEON_MATERIAL_TYPE_GUIDE,
      userContextJson: stableCompactStringify(userContext),
    },
  );
  const aiRes = await generateAiObject({
    system: roundPrompt,
    prompt: roundUserPrompt,
    schema: createDungeonRoundLlmSchema(0),
    name: 'DungeonRound',
    sceneId: 'dungeon-round',
  });

  return DungeonRoundSchema.parse({
    scene_description: aiRes.output.scene_description,
    interaction: {
      options: aiRes.output.options.map((option, index) => {
        const costs: DungeonOptionCost[] = [
          ...option.costs.resources.map((cost) => ({
            type: cost.type,
            value: calculateDungeonResourceCost({
              ...cost,
              realm: mapConfig.realmRequirement,
              difficulty: mapConfig.difficultyTier,
            }),
          })),
          ...option.costs.materials.map((cost) => {
            const resolved = calculateDungeonMaterialCost({
              realm: mapConfig.realmRequirement,
              difficulty: mapConfig.difficultyTier,
              rank: cost.rank,
            });
            return {
              type: 'material' as const,
              required_type: cost.required_type,
              required_quality: resolved.requiredQuality,
              value: resolved.value,
            };
          }),
          ...option.costs.stat_losses.map((cost) => ({
            type: cost.type,
            value: calculateDungeonStatLoss({
              realm: mapConfig.realmRequirement,
              difficulty: mapConfig.difficultyTier,
              rank: cost.rank,
            }),
          })),
          ...option.costs.battles.map((metadata) => ({
            type: 'battle' as const,
            value: 1,
            metadata,
          })),
        ];
        return {
          text: option.text,
          id: index + 1,
          risk_level: (['low', 'high', 'medium'] as const)[index] ?? 'medium',
          costs,
        };
      }),
    },
    acquired_items: [],
    status_update: {
      is_final_round: state.currentRound >= state.maxRounds,
      internal_danger_score: aiRes.output.internal_danger_score,
    },
  });
}
