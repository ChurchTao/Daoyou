import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher';
import { renderPrompt } from '@server/lib/prompts';
import { findActiveCultivatorOwnerId } from '@server/lib/repositories/cultivatorRepository';
import type { BattleRecordV3 } from '@server/lib/services/battleResult';
import {
  loadCultivatorCombatInput,
  loadCultivatorDungeonPromptFacts,
} from '@server/lib/services/cultivator/CultivatorCombatProjectionReader';
import { getPaginatedInventoryByType } from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import { updateCultivator } from '@server/lib/services/cultivator/CultivatorStateRepository';
import { resourceEngine } from '@server/lib/services/resource/ResourceEngine';
import { generateAiObject } from '@server/utils/aiClient';
import { stableCompactStringify } from '@server/utils/llmPayload';
import { getRealmStageNaturalAttributeValue } from '@shared/config/realmProgression';
import { BasicAttackOnlySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { CultivatorDisplayInput } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { EnemyGenerator } from '@shared/engine/enemyGenerator';
import { TYPE_DESCRIPTIONS } from '@shared/engine/material/creation/config';
import type {
  ResourceOperation,
  ResourceOperationResult,
  ResourceOperationSettlement,
} from '@shared/engine/resource/types';
import type { DungeonBattlePlan } from '@shared/lib/dungeon/battlePlan';
import { normalizeDungeonResourceTerminology } from '@shared/lib/dungeon/narrativeTerminology';
import type { SatelliteNode } from '@shared/lib/game/mapSystem';
import {
  canChallengeDungeonRealm,
  clampDungeonEnemyRealmStage,
  getMapNode,
  isSatelliteNode,
  resolveDungeonMapConfig,
} from '@shared/lib/game/mapSystem';
import type { CultivatorCondition } from '@shared/types/condition';
import {
  MaterialType,
  Quality,
  QUALITY_VALUES,
  REALM_STAGE_VALUES,
  REALM_VALUES,
  RealmType,
  type RealmStage,
} from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';
import { randomUUID } from 'crypto';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { getExecutor, type DbTransaction } from '../drizzle/db';
import { dungeonHistories, dungeonRuns } from '../drizzle/schema';
import { redis } from '../redis';
import { parseRedisJson } from '../redis/json';
import {
  isRedisLockContention,
  redisLockKeys,
  withRedisLock,
  type RedisLeaseContext,
} from '../redis/lock';
import { executePersistentWorldBattle } from '../services/BattleStateCoordinator';
import { ConditionService } from '../services/ConditionService';
import { QiService } from '../services/QiService';
import { ServerEnemyCopyProvider } from '../services/ServerEnemyCopyProvider';
import {
  buildDungeonRoundLlmContext,
  buildDungeonSettlementLlmContext,
} from './llmContext';
import type { RewardBlueprint } from './reward';
import { RewardFactory } from './reward';
import {
  BattleSession,
  createDungeonRoundLlmSchema,
  createDungeonSettlementLlmSchema,
  DungeonBranchCheckpoint,
  DungeonExplorationRecord,
  DungeonOption,
  DungeonOptionCost,
  DungeonPendingAction,
  DungeonRecoverAction,
  DungeonRound,
  DungeonRoundLlmContext,
  DungeonRoundSchema,
  DungeonSettlement,
  DungeonSettlementGeneratedSchema,
  DungeonSettlementLlmContext,
  DungeonSettlementSchema,
  DungeonState,
  PlayerInfo,
} from './types';

const dungeonEnemyGenerator = new EnemyGenerator({
  copyProvider: new ServerEnemyCopyProvider({
    enabled: process.env.NODE_ENV !== 'test',
  }),
});

const REDIS_TTL = 3600; // 1 hour expiration for active sessions
const FLOW_LOCK_TTL_SECONDS = 180;
const RUN_TERMINAL_STATUSES = new Set(['FINISHED']);
const DUNGEON_REWARD_BLUEPRINT_LIMIT = 5;
const DUNGEON_EVENT_COUNT = 5;
const EXPLORATION_EXP_BONUS_PER_LEAD = 0.1;
const MAX_EXPLORATION_EXP_BONUS = 0.3;
export const DungeonFlowErrorCode = {
  NOT_FOUND: 'DUNGEON_NOT_FOUND',
  INVALID_STATE: 'DUNGEON_INVALID_STATE',
  GENERATION_FAILED: 'DUNGEON_GENERATION_FAILED',
} as const;

export type DungeonFlowErrorCode =
  (typeof DungeonFlowErrorCode)[keyof typeof DungeonFlowErrorCode];

export class DungeonFlowError extends Error {
  constructor(
    public code: DungeonFlowErrorCode,
    message: string,
    public status: 404 | 409 | 503,
  ) {
    super(message);
    this.name = 'DungeonFlowError';
  }
}

class DungeonSettlementRecoverableError extends Error {
  constructor(
    message: string,
    public actions: DungeonRecoverAction[],
  ) {
    super(message);
    this.name = 'DungeonSettlementRecoverableError';
  }
}

type DungeonSettlementResult = {
  state?: DungeonState;
  settlement?: DungeonSettlement;
  isFinished: boolean;
  realGains?: ResourceOperation[];
  persist?: (tx: DbTransaction) => Promise<DungeonPersistenceSettlement | void>;
  afterCommit?: () => Promise<void>;
};

type DungeonSettlementOptions = {
  skipInjury?: boolean;
  abandonedBattle?: boolean;
  endDisposition?: DungeonSettlementLlmContext['endDisposition'];
  battleDefeated?: boolean;
  pendingAction?: DungeonPendingAction;
  deferPersistence?: boolean;
};

type DungeonFlowOptions = {
  deferPersistence?: boolean;
  lease?: RedisLeaseContext;
};

type DungeonRoundGenerationMode = 'initial' | 'advance' | 'terminal';

type DungeonPersistenceHooks = {
  persist: (tx: DbTransaction) => Promise<DungeonPersistenceSettlement | void>;
  afterCommit: () => Promise<void>;
};

export interface DungeonPersistenceSettlement {
  condition?: Cultivator['condition'];
  currency?: {
    spiritStones?: number;
    reputation?: number;
    qi?: number;
    qiLastRefreshedAt?: string | null;
  };
  progress?: Cultivator['cultivation_progress'];
  profile?: {
    lifespan?: number;
  };
  inventoryChanges?: ResourceOperationSettlement['inventoryChanges'];
}

function mergeDungeonPersistenceSettlements(
  ...settlements: Array<DungeonPersistenceSettlement | null | undefined>
): DungeonPersistenceSettlement {
  const merged: DungeonPersistenceSettlement = {};
  const inventoryChanges: ResourceOperationSettlement['inventoryChanges'] = [];
  for (const settlement of settlements) {
    if (!settlement) continue;
    if (settlement.condition !== undefined) {
      merged.condition = settlement.condition;
    }
    if (settlement.progress !== undefined) {
      merged.progress = settlement.progress;
    }
    if (settlement.currency) {
      merged.currency = { ...merged.currency, ...settlement.currency };
    }
    if (settlement.profile) {
      merged.profile = { ...merged.profile, ...settlement.profile };
    }
    inventoryChanges.push(...(settlement.inventoryChanges ?? []));
  }
  if (inventoryChanges.length > 0) {
    merged.inventoryChanges = inventoryChanges;
  }
  return merged;
}

function toDungeonPersistenceSettlement(
  result: ResourceOperationResult,
): DungeonPersistenceSettlement {
  const settlement: ResourceOperationSettlement | undefined = result.settlement;
  if (!settlement) return {};
  return {
    currency: {
      ...(settlement.spiritStones !== undefined
        ? { spiritStones: settlement.spiritStones }
        : {}),
      ...(settlement.reputation !== undefined
        ? { reputation: settlement.reputation }
        : {}),
    },
    ...(settlement.lifespan !== undefined
      ? { profile: { lifespan: settlement.lifespan } }
      : {}),
    ...(settlement.cultivationProgress
      ? { progress: settlement.cultivationProgress }
      : {}),
    inventoryChanges: settlement.inventoryChanges,
  };
}

function rewardBlueprintKey(reward: RewardBlueprint): string {
  return [
    reward.name?.trim() ?? '',
    reward.material_type ?? '',
    reward.element ?? '',
    reward.description?.trim() ?? '',
  ].join('|');
}

function selectMostValuableRewardBlueprints(
  rewards: RewardBlueprint[] | undefined,
  limit: number,
): RewardBlueprint[] {
  if (!rewards?.length || limit <= 0) return [];
  if (rewards.length <= limit) return rewards;

  return rewards
    .map((reward, index) => ({
      reward,
      index,
      score:
        typeof reward.reward_score === 'number' &&
        Number.isFinite(reward.reward_score)
          ? reward.reward_score
          : 0,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.reward);
}

function appendRoundRewards(
  state: DungeonState,
  acquiredItems: RewardBlueprint[] | undefined,
): RewardBlueprint[] {
  const remainingSlots = Math.max(
    0,
    DUNGEON_REWARD_BLUEPRINT_LIMIT - (state.accumulatedRewards?.length ?? 0),
  );
  const acceptedItems = (acquiredItems ?? []).slice(0, remainingSlots);
  state.currentRoundItems = acceptedItems;
  if (acceptedItems.length) {
    if (!state.accumulatedRewards) state.accumulatedRewards = [];
    state.accumulatedRewards.push(...acceptedItems);
  }
  return acceptedItems;
}

function recordGeneratedActionResult(
  state: DungeonState,
  roundData: DungeonRound,
): RewardBlueprint[] {
  const acceptedItems = appendRoundRewards(state, roundData.acquired_items);
  const historyEntry = state.history[state.history.length - 1];
  if (historyEntry?.choice) {
    historyEntry.outcome =
      roundData.action_outcome?.trim() ||
      historyEntry.outcome ||
      roundData.scene_description.trim();
    const gainedNames = acceptedItems.map((item) => item.name || '未知物品');
    historyEntry.gained_items = Array.from(
      new Set([...(historyEntry.gained_items ?? []), ...gainedNames]),
    );
  }
  state.dangerScore = roundData.status_update.internal_danger_score;
  return acceptedItems;
}

function discardCurrentRoundRewards(state: DungeonState): RewardBlueprint[] {
  const discardedItems = state.currentRoundItems ?? [];
  if (discardedItems.length === 0) return [];

  const accumulatedRewards = state.accumulatedRewards ?? [];
  state.accumulatedRewards = accumulatedRewards.slice(
    0,
    Math.max(0, accumulatedRewards.length - discardedItems.length),
  );
  state.currentRoundItems = [];
  state.exploredExplorationLeads = (
    state.exploredExplorationLeads ?? []
  ).filter((entry) => entry.completedRound !== state.currentRound);

  const currentHistory = [...state.history]
    .reverse()
    .find((entry) => entry.round === state.currentRound);
  if (currentHistory) currentHistory.gained_items = [];

  return discardedItems;
}

function normalizeSettlementRewards(
  settlement: DungeonSettlement,
  accumulatedRewards: RewardBlueprint[],
  allowExtraRewards = true,
): DungeonSettlement {
  const inheritedRewards = selectMostValuableRewardBlueprints(
    accumulatedRewards,
    DUNGEON_REWARD_BLUEPRINT_LIMIT,
  );
  const inheritedKeys = new Set(inheritedRewards.map(rewardBlueprintKey));
  const extraRewards = allowExtraRewards
    ? settlement.settlement.reward_blueprints.filter(
        (reward) => !inheritedKeys.has(rewardBlueprintKey(reward)),
      )
    : [];
  const reward_blueprints = [...inheritedRewards, ...extraRewards].slice(
    0,
    DUNGEON_REWARD_BLUEPRINT_LIMIT,
  );
  const performance_tags = sanitizePerformanceTags(
    settlement.settlement.performance_tags,
    settlement.settlement.reward_tier,
  );

  return DungeonSettlementSchema.parse({
    ...settlement,
    settlement: {
      ...settlement.settlement,
      reward_blueprints,
      performance_tags,
    },
  });
}

function sanitizePerformanceTags(tags: string[], rewardTier: string): string[] {
  const overclaimPattern = /精通|宗师|大师|无敌|彻底掌控|圆满掌控/u;
  const sanitized = Array.from(
    new Set(
      tags
        .map((tag) => tag.match(/[\p{Script=Han}0-9]+/gu)?.join('') ?? '')
        .map((tag) => tag.slice(0, 12))
        .filter((tag) => tag.length >= 2 && !overclaimPattern.test(tag)),
    ),
  ).slice(0, 4);

  if (sanitized.length > 0) return sanitized;
  if (rewardTier === 'S' || rewardTier === 'A') return ['机缘深厚'];
  if (rewardTier === 'B') return ['稳中有得'];
  return ['及时收手'];
}

const DEFAULT_RECOVERABLE_ACTIONS: DungeonRecoverAction[] = [
  'safe_retreat',
  'force_quit',
];
const CONTINUE_RECOVERABLE_ACTIONS: DungeonRecoverAction[] = [
  'retry_continue',
  'safe_retreat',
  'force_quit',
];
const SETTLE_RECOVERABLE_ACTIONS: DungeonRecoverAction[] = [
  'retry_settle',
  'force_quit',
];
const ACTION_RECOVERABLE_ACTIONS: DungeonRecoverAction[] = [
  'retry',
  'safe_retreat',
  'force_quit',
];

function normalizeLegacySixAttributes(
  attributes: Record<string, unknown>,
  realm: string,
  stage: string,
) {
  const realmValue = REALM_VALUES.includes(realm as RealmType)
    ? (realm as RealmType)
    : REALM_VALUES[0];
  const stageValue = REALM_STAGE_VALUES.includes(stage as RealmStage)
    ? (stage as RealmStage)
    : REALM_STAGE_VALUES[0];
  const naturalValue = getRealmStageNaturalAttributeValue(
    realmValue,
    stageValue,
  );

  if (typeof attributes.strength !== 'number') {
    attributes.strength = naturalValue;
  }
  if (typeof attributes.endurance !== 'number') {
    attributes.endurance =
      typeof attributes.wisdom === 'number' ? attributes.wisdom : naturalValue;
  }
}

const COST_LIMITS: Partial<Record<DungeonOptionCost['type'], number>> = {
  spirit_stones: 10_000_000,
  lifespan: 10_000,
  cultivation_exp: 1_000_000,
  comprehension_insight: 100,
  material: 999,
  hp_loss: 1,
  mp_loss: 1,
  weak: 10,
  battle: 100,
  artifact_damage: 100,
};
const DUNGEON_MATERIAL_TYPE_TABLE = Object.entries(TYPE_DESCRIPTIONS)
  .map(([key, desc]) => `| ${key} | ${desc} |`)
  .join('\n');

function assertDungeonRealmEligible(
  playerRealm: RealmType,
  dungeonRealm: RealmType,
) {
  if (!canChallengeDungeonRealm(playerRealm, dungeonRealm)) {
    throw new Error(
      `当前境界${playerRealm}不可挑战${dungeonRealm}副本，请先提升大境界`,
    );
  }
}

// Helper to generate Redis key
function getDungeonKey(cultivatorId: string) {
  return `dungeon:active:${cultivatorId}`;
}

function getDungeonBattleKey(battleId: string) {
  return `dungeon:battle:${battleId}`;
}

interface DungeonBattleCachePayload {
  session: BattleSession;
  enemyObject: Cultivator;
}

function isActiveRunStatus(status: string | null | undefined) {
  return Boolean(status && !RUN_TERMINAL_STATUSES.has(status));
}

function cloneCosts(
  costs: DungeonOptionCost[] | undefined,
): DungeonOptionCost[] {
  return costs
    ? costs.map((cost) => ({
        ...cost,
        metadata: cost.metadata ? { ...cost.metadata } : undefined,
      }))
    : [];
}

function normalizeExplorationTarget(
  target: string | undefined,
  fallback: string,
): string {
  const normalized = (target || fallback)
    .replace(/[【】]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 30);
  return normalized || '当前线索';
}

function explorationTargetKey(target: string): string {
  return normalizeExplorationTarget(target, '当前线索')
    .replace(/[，。！？、：；,.!?;:\s]/gu, '')
    .toLocaleLowerCase();
}

const DEFEATED_ENEMY_RESOLUTION_PATTERN =
  /击败|斩杀|杀死|伏诛|陨落|毙命|倒毙|已死|死去|死后|尸体|尸身|遗骸|残骸|妖丹|尸骨|巢穴|旧巢/u;
const EMBEDDED_OPTION_PATTERN =
  /(?:【\s*)?选项\s*(?:[一二三123]|[:：])|抉择时刻/u;
const REWARD_NAME_KEY_PATTERN = /[【】「」『』\s，。！？、：；,.!?;:·]/gu;
const EXPLORATION_TARGET_ACTION_PATTERN =
  /^(?:尝试|直接|谨慎|强行|冒险|施展|使用|以|用|将|对|继续)?(?:安抚|捏碎|吞噬|炼化|修复|击杀|斩杀|探查|探索|进入|冲击|提取|收取|打开|开启|破解|绕过|潜入|观察|靠近|搜刮|触碰|投入|推演)/u;
const CONDITIONAL_COST_DESCRIPTION_PATTERN =
  /若失败|失败则|若成功|成功则|可能扣除|可能损失|有概率|视情况/u;
const UNCONFIRMED_DEFEAT_PATTERN =
  /击败|击杀|斩杀|杀死|诛杀|镇杀|伏诛|毙命|倒毙|吞噬殆尽/u;
const PREEXISTING_MONSTER_REMAINS_PATTERN =
  /遗骸|尸骸|尸骨|残骸|枯骨|蜕皮|兽骨|旧巢|风化尸身/u;
const COMBAT_ENGAGEMENT_PATTERN =
  /(?:(?:击杀|斩杀|杀死|诛杀|迎战|应战|硬撼|搏杀|交战|攻击|反击|围杀|镇杀|束缚|缠绕).{0,18}(?:妖|兽|魔|鬼|敌|守卫|傀儡|蛛|狼|蛇|蝠)|(?:妖|兽|魔|鬼|敌|守卫|傀儡|蛛|狼|蛇|蝠).{0,18}(?:击杀|斩杀|杀死|诛杀|迎战|应战|硬撼|搏杀|交战|攻击|反击|围杀|镇杀|束缚|缠绕))/u;
const CONCRETE_ITEM_USE_PATTERN =
  /(?:取出|掏出|祭出|夹住|夹着|服下|吞服|掷出|催动).{0,18}(?:丹药|丹|符箓|阵旗|法宝|灵器|法器|玉简|令牌)/gu;
const EXPLORATION_EVIDENCE_NOISE_PATTERN =
  /[【】「」『』（）()\s，。！？、：；,.!?;:·的之其被于]/gu;
const CURRENT_BRANCH_RETURN_HINT =
  '你也未忘记先前留下的未完成分支，此刻可以折返。';
const ONLY_BRANCH_RETURN_HINT =
  '此路已告一段落，你循原路折返，先前记下的未完成分支仍可选择。';
const UNSUPPORTED_MECHANICAL_EFFECT_PATTERNS = [
  /(?:提升|提高|增加|增强|强化|精进|完善).{0,12}(?:攻击力|防御力|速度|闪避率|命中率|暴击率|修为|阵法造诣|炼丹造诣|炼器造诣|功法威力)/u,
  /(?:攻击力|防御力|速度|闪避率|命中率|暴击率|修为|阵法造诣|炼丹造诣|炼器造诣|功法威力).{0,12}(?:提升|提高|增加|增长|增强|强化|精进|完善)/u,
  /(?:功法|心法|剑诀|法诀|真解|秘术).{0,24}(?:融入|炼入|吸收|纳入).{0,24}(?:雷劲|雷霆|火劲|寒气|属性之力|元素之力|天地之力|真意)/u,
  /恢复.{0,6}(?:法力|气血)|(?:法力|气血).{0,6}(?:恢复|回满)|补充法力|转化为.{0,6}法力/u,
];

function optionNarrative(option: DungeonOption): string {
  return [
    option.exploration_target,
    option.action_mode,
    option.text,
    option.requirement,
    option.potential_cost,
  ]
    .filter(Boolean)
    .join(' ');
}

function normalizeExplorationEvidenceText(text: string): string {
  return text.replace(EXPLORATION_EVIDENCE_NOISE_PATTERN, '');
}

function isOrderedTextSubsequence(needle: string, haystack: string): boolean {
  if (!needle || !haystack) return false;
  let needleIndex = 0;
  for (const char of haystack) {
    if (char === needle[needleIndex]) needleIndex += 1;
    if (needleIndex >= needle.length) return true;
  }
  return false;
}

function isExplorationOptionGroundedInScene(
  option: DungeonOption,
  scene: string | undefined,
): boolean {
  if (!scene) return false;
  const target = normalizeExplorationEvidenceText(
    normalizeExplorationTarget(option.exploration_target, option.text),
  );
  const narrative = normalizeExplorationEvidenceText(scene);
  return target.length >= 2 && isOrderedTextSubsequence(target, narrative);
}

function explorationOptionSourceRound(
  option: DungeonOption,
  fallbackRound: number,
): number {
  const sourceRound = Number.parseInt(
    option.exploration_lead_id?.split(':')[0] ?? '',
    10,
  );
  return Number.isInteger(sourceRound) && sourceRound > 0
    ? sourceRound
    : fallbackRound;
}

function removeBranchReturnHints(scene: string): string {
  return scene
    .replaceAll(CURRENT_BRANCH_RETURN_HINT, '')
    .replaceAll(ONLY_BRANCH_RETURN_HINT, '')
    .replace(/\s+$/u, '');
}

function containsUnsupportedMechanicalEffect(text: string): boolean {
  return UNSUPPORTED_MECHANICAL_EFFECT_PATTERNS.some((pattern) =>
    pattern.test(text),
  );
}

function rewardNameKey(name: string | undefined): string {
  return (name ?? '')
    .replace(REWARD_NAME_KEY_PATTERN, '')
    .trim()
    .toLocaleLowerCase();
}

function rewardNameBigrams(name: string | undefined): Set<string> {
  const normalized = rewardNameKey(name);
  const bigrams = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    bigrams.add(normalized.slice(index, index + 2));
  }
  return bigrams;
}

function rewardNamesLookEquivalent(
  left: RewardBlueprint,
  right: RewardBlueprint,
): boolean {
  if (
    left.material_type &&
    right.material_type &&
    left.material_type !== right.material_type
  ) {
    return false;
  }
  if (left.element && right.element && left.element !== right.element) {
    return false;
  }

  const leftKey = rewardNameKey(left.name);
  const rightKey = rewardNameKey(right.name);
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  if (leftKey.length < 4 || rightKey.length < 4) return false;

  const leftBigrams = rewardNameBigrams(left.name);
  const rightBigrams = rewardNameBigrams(right.name);
  const overlap = Array.from(leftBigrams).filter((part) =>
    rightBigrams.has(part),
  ).length;
  const similarity =
    (overlap * 2) / Math.max(1, leftBigrams.size + rightBigrams.size);
  return similarity >= 0.72;
}

function ensureRewardAcquisitionNarrative(
  roundData: DungeonRound,
  lastActionTarget?: string,
): DungeonRound {
  const resultNarrative = roundData.action_outcome?.trim() ?? '';
  const missingRewardNames = (roundData.acquired_items ?? [])
    .map((reward) => reward.name?.trim())
    .filter(
      (name): name is string =>
        typeof name === 'string' &&
        name.length > 0 &&
        !resultNarrative.includes(name),
    );

  if (missingRewardNames.length === 0) return roundData;

  const acquisitionNarrative = missingRewardNames
    .map((name) =>
      lastActionTarget
        ? `完成对【${lastActionTarget}】的查探后，你取得并收起【${name}】。`
        : `你取得并收起【${name}】。`,
    )
    .join('');
  return {
    ...roundData,
    action_outcome: [roundData.action_outcome?.trim(), acquisitionNarrative]
      .filter(Boolean)
      .join('\n\n'),
  };
}

function formatActualActionCost(cost: DungeonOptionCost): string | null {
  if (cost.type === 'battle') return null;
  if (cost.type === 'material') {
    const materialName =
      cost.name ||
      [cost.required_quality, cost.required_type].filter(Boolean).join('') ||
      '材料';
    return `【${materialName}】×${cost.value}`;
  }
  if (cost.type === 'hp_loss' || cost.type === 'mp_loss') {
    const label = cost.type === 'hp_loss' ? '气血' : '法力';
    return `${label}-${Math.round(cost.value * 100)}%`;
  }
  const labels: Partial<Record<DungeonOptionCost['type'], string>> = {
    spirit_stones: '灵石',
    lifespan: '寿元',
    cultivation_exp: '修为',
    comprehension_insight: '感悟',
    weak: '虚弱',
    artifact_damage: '法宝损伤',
  };
  return `${labels[cost.type] ?? cost.desc ?? cost.type}-${cost.value}`;
}

function mentionsDefeatedEnemyAsActive(text: string, enemyName: string) {
  return (
    text.includes(enemyName) && !DEFEATED_ENEMY_RESOLUTION_PATTERN.test(text)
  );
}

function optionTargetsDefeatedEnemy(option: DungeonOption, enemyName: string) {
  const hasMatchingBattle = (option.costs ?? []).some(
    (cost) => cost.type === 'battle' && cost.metadata?.enemy_name === enemyName,
  );
  return (
    hasMatchingBattle ||
    mentionsDefeatedEnemyAsActive(optionNarrative(option), enemyName)
  );
}

function findDungeonRoundContinuityViolations(
  state: DungeonState,
  roundData: DungeonRound,
): string[] {
  const violations: string[] = [];
  if (EMBEDDED_OPTION_PATTERN.test(roundData.scene_description)) {
    violations.push('场景正文夹带了选项列表');
  }

  const hasLastAction = state.history.some((entry) => Boolean(entry.choice));
  if (hasLastAction && !roundData.action_outcome?.trim()) {
    violations.push('没有提供上一项抉择的实际结果');
  }
  if (!hasLastAction && roundData.action_outcome?.trim()) {
    violations.push('首个事件在玩家尚未行动时提前生成了行动结果');
  }

  const resultNarrative = [
    roundData.scene_description,
    roundData.action_outcome,
  ]
    .filter(Boolean)
    .join(' ');
  if (containsUnsupportedMechanicalEffect(resultNarrative)) {
    violations.push('叙事宣称了服务端并未实际写入的属性、修为或功法强化');
  }
  if (
    UNCONFIRMED_DEFEAT_PATTERN.test(resultNarrative) &&
    !(state.defeatedEnemyNames ?? []).some((enemyName) =>
      resultNarrative.includes(enemyName),
    )
  ) {
    violations.push('叙事宣称击败了未经服务端战斗确认的敌人');
  }
  const confirmedItemNames = [
    ...(state.accumulatedRewards ?? []),
    ...(roundData.acquired_items ?? []),
  ]
    .map((reward) => reward.name?.trim())
    .filter((name): name is string => Boolean(name));
  for (const itemUse of resultNarrative.match(CONCRETE_ITEM_USE_PATTERN) ??
    []) {
    if (!confirmedItemNames.some((name) => itemUse.includes(name))) {
      violations.push(`叙事臆造了未确认持有的物品用法：【${itemUse}】`);
    }
  }

  for (const option of roundData.interaction.options) {
    const target = option.exploration_target?.trim() ?? '';
    if (EXPLORATION_TARGET_ACTION_PATTERN.test(target)) {
      violations.push(
        `探索目标【${target}】写成了动作，exploration_target 只能填写名词对象`,
      );
    }
    if (
      option.action_mode &&
      explorationTargetKey(target).includes(
        explorationTargetKey(option.action_mode),
      )
    ) {
      violations.push(
        `探索目标【${target}】混入了操作方式【${option.action_mode}】`,
      );
    }
    if (containsUnsupportedMechanicalEffect(optionNarrative(option))) {
      violations.push(`选项【${option.text}】承诺了服务端未支持的强化效果`);
    }
    if (
      COMBAT_ENGAGEMENT_PATTERN.test(optionNarrative(option)) &&
      !(option.costs ?? []).some((cost) => cost.type === 'battle')
    ) {
      violations.push(`选项【${option.text}】会正面接敌却没有 battle 代价`);
    }
    for (const cost of option.costs ?? []) {
      if (cost.desc && CONDITIONAL_COST_DESCRIPTION_PATTERN.test(cost.desc)) {
        violations.push(`选项【${option.text}】把条件风险写进了确定代价`);
      }
    }
  }

  const accumulatedRewardKeys = new Set(
    (state.accumulatedRewards ?? [])
      .map((reward) => rewardNameKey(reward.name))
      .filter(Boolean),
  );
  for (const reward of roundData.acquired_items ?? []) {
    const key = rewardNameKey(reward.name);
    if (key && accumulatedRewardKeys.has(key)) {
      violations.push(`奖励【${reward.name}】与本次秘境已有奖励重复`);
    }
    if (
      reward.name &&
      !roundData.action_outcome?.includes(reward.name)
    ) {
      violations.push(`奖励【${reward.name}】没有在行动结果中明确取得`);
    }
    const equivalentReward = (state.accumulatedRewards ?? []).find(
      (existingReward) => rewardNamesLookEquivalent(existingReward, reward),
    );
    if (equivalentReward) {
      violations.push(
        `奖励【${reward.name}】与已有【${equivalentReward.name}】属于同源近似物品`,
      );
    }
    if (reward.material_type === 'monster') {
      const rewardEvidence = [resultNarrative, reward.name, reward.description]
        .filter(Boolean)
        .join(' ');
      const comesFromConfirmedEnemy = (state.defeatedEnemyNames ?? []).some(
        (enemyName) => rewardEvidence.includes(enemyName),
      );
      if (
        !comesFromConfirmedEnemy &&
        !PREEXISTING_MONSTER_REMAINS_PATTERN.test(rewardEvidence)
      ) {
        violations.push(
          `妖兽材料【${reward.name}】既无服务端击败记录，也不是场景中的既有遗骸`,
        );
      }
    }
  }

  for (const enemyName of state.defeatedEnemyNames ?? []) {
    if (mentionsDefeatedEnemyAsActive(roundData.scene_description, enemyName)) {
      violations.push(`场景将已击败的【${enemyName}】重新写成存活敌人`);
    }
    if (
      roundData.interaction.options.some((option) =>
        optionTargetsDefeatedEnemy(option, enemyName),
      )
    ) {
      violations.push(`选项再次把已击败的【${enemyName}】作为行动目标`);
    }
  }

  return Array.from(new Set(violations));
}

function cloneDungeonOption(option: DungeonOption): DungeonOption {
  return {
    ...option,
    costs: cloneCosts(option.costs),
    costPreview: cloneCosts(option.costPreview),
  };
}

function constrainSettlementForDisposition(
  settlement: DungeonSettlement,
  endDisposition: DungeonSettlementLlmContext['endDisposition'],
): DungeonSettlement {
  if (endDisposition === 'completed') return settlement;

  const rewardTier =
    endDisposition === 'abandoned_before_battle'
      ? 'D'
      : settlement.settlement.reward_tier === 'D'
        ? 'D'
        : 'C';

  return {
    ...settlement,
    settlement: {
      ...settlement.settlement,
      reward_tier: rewardTier,
    },
  };
}

function createBattleDefeatSettlement(state: DungeonState): DungeonSettlement {
  const lastHistory = state.history[state.history.length - 1];
  const hasPreviousRewards = state.accumulatedRewards.length > 0;
  const ending =
    lastHistory?.outcome ??
    '你在遭遇战中落败，只得保全性命，提前退出此次秘境。';

  return {
    ending_narrative: `${ending}此前已经完成的探索所得尚可带走，本回机缘则因战败失去。`,
    settlement: {
      reward_tier: hasPreviousRewards ? 'C' : 'D',
      reward_blueprints: [],
      performance_tags: hasPreviousRewards
        ? ['战败撤离', '保全旧得']
        : ['战败撤离', '空手而归'],
    },
  };
}

function applyExplorationExperienceBonus(
  gains: ResourceOperation[],
  state: DungeonState,
): ResourceOperation[] {
  const branchCount = (state.exploredExplorationLeads ?? []).filter(
    (entry) => entry.isBranchChoice,
  ).length;
  if (branchCount <= 0) return gains;

  const bonusRate = Math.min(
    MAX_EXPLORATION_EXP_BONUS,
    branchCount * EXPLORATION_EXP_BONUS_PER_LEAD,
  );

  return gains.map((gain) => {
    if (gain.type !== 'cultivation_exp' || gain.value <= 0) return gain;
    const bonusValue = Math.max(1, Math.floor(gain.value * bonusRate));
    return {
      ...gain,
      value: gain.value + bonusValue,
      metadata: {
        ...gain.metadata,
        dungeonExplorationBranchCount: branchCount,
        dungeonExplorationBonusRate: bonusRate,
        dungeonExplorationBonusValue: bonusValue,
      },
    };
  });
}

export class DungeonService {
  private assignFreshExplorationMetadata(
    options: DungeonOption[],
    round: number,
  ): DungeonOption[] {
    return options.map((option, index) => {
      const target = normalizeExplorationTarget(
        option.exploration_target,
        option.text,
      );
      const leadId =
        option.exploration_lead_id ?? `${round}:${index + 1}:${randomUUID()}`;
      return {
        ...option,
        id: index + 1,
        exploration_target: target,
        exploration_lead_id: leadId,
        exploration_is_revisit: option.exploration_is_revisit ?? false,
      };
    });
  }

  private stageExplorationChoice(
    state: DungeonState,
    chosenOption: DungeonOption,
  ): DungeonExplorationRecord | undefined {
    const leadId = chosenOption.exploration_lead_id;
    const flow = state.branchFlow;
    if (!leadId || !flow) return undefined;

    const target = normalizeExplorationTarget(
      chosenOption.exploration_target,
      chosenOption.text,
    );
    const chosenTargetKey = explorationTargetKey(target);
    const siblingOptions = (state.currentOptions ?? [])
      .filter((option) => option.exploration_lead_id !== leadId)
      .filter(
        (option) =>
          explorationTargetKey(option.exploration_target ?? option.text) !==
          chosenTargetKey,
      )
      .filter((option) => {
        const sourceRound = explorationOptionSourceRound(
          option,
          state.currentRound,
        );
        const sourceScene = [...state.history]
          .reverse()
          .find((entry) => entry.round === sourceRound)?.scene;
        return isExplorationOptionGroundedInScene(option, sourceScene);
      })
      .map(cloneDungeonOption);
    const pendingCount = (flow.pendingBranches ?? []).reduce(
      (count, checkpoint) => count + checkpoint.options.length,
      0,
    );
    const remainingBranchSlots = Math.max(
      0,
      state.maxRounds - state.currentRound - 1 - pendingCount,
    );
    const checkpointOptions = siblingOptions.slice(0, remainingBranchSlots);
    let createdCheckpointId: string | undefined;
    if (checkpointOptions.length > 0) {
      createdCheckpointId = randomUUID();
      flow.pendingBranches ??= [];
      flow.pendingBranches.push({
        id: createdCheckpointId,
        sourceRound: state.currentRound,
        sourceTarget: target,
        options: checkpointOptions,
      });
    }
    flow.activeRootOption = cloneDungeonOption(chosenOption);
    flow.stage = 'explore';

    return {
      id: leadId,
      target,
      sourceRound: state.currentRound,
      completedRound: state.currentRound,
      isBranchChoice: chosenOption.exploration_is_revisit === true,
      ...(createdCheckpointId ? { createdCheckpointId } : {}),
    };
  }

  private rollbackStagedExploration(
    state: DungeonState,
    record: DungeonExplorationRecord | undefined,
  ) {
    const flow = state.branchFlow;
    if (!flow) return;
    if (record?.createdCheckpointId) {
      flow.pendingBranches = (flow.pendingBranches ?? []).filter(
        (checkpoint) => checkpoint.id !== record.createdCheckpointId,
      );
    }
    flow.stage = 'explore';
  }

  private buildContinueExplorationOption(state: DungeonState): DungeonOption {
    const activeTarget = normalizeExplorationTarget(
      state.branchFlow?.activeRootOption?.exploration_target,
      '秘境深处',
    );
    return {
      id: 1,
      text: `沿【${activeTarget}】继续深入，查明前方的变化。`,
      risk_level: 'low',
      exploration_target: activeTarget,
      exploration_lead_id: `${state.currentRound}:continue:${randomUUID()}`,
      exploration_is_revisit: false,
      potential_cost: '沿当前路线继续推进下一个事件。',
      costs: [],
      costPreview: [],
    };
  }

  private prepareNextEventOptions(
    state: DungeonState,
    roundData: DungeonRound,
  ) {
    const flow = state.branchFlow;
    const forwardOptions =
      roundData.interaction.options.map(cloneDungeonOption);
    const pendingCount = (flow?.pendingBranches ?? []).reduce(
      (count, checkpoint) => count + checkpoint.options.length,
      0,
    );
    const forwardSlots = Math.min(3, forwardOptions.length);
    const revisitSlots = Math.min(3 - forwardSlots, pendingCount);
    const visibleForwardOptions = forwardOptions.slice(0, forwardSlots);
    const overflowForwardOptions = forwardOptions.slice(forwardSlots);
    const revisitOptions: DungeonOption[] = [];

    while (
      revisitOptions.length < revisitSlots &&
      (flow?.pendingBranches?.length ?? 0) > 0
    ) {
      const checkpoint = flow!.pendingBranches!.at(-1)!;
      const needed = revisitSlots - revisitOptions.length;
      const restored = checkpoint.options.splice(0, needed).map((option) => ({
        ...cloneDungeonOption(option),
        exploration_is_revisit: true,
      }));
      revisitOptions.push(...restored);
      if (checkpoint.options.length === 0) {
        flow!.pendingBranches!.pop();
      }
    }

    if (overflowForwardOptions.length > 0 && flow) {
      flow.pendingBranches ??= [];
      flow.pendingBranches.push({
        id: randomUUID(),
        sourceRound: state.currentRound,
        sourceTarget: normalizeExplorationTarget(
          overflowForwardOptions[0]?.exploration_target,
          '当前事件',
        ),
        options: overflowForwardOptions,
      });
    }

    let visibleOptions = [...visibleForwardOptions, ...revisitOptions];
    if (visibleOptions.length === 0) {
      visibleOptions = [this.buildContinueExplorationOption(state)];
    }
    visibleOptions = visibleOptions.map((option, index) => ({
      ...option,
      id: index + 1,
    }));

    if (revisitOptions.length > 0) {
      const returnHint =
        visibleForwardOptions.length > 0
          ? CURRENT_BRANCH_RETURN_HINT
          : ONLY_BRANCH_RETURN_HINT;
      roundData.scene_description = `${roundData.scene_description} ${returnHint}`;
    }
    roundData.interaction.options = visibleOptions;
    state.currentOptions = visibleOptions;
  }

  private sanitizeExplorationBranches(state: DungeonState) {
    const flow = state.branchFlow;
    if (!flow) return;

    const sceneForRound = (round: number) =>
      [...state.history]
        .reverse()
        .find((entry) => entry.round === round)?.scene;
    flow.pendingBranches = (flow.pendingBranches ?? [])
      .map((checkpoint) => ({
        ...checkpoint,
        options: checkpoint.options.filter((option) =>
          isExplorationOptionGroundedInScene(
            option,
            sceneForRound(checkpoint.sourceRound),
          ),
        ),
      }))
      .filter((checkpoint) => checkpoint.options.length > 0);

    const currentOptions = (state.currentOptions ?? []).filter((option) => {
      if (option.exploration_is_revisit !== true) return true;
      const sourceRound = explorationOptionSourceRound(
        option,
        state.currentRound,
      );
      return isExplorationOptionGroundedInScene(
        option,
        sceneForRound(sourceRound),
      );
    });

    while (currentOptions.length < 3 && flow.pendingBranches.length > 0) {
      const currentRoundCheckpointIndex = flow.pendingBranches.findLastIndex(
        (checkpoint) => checkpoint.sourceRound === state.currentRound,
      );
      const checkpointIndex =
        currentRoundCheckpointIndex >= 0
          ? currentRoundCheckpointIndex
          : flow.pendingBranches.length - 1;
      const checkpoint = flow.pendingBranches[checkpointIndex];
      const option = checkpoint?.options.shift();
      if (option) {
        currentOptions.push({
          ...cloneDungeonOption(option),
          exploration_is_revisit:
            checkpoint.sourceRound < state.currentRound,
        });
      }
      if (!checkpoint || checkpoint.options.length === 0) {
        flow.pendingBranches.splice(checkpointIndex, 1);
      }
    }

    state.currentOptions = currentOptions.map((option, index) => ({
      ...option,
      id: index + 1,
    }));

    const hasPriorBranch =
      state.currentOptions.some(
        (option) => option.exploration_is_revisit === true,
      ) ||
      flow.pendingBranches.some(
        (checkpoint) => checkpoint.sourceRound < state.currentRound,
      );
    if (!hasPriorBranch) {
      const currentHistory = [...state.history]
        .reverse()
        .find((entry) => entry.round === state.currentRound);
      if (currentHistory) {
        currentHistory.scene = removeBranchReturnHints(currentHistory.scene);
      }
    }
  }

  private migrateBranchFlow(state: DungeonState) {
    const flow = state.branchFlow;
    if (!flow || flow.mode === 'adaptive') return;
    const completed = new Set(flow.completedRootLeadIds);
    const activeLeadId = flow.activeRootOption?.exploration_lead_id;
    const remainingRootOptions = flow.rootOptions.filter(
      (option) =>
        !completed.has(option.exploration_lead_id ?? '') &&
        option.exploration_lead_id !== activeLeadId,
    );
    const pendingBranches: DungeonBranchCheckpoint[] =
      flow.stage !== 'root' && remainingRootOptions.length > 0
        ? [
            {
              id: randomUUID(),
              sourceRound: 1,
              sourceTarget: '秘境入口',
              options: remainingRootOptions.map(cloneDungeonOption),
            },
          ]
        : [];
    flow.stage = 'explore';
    flow.pendingBranches = pendingBranches;
    flow.mode = 'adaptive';
  }

  private commitExplorationChoice(
    state: DungeonState,
    record: DungeonExplorationRecord | undefined,
  ) {
    if (!record) return;
    state.exploredExplorationLeads ??= [];
    if (
      !state.exploredExplorationLeads.some((entry) => entry.id === record.id)
    ) {
      state.exploredExplorationLeads.push(record);
    }
    const completedTargetKey = explorationTargetKey(record.target);
    if (state.branchFlow?.pendingBranches) {
      state.branchFlow.pendingBranches = state.branchFlow.pendingBranches
        .map((checkpoint) => ({
          ...checkpoint,
          options: checkpoint.options.filter(
            (option) =>
              explorationTargetKey(option.exploration_target ?? option.text) !==
              completedTargetKey,
          ),
        }))
        .filter((checkpoint) => checkpoint.options.length > 0);
    }
  }

  private recordDefeatedEnemy(state: DungeonState, enemyName: string) {
    const normalizedName = enemyName.trim();
    if (!normalizedName) return;

    state.defeatedEnemyNames ??= [];
    if (!state.defeatedEnemyNames.includes(normalizedName)) {
      state.defeatedEnemyNames.push(normalizedName);
    }

    if (state.branchFlow?.pendingBranches) {
      state.branchFlow.pendingBranches = state.branchFlow.pendingBranches
        .map((checkpoint) => ({
          ...checkpoint,
          options: checkpoint.options.filter(
            (option) => !optionTargetsDefeatedEnemy(option, normalizedName),
          ),
        }))
        .filter((checkpoint) => checkpoint.options.length > 0);
    }
  }

  private normalizeOptionCosts(option: { costs?: DungeonOptionCost[] }) {
    const costs = cloneCosts(option.costs)
      .map((cost) => {
        const max = COST_LIMITS[cost.type] ?? Number.MAX_SAFE_INTEGER;
        const rawValue = Number.isFinite(cost.value) ? cost.value : 0;
        const value =
          cost.type === 'hp_loss' || cost.type === 'mp_loss'
            ? Math.max(0, Math.min(max, rawValue))
            : Math.floor(Math.max(0, Math.min(max, rawValue)));
        return {
          ...cost,
          value,
        };
      })
      .filter((cost) => cost.value > 0 || cost.type === 'battle');

    const hasBattle = costs.some((cost) => cost.type === 'battle');
    return hasBattle
      ? costs.filter(
          (cost) => cost.type !== 'hp_loss' && cost.type !== 'mp_loss',
        )
      : costs;
  }

  private normalizeRoundOptions(roundData: DungeonRound, state: DungeonState) {
    roundData.interaction.options = roundData.interaction.options.map(
      (option) => {
        const costPreview = this.normalizeOptionCosts(option);
        return {
          ...option,
          costs: costPreview,
          costPreview,
        };
      },
    );
    if (roundData.interaction.options.length > 0) {
      roundData.interaction.options = this.assignFreshExplorationMetadata(
        roundData.interaction.options,
        state.currentRound,
      );
    }
    return roundData;
  }

  private async bindRoundMaterialCosts(
    roundData: DungeonRound,
    cultivatorId: string,
  ): Promise<DungeonRound> {
    const hasUnboundMaterialCost = roundData.interaction.options.some(
      (option) =>
        (option.costs ?? []).some(
          (cost) => cost.type === 'material' && !cost.name,
        ),
    );
    if (!hasUnboundMaterialCost) return roundData;

    const userId = await findActiveCultivatorOwnerId(cultivatorId);
    if (!userId) throw new Error('无法获取修真者所属用户');

    const inventoryMaterials: Cultivator['inventory']['materials'] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const inventoryPage = await getPaginatedInventoryByType(
        userId,
        cultivatorId,
        {
          type: 'materials',
          page,
          pageSize: 100,
          materialSortBy: 'rank',
          materialSortOrder: 'asc',
        },
      );
      inventoryMaterials.push(...inventoryPage.items);
      hasMore = inventoryPage.pagination.hasMore;
      page += 1;
    }

    const availableOptions: DungeonOption[] = [];
    for (const option of roundData.interaction.options) {
      const reservedByMaterialName = new Map<string, number>();
      const boundCosts: DungeonOptionCost[] = [];
      const boundMaterials: Array<{ name: string; value: number }> = [];
      let canAffordOption = true;

      for (const cost of option.costs ?? []) {
        if (cost.type !== 'material' || cost.name) {
          boundCosts.push(cost);
          continue;
        }

        const requiredRankIndex = QUALITY_VALUES.indexOf(
          (cost.required_quality as Quality | undefined) ?? '凡品',
        );
        const match = inventoryMaterials.find((material) => {
          if (cost.required_type && material.type !== cost.required_type) {
            return false;
          }
          const materialRankIndex = QUALITY_VALUES.indexOf(material.rank);
          if (materialRankIndex < Math.max(0, requiredRankIndex)) return false;
          const sameNameStacks = inventoryMaterials.filter(
            (candidate) => candidate.name === material.name,
          );
          const everyStackMatches = sameNameStacks.every((candidate) => {
            const rankIndex = QUALITY_VALUES.indexOf(candidate.rank);
            return (
              (!cost.required_type || candidate.type === cost.required_type) &&
              rankIndex >= Math.max(0, requiredRankIndex)
            );
          });
          if (!everyStackMatches) return false;
          const totalQuantity = sameNameStacks.reduce(
            (sum, candidate) => sum + (candidate.quantity ?? 0),
            0,
          );
          const reserved = reservedByMaterialName.get(material.name) ?? 0;
          return totalQuantity - reserved >= cost.value;
        });
        if (!match?.id) {
          canAffordOption = false;
          break;
        }

        reservedByMaterialName.set(
          match.name,
          (reservedByMaterialName.get(match.name) ?? 0) + cost.value,
        );
        boundCosts.push({
          ...cost,
          name: match.name,
          desc: `实际消耗【${match.name}】`,
          metadata: {
            ...cost.metadata,
            boundMaterialId: match.id,
            boundMaterialRank: match.rank,
            boundMaterialType: match.type,
          },
        });
        boundMaterials.push({ name: match.name, value: cost.value });
      }

      if (!canAffordOption) continue;
      if (boundMaterials.length === 0) {
        availableOptions.push(option);
        continue;
      }

      const materialSummary = boundMaterials
        .map((material) => `【${material.name}】×${material.value}`)
        .join('、');
      const target = normalizeExplorationTarget(
        option.exploration_target,
        option.text,
      );
      availableOptions.push({
        ...option,
        text: `投入${materialSummary}作为媒介，继续查探【${target}】。`,
        requirement: `持有${materialSummary}`,
        potential_cost: `确认后将实际消耗${materialSummary}。`,
        costs: boundCosts,
        costPreview: cloneCosts(boundCosts),
      });
    }

    roundData.interaction.options = availableOptions;
    return roundData;
  }

  private normalizeState(state: DungeonState): DungeonState {
    const [realm = REALM_VALUES[0], stage = REALM_STAGE_VALUES[0]] =
      state.playerInfo.realm.trim().split(/\s+/);
    normalizeLegacySixAttributes(
      state.playerInfo.attributes as unknown as Record<string, unknown>,
      realm,
      stage,
    );
    state.costLedger ??= [];
    state.gainLedger ??= [];
    state.exploredExplorationLeads ??= [];
    state.defeatedEnemyNames ??= [];
    state.summary_of_sacrifice = state.costLedger.flatMap((entry) =>
      cloneCosts(entry.costs),
    );
    state.currentOptions = state.currentOptions?.map((option) => {
      const costPreview = this.normalizeOptionCosts(option);
      return {
        ...option,
        costs: costPreview,
        costPreview,
      };
    });
    if (!state.branchFlow && state.currentOptions?.length) {
      const hasChosenAction = state.history.some((entry) => entry.choice);
      if (state.currentRound === 1 && !hasChosenAction) {
        const rootOptions = this.assignFreshExplorationMetadata(
          state.currentOptions,
          state.currentRound,
        );
        state.currentOptions = rootOptions;
        state.branchFlow = {
          stage: 'explore',
          rootOptions: rootOptions.map(cloneDungeonOption),
          completedRootLeadIds: [],
          pendingBranches: [],
          mode: 'adaptive',
        };
      } else {
        const uniqueOptions = Array.from(
          new Map(
            state.currentOptions.map((option) => [
              explorationTargetKey(option.text),
              option,
            ]),
          ).values(),
        ).slice(0, 3);
        state.currentOptions = this.assignFreshExplorationMetadata(
          uniqueOptions,
          state.currentRound,
        );
        const lastChosenHistory = [...state.history]
          .reverse()
          .find((entry) => entry.choice);
        const lastExploration = [
          ...state.exploredExplorationLeads,
        ].reverse()[0];
        const activeRootOption: DungeonOption = {
          id: 1,
          text: lastChosenHistory?.choice ?? '继续完成当前分支',
          risk_level: 'low',
          exploration_target: lastExploration?.target ?? '当前分支',
          exploration_lead_id: `legacy-root:${state.runId ?? randomUUID()}`,
          costs: [],
          costPreview: [],
        };
        state.branchFlow = {
          stage: 'explore',
          rootOptions: [activeRootOption],
          completedRootLeadIds: [],
          activeRootOption,
          pendingBranches: [],
          mode: 'adaptive',
          legacy: true,
        };
      }
    }
    this.migrateBranchFlow(state);
    this.sanitizeExplorationBranches(state);
    state.maxRounds = Math.max(DUNGEON_EVENT_COUNT, state.currentRound);
    if (
      state.status === 'EXPLORING' &&
      (state.currentOptions?.length ?? 0) === 0
    ) {
      state.currentOptions = [this.buildContinueExplorationOption(state)];
    }
    if (state.status === 'RECOVERABLE_ERROR') {
      state.recoverableActions ??= DEFAULT_RECOVERABLE_ACTIONS;
    }
    return state;
  }

  private async loadActiveRun(cultivatorId: string) {
    const rows = await getExecutor()
      .select()
      .from(dungeonRuns)
      .where(
        and(
          eq(dungeonRuns.cultivatorId, cultivatorId),
          isNull(dungeonRuns.endedAt),
        ),
      )
      .orderBy(desc(dungeonRuns.updatedAt))
      .limit(1);

    const row = rows[0];
    if (!row || !isActiveRunStatus(row.status)) return null;
    return row;
  }

  private async markRecoverable(
    cultivatorId: string,
    state: DungeonState,
    reason: string,
    actions: DungeonRecoverAction[] = DEFAULT_RECOVERABLE_ACTIONS,
    options: DungeonFlowOptions = {},
  ) {
    state.status = 'RECOVERABLE_ERROR';
    state.isFinished = false;
    state.statusReason = reason;
    state.recoverableActions = actions;
    if (state.pendingAction) {
      state.pendingAction.status = 'failed';
      state.pendingAction.error = reason;
    }
    if (!options.deferPersistence) {
      await this.saveState(cultivatorId, state);
    }
    return state;
  }

  private buildStateHooks(
    cultivatorId: string,
    state: DungeonState,
    battlePayload?: DungeonBattleCachePayload,
  ): DungeonPersistenceHooks {
    return {
      persist: async (tx) => {
        await this.persistStateRecord(cultivatorId, state, battlePayload, tx);
      },
      afterCommit: async () => {
        await this.saveRedisState(cultivatorId, state);
      },
    };
  }

  private async withFlowLock<T>(
    cultivatorId: string,
    context: string,
    task: () => Promise<T>,
    lease?: RedisLeaseContext,
  ): Promise<T> {
    if (lease) {
      lease.assertHeld();
      const result = await task();
      lease.assertHeld();
      return result;
    }

    try {
      return await withRedisLock(
        {
          key: redisLockKeys.dungeonCommand(cultivatorId),
          context,
          timeoutMs: FLOW_LOCK_TTL_SECONDS * 1000,
          retries: 0,
          delayMs: 50,
        },
        async (lease) => {
          const result = await task();
          lease.assertHeld();
          return result;
        },
      );
    } catch (error) {
      if (!isRedisLockContention(error)) {
        throw error;
      }
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '副本操作正在处理中，请稍后重试',
        409,
      );
    }
  }

  private hasCommittedAction(state: DungeonState, actionId: string) {
    return state.costLedger?.some((entry) => entry.actionId === actionId);
  }

  private commitCostsToState(
    state: DungeonState,
    action: DungeonPendingAction,
  ) {
    this.commitExplorationChoice(state, action.exploration);

    for (const cost of action.costs) {
      if (cost.type === 'hp_loss') {
        state.accumulatedHpLoss = Math.min(
          1,
          (state.accumulatedHpLoss ?? 0) + cost.value,
        );
      } else if (cost.type === 'mp_loss') {
        state.accumulatedMpLoss = Math.min(
          1,
          (state.accumulatedMpLoss ?? 0) + cost.value,
        );
      }
    }

    state.costLedger ??= [];
    state.costLedger.push({
      actionId: action.actionId,
      round: action.round,
      choiceId: action.choiceId,
      choiceText: action.choiceText,
      costs: cloneCosts(action.costs),
      committedAt: new Date().toISOString(),
    });
    state.summary_of_sacrifice = state.costLedger.flatMap((entry) =>
      cloneCosts(entry.costs),
    );
    const historyEntry = state.history.find(
      (entry) => entry.round === action.round,
    );
    if (historyEntry) {
      const actualCosts = action.costs
        .map(formatActualActionCost)
        .filter((cost): cost is string => Boolean(cost));
      historyEntry.actual_costs = actualCosts.length ? actualCosts : undefined;
    }
    state.pendingAction = {
      ...action,
      status: 'committed',
    };
  }

  private async applyConditionResourceLosses(
    cultivatorId: string,
    costs: DungeonOptionCost[],
    tx: DbTransaction,
  ) {
    const hpPercent = costs
      .filter((cost) => cost.type === 'hp_loss')
      .reduce((sum, cost) => sum + cost.value, 0);
    const mpPercent = costs
      .filter((cost) => cost.type === 'mp_loss')
      .reduce((sum, cost) => sum + cost.value, 0);

    if (hpPercent <= 0 && mpPercent <= 0) {
      return null;
    }

    const bundle = await loadCultivatorCombatInput(cultivatorId, tx);
    if (!bundle?.cultivator) {
      throw new Error('未找到修真者数据');
    }

    const nextCondition = ConditionService.applyExternalResourceLoss(
      bundle.cultivator,
      bundle.cultivator.condition,
      {
        hpPercent,
        mpPercent,
      },
    );
    await updateCultivator(cultivatorId, { condition: nextCondition }, tx);
    return nextCondition;
  }

  private previewOptionResourceLoss(
    costs: DungeonOptionCost[],
    cultivator: CultivatorDisplayInput,
  ) {
    const hpPercent = costs
      .filter((cost) => cost.type === 'hp_loss')
      .reduce((sum, cost) => sum + cost.value, 0);
    const mpPercent = costs
      .filter((cost) => cost.type === 'mp_loss')
      .reduce((sum, cost) => sum + cost.value, 0);

    if (hpPercent <= 0 && mpPercent <= 0) {
      return;
    }

    const preview = ConditionService.previewExternalResourceLoss(
      cultivator,
      cultivator.condition,
      {
        hpPercent,
        mpPercent,
      },
    );

    for (const cost of costs) {
      if (cost.type === 'hp_loss') {
        cost.metadata = {
          ...cost.metadata,
          rawLoss: preview.rawHpLoss,
          actualLoss: preview.hpLoss,
        };
      } else if (cost.type === 'mp_loss') {
        cost.metadata = {
          ...cost.metadata,
          rawLoss: preview.rawMpLoss,
          actualLoss: preview.mpLoss,
        };
      }
    }
  }

  private async previewRoundResourceLoss(
    roundData: DungeonRound,
    cultivatorId: string,
  ) {
    const hasResourceLoss = roundData.interaction.options.some((option) =>
      (option.costPreview ?? option.costs ?? []).some(
        (cost) => cost.type === 'hp_loss' || cost.type === 'mp_loss',
      ),
    );
    if (!hasResourceLoss) {
      return roundData;
    }

    const bundle = await loadCultivatorCombatInput(cultivatorId);
    const cultivator = bundle?.cultivator;
    if (!cultivator) {
      return roundData;
    }

    roundData.interaction.options = roundData.interaction.options.map(
      (option) => {
        const costPreview = cloneCosts(option.costPreview ?? option.costs);
        this.previewOptionResourceLoss(costPreview, cultivator);
        return {
          ...option,
          costs: costPreview,
          costPreview,
        };
      },
    );

    return roundData;
  }

  private async getBattleContext(cultivatorId: string, battleId: string) {
    const state = await this.getState(cultivatorId);
    if (!state || state.activeBattleId !== battleId) {
      throw new Error('当前没有匹配的遭遇战');
    }

    const battleKey = getDungeonBattleKey(battleId);
    let battlePayload = parseRedisJson<DungeonBattleCachePayload>(
      await redis.get(battleKey),
      battleKey,
    );

    if (!battlePayload?.session || !battlePayload.enemyObject) {
      const run = await this.loadActiveRun(cultivatorId);
      const persistedPayload = run?.battlePayload as
        DungeonBattleCachePayload | null | undefined;
      if (
        persistedPayload?.session?.battleId === battleId &&
        persistedPayload.enemyObject
      ) {
        await redis.set(
          battleKey,
          JSON.stringify(persistedPayload),
          'EX',
          REDIS_TTL,
        );
        battlePayload = persistedPayload;
      }
    }

    if (!battlePayload?.session || !battlePayload.enemyObject) {
      await this.markRecoverable(
        cultivatorId,
        state,
        '遭遇战数据不存在或已失效',
        ['safe_retreat', 'force_quit'],
      );
      throw new Error('遭遇战数据不存在或已失效，可选择安全撤退或放弃副本');
    }

    if (battlePayload.session.cultivatorId !== cultivatorId) {
      throw new Error('无权访问该遭遇战');
    }

    normalizeLegacySixAttributes(
      battlePayload.enemyObject.attributes as unknown as Record<
        string,
        unknown
      >,
      battlePayload.enemyObject.realm,
      battlePayload.enemyObject.realm_stage,
    );

    return {
      state,
      battleKey,
      session: battlePayload.session,
      enemyObject: battlePayload.enemyObject,
    };
  }

  /**
   * 计算境界差距
   * @param playerRealm 玩家境界字符串，如 "化神 中期"
   * @param mapRealm 地图要求境界
   * @returns 境界差距（正数表示玩家更强，负数表示地图更难）
   */
  private calculateRealmGap(playerRealm: string, mapRealm: RealmType): number {
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

  // 核心配置：定义每个轮次对应的副本相位
  private getPhase(
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

  // 统一的 System Prompt 生成器
  private getSystemPrompt(): string {
    return (
      renderPrompt('dungeon-round', {
        materialTypeTable: DUNGEON_MATERIAL_TYPE_TABLE,
        userContextJson: '',
      }).system +
      `

### 成本(costs)规范:
- **数值范围**: hp_loss, mp_loss 必须是 0-1 之间的小数；其他类型为正整数。
- **材料(material)**: 禁止指定 name，必须提供 required_type 和 required_quality。
- **冲突禁止**: 若有 'battle'，严禁同时出现 'hp_loss' 或 'mp_loss'。
- **战斗难度**: battle.value 只作为剧情风险参考；最终敌人 difficulty 与 realm_stage 会由服务端按副本档位配置表覆盖或钳制。`
    );
  }

  /**
   * 初始化副本
   */
  async startDungeon(
    cultivatorId: string,
    mapNodeId: string,
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-start',
      () => this.startDungeonUnlocked(cultivatorId, mapNodeId, options),
      options.lease,
    );
  }

  private async startDungeonUnlocked(
    cultivatorId: string,
    mapNodeId: string,
    options: DungeonFlowOptions,
  ) {
    let qiActionInstanceId: string | null = null;
    let qiReservationOpen = false;

    try {
      const existingSession = await this.loadActiveRun(cultivatorId);
      if (existingSession) {
        throw new Error('当前已有正在进行的副本，请先完成或放弃');
      }

      // 只有卫星地图节点可以进行副本挑战
      if (!isSatelliteNode(mapNodeId)) {
        throw new Error('只有秘境节点可以进行副本挑战');
      }

      // 1. 获取玩家与地图数据 (逻辑同你之前)
      const context = await this.prepareDungeonContext(cultivatorId, mapNodeId);

      qiActionInstanceId = randomUUID();
      if (!options.deferPersistence) {
        await QiService.reserveQi({
          cultivatorId,
          action: 'dungeon_start',
          actionInstanceId: qiActionInstanceId,
          metadata: {
            mapNodeId,
          },
        });
        qiReservationOpen = true;
      }

      // 2. 初始状态
      const state: DungeonState = {
        ...context,
        mapNodeId, // 保存地图节点ID
        currentRound: 1,
        maxRounds: DUNGEON_EVENT_COUNT,
        history: [],
        dangerScore: 10,
        isFinished: false,
        cultivatorId: context.playerInfo.id!,
        theme: context.location.location,
        summary_of_sacrifice: [],
        costLedger: [],
        gainLedger: [],
        accumulatedRewards: [],
        branchFlow: {
          stage: 'explore',
          rootOptions: [],
          completedRootLeadIds: [],
          pendingBranches: [],
          mode: 'adaptive',
        },
        exploredExplorationLeads: [],
        defeatedEnemyNames: [],
        status: 'EXPLORING',
        accumulatedHpLoss: 0, // 累积气血损失百分比 (0-1)
        accumulatedMpLoss: 0, // 累积法力损失百分比 (0-1)
      };

      // 3. 首次 AI 调用
      const roundData = await this.previewRoundResourceLoss(
        await this.bindRoundMaterialCosts(
          this.normalizeRoundOptions(await this.callAI(state, 'initial'), state),
          cultivatorId,
        ),
        cultivatorId,
      );

      // 4. 更新历史并存入 Redis
      state.currentRoundItems = [];
      this.prepareNextEventOptions(state, roundData);
      state.history.push({
        round: 1,
        scene: roundData.scene_description,
        gained_items: [],
      });
      state.branchFlow!.rootOptions = (state.currentOptions ?? []).map(
        cloneDungeonOption,
      );
      if (!options.deferPersistence) {
        await this.saveState(cultivatorId, state);
      }

      if (!options.deferPersistence && qiActionInstanceId) {
        await QiService.commitReservation({
          actionInstanceId: qiActionInstanceId,
          metadata: {
            runId: state.runId,
            committedAt: new Date().toISOString(),
          },
        });
        qiReservationOpen = false;
      }

      if (options.deferPersistence) {
        return {
          state,
          roundData,
          persist: async (tx: DbTransaction) => {
            if (!qiActionInstanceId) {
              throw new Error('副本灵气预扣标识缺失');
            }
            const reservation = await QiService.reserveQi({
              cultivatorId,
              action: 'dungeon_start',
              actionInstanceId: qiActionInstanceId,
              metadata: {
                mapNodeId,
              },
              tx,
            });
            await this.persistStateRecord(cultivatorId, state, undefined, tx);
            await QiService.commitReservation({
              actionInstanceId: qiActionInstanceId,
              metadata: {
                runId: state.runId,
                committedAt: new Date().toISOString(),
              },
              tx,
            });
            return {
              currency: {
                qi: reservation.qiAfter,
                qiLastRefreshedAt: reservation.qiLastRefreshedAt,
              },
            } satisfies DungeonPersistenceSettlement;
          },
          afterCommit: async () => {
            await this.saveRedisState(cultivatorId, state);
          },
        };
      }

      return { state, roundData };
    } catch (error) {
      if (qiReservationOpen && qiActionInstanceId) {
        try {
          await QiService.refundReservation({
            actionInstanceId: qiActionInstanceId,
            reason: 'dungeon_start_failed',
            metadata: {
              mapNodeId,
            },
          });
        } catch (refundError) {
          console.error('[DungeonService] 回滚灵气预扣失败:', refundError);
        }
      }
      throw error;
    }
  }

  /**
   * 处理玩家交互
   */
  async handleAction(
    cultivatorId: string,
    choiceId: number,
    actionId: string = randomUUID(),
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-action',
      () =>
        this.handleActionUnlocked(cultivatorId, choiceId, actionId, options),
      options.lease,
    );
  }

  private async handleActionUnlocked(
    cultivatorId: string,
    choiceId: number,
    actionId: string = randomUUID(),
    options: DungeonFlowOptions = {},
  ) {
    const state = await this.getState(cultivatorId);
    if (!state) throw new Error('副本已失效');
    if (this.hasCommittedAction(state, actionId)) {
      return { actionId, state, isFinished: state.isFinished };
    }

    // 1. 校验选项
    const chosenOption = state.currentOptions?.find((o) => o.id === choiceId);
    if (!chosenOption) {
      throw new Error(`无效的交互选项: ${choiceId}`);
    }

    const actionCosts = this.normalizeOptionCosts(chosenOption);

    const consumeActionCostsOrThrow = async (dryRun = false) => {
      if (actionCosts.length === 0) return;

      // 获取 userId
      const userId = await findActiveCultivatorOwnerId(cultivatorId);
      if (!userId) {
        throw new Error('无法获取修真者所属用户');
      }

      // 动态匹配材料
      for (const cost of actionCosts) {
        if (cost.type === 'material' && !cost.name) {
          const reqType = cost.required_type as MaterialType;
          const reqQual = cost.required_quality as Quality;

          const requiredIndex = QUALITY_VALUES.indexOf(reqQual || '凡品');
          const validRanks = QUALITY_VALUES.slice(Math.max(0, requiredIndex));

          const matchPage = await getPaginatedInventoryByType(
            userId,
            cultivatorId,
            {
              type: 'materials',
              page: 1,
              pageSize: 10, // 获取前10个符合条件的材料
              materialTypes: reqType ? [reqType] : undefined,
              materialRanks:
                validRanks.length > 0 ? (validRanks as Quality[]) : undefined,
              materialSortBy: 'rank',
              materialSortOrder: 'asc',
            },
          );

          if (matchPage.items.length === 0) {
            const typeStr = reqType
              ? TYPE_DESCRIPTIONS[reqType] || reqType
              : '材料';
            const qualStr = reqQual ? reqQual + '以上的' : '';
            throw new Error(
              `储物袋中没有符合条件的材料（需要：${qualStr}${typeStr}），请重新选择或退出副本。`,
            );
          }

          // 选择第一个符合条件的材料
          cost.name = matchPage.items[0].name;
        }
      }

      const costs = actionCosts as ResourceOperation[];
      const result = dryRun
        ? await resourceEngine
            .validate(userId, cultivatorId, costs, getExecutor())
            .then((validation): ResourceOperationResult => ({
              success: validation.valid,
              operations: costs,
              errors: validation.errors,
            }))
        : await getExecutor().transaction(async (tx) => {
            const applied = await resourceEngine.applyInTransaction({
              userId,
              cultivatorId,
              consume: costs,
              tx,
            });
            if (applied.success) {
              await this.applyConditionResourceLosses(
                cultivatorId,
                actionCosts,
                tx,
              );
            }
            return applied;
          });

      if (!result.success) {
        throw new Error(result.errors?.join('; ') || '资源消耗失败');
      }
    };

    await consumeActionCostsOrThrow(true);

    const exploration = this.stageExplorationChoice(state, chosenOption);

    const pendingAction: DungeonPendingAction = {
      actionId,
      choiceId,
      choiceText: chosenOption.text,
      round: state.currentRound,
      status: 'pending',
      costs: actionCosts,
      exploration,
      createdAt: new Date().toISOString(),
    };
    state.pendingAction = pendingAction;
    state.costPreview = actionCosts;

    // 2. 推进状态
    state.history[state.history.length - 1].choice = chosenOption?.text;
    state.history[state.history.length - 1].outcome = undefined;
    // 本次行动的奖励尚未生成；战败时不应撤销上一个已完成事件的收获。
    state.currentRoundItems = [];

    const battleCost = actionCosts.find((c) => c.type === 'battle');
    if (battleCost) {
      let session: BattleSession & { enemyObject: Cultivator };
      try {
        session = await this.createBattleSession(
          cultivatorId,
          getDungeonKey(cultivatorId),
          battleCost,
          state.playerInfo,
          state,
          options,
        );
      } catch (error) {
        this.rollbackStagedExploration(state, exploration);
        const recoverable = await this.markRecoverable(
          cultivatorId,
          state,
          error instanceof Error ? error.message : '遭遇战生成失败',
          ACTION_RECOVERABLE_ACTIONS,
          options,
        );
        return options.deferPersistence
          ? {
              actionId,
              state: recoverable,
              isFinished: false,
              ...this.buildStateHooks(cultivatorId, recoverable),
            }
          : { actionId, state: recoverable, isFinished: false };
      }

      if (!options.deferPersistence) {
        try {
          await consumeActionCostsOrThrow();
        } catch (error) {
          this.rollbackStagedExploration(state, exploration);
          state.pendingAction = {
            ...pendingAction,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          };
          state.costPreview = undefined;
          state.status = 'EXPLORING';
          await this.saveState(cultivatorId, state);
          throw error;
        }
      }

      this.commitCostsToState(state, pendingAction);
      state.pendingAction = undefined;
      state.costPreview = undefined;
      state.status = 'WAITING_BATTLE';
      state.activeBattleId = session.battleId;
      const { enemyObject, ...battleSession } = session;
      const battlePayload = {
        session: battleSession,
        enemyObject,
      };

      if (options.deferPersistence) {
        return {
          actionId,
          state,
          type: 'TRIGGER_BATTLE',
          battleId: session.battleId,
          isFinished: false,
          persist: async (tx: DbTransaction) => {
            const userId = await findActiveCultivatorOwnerId(cultivatorId);
            if (!userId) {
              throw new Error('无法获取修真者所属用户');
            }
            const consumeResult = await resourceEngine.applyInTransaction({
              userId,
              cultivatorId,
              consume: actionCosts as ResourceOperation[],
              tx,
            });
            if (!consumeResult.success) {
              throw new Error(
                consumeResult.errors?.join('; ') || '资源消耗失败',
              );
            }
            const condition: Cultivator['condition'] | undefined =
              (await this.applyConditionResourceLosses(
                cultivatorId,
                actionCosts,
                tx,
              )) ?? undefined;
            await this.persistStateRecord(
              cultivatorId,
              state,
              battlePayload,
              tx,
            );
            return mergeDungeonPersistenceSettlements(
              toDungeonPersistenceSettlement(consumeResult),
              condition ? { condition } : null,
            );
          },
          afterCommit: async () => {
            await this.saveRedisState(cultivatorId, state);
            await redis.set(
              getDungeonBattleKey(session.battleId),
              JSON.stringify(battlePayload),
              'EX',
              3600,
            );
          },
        };
      }

      await this.saveState(cultivatorId, state, battlePayload);

      return {
        actionId,
        state,
        type: 'TRIGGER_BATTLE',
        battleId: session.battleId,
        isFinished: false,
      };
    }

    const isTerminalEvent = state.currentRound >= state.maxRounds;
    state.status = 'GENERATING_NEXT';
    if (!options.deferPersistence) {
      await this.saveState(cultivatorId, state);
    }
    if (!isTerminalEvent) state.currentRound++;

    // 3. AI 生成下一轮
    let roundData: DungeonRound;
    try {
      roundData = await this.previewRoundResourceLoss(
        await this.bindRoundMaterialCosts(
          this.normalizeRoundOptions(
            await this.callAI(
              state,
              isTerminalEvent ? 'terminal' : 'advance',
            ),
            state,
          ),
          cultivatorId,
        ),
        cultivatorId,
      );
    } catch (error) {
      if (!isTerminalEvent) state.currentRound--;
      this.rollbackStagedExploration(state, exploration);
      const recoverable = await this.markRecoverable(
        cultivatorId,
        state,
        error instanceof Error ? error.message : '下一轮生成失败',
        ACTION_RECOVERABLE_ACTIONS,
        options,
      );
      return options.deferPersistence
        ? {
            actionId,
            state: recoverable,
            isFinished: false,
            ...this.buildStateHooks(cultivatorId, recoverable),
          }
        : { actionId, state: recoverable, isFinished: false };
    }

    // LLM 成功后再扣资源，避免“生成失败但资源已扣除”
    if (!options.deferPersistence) {
      try {
        await consumeActionCostsOrThrow();
      } catch (error) {
        if (!isTerminalEvent) state.currentRound--;
        this.rollbackStagedExploration(state, exploration);
        state.status = 'EXPLORING';
        state.pendingAction = {
          ...pendingAction,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        };
        state.costPreview = undefined;
        await this.saveState(cultivatorId, state);
        throw error;
      }
    }
    // 奖励与结果归属于刚刚完成的选择，不挂到下一个事件上。
    recordGeneratedActionResult(state, roundData);

    // 4. 更新状态
    if (isTerminalEvent) {
      if (!options.deferPersistence) {
        this.commitCostsToState(state, pendingAction);
        state.pendingAction = undefined;
        state.costPreview = undefined;
      }
      const result = await this.settleDungeon(state, {
        pendingAction: options.deferPersistence ? pendingAction : undefined,
        deferPersistence: options.deferPersistence,
      });
      return { actionId, roundData, ...result };
    }

    this.prepareNextEventOptions(state, roundData);
    state.history.push({
      round: state.currentRound,
      scene: roundData.scene_description,
      gained_items: [],
    });

    this.commitCostsToState(state, pendingAction);
    state.pendingAction = undefined;
    state.costPreview = undefined;

    state.status = 'EXPLORING';

    if (options.deferPersistence) {
      return {
        actionId,
        state,
        roundData,
        isFinished: false,
        persist: async (tx: DbTransaction) => {
          const userId = await findActiveCultivatorOwnerId(cultivatorId);
          if (!userId) {
            throw new Error('无法获取修真者所属用户');
          }
          const consumeResult = await resourceEngine.applyInTransaction({
            userId,
            cultivatorId,
            consume: actionCosts as ResourceOperation[],
            tx,
          });
          if (!consumeResult.success) {
            throw new Error(consumeResult.errors?.join('; ') || '资源消耗失败');
          }
          const condition: Cultivator['condition'] | undefined =
            (await this.applyConditionResourceLosses(
              cultivatorId,
              actionCosts,
              tx,
            )) ?? undefined;
          await this.persistStateRecord(cultivatorId, state, undefined, tx);
          return mergeDungeonPersistenceSettlements(
            toDungeonPersistenceSettlement(consumeResult),
            condition ? { condition } : null,
          );
        },
        afterCommit: async () => {
          await this.saveRedisState(cultivatorId, state);
        },
      };
    }

    await this.saveState(cultivatorId, state);
    return { actionId, state, roundData, isFinished: false };
  }

  // --- Battle Integration ---

  /* Removed old generateEnemy in favor of enemyGenerator */

  private async createBattleSession(
    cultivatorId: string,
    dungeonStateKey: string,
    battleCost: DungeonOptionCost,
    playerInfo: PlayerInfo,
    dungeonState: DungeonState,
    options: DungeonFlowOptions = {},
  ): Promise<BattleSession & { enemyObject: Cultivator }> {
    console.log('[createBattleSession]', battleCost);
    const battleId = randomUUID();

    // 获取地图节点的境界要求
    const mapNode = getMapNode(dungeonState.mapNodeId);
    if (!mapNode || !('realm_requirement' in mapNode)) {
      throw new Error('Invalid map node or missing realm_requirement');
    }
    const realmRequirement = (mapNode as { realm_requirement: string })
      .realm_requirement;
    const mapConfig = resolveDungeonMapConfig(mapNode);
    const metadata = battleCost.metadata;
    if (!metadata?.race || !metadata.realm_stage) {
      throw new Error('Battle cost metadata must include race and realm_stage');
    }

    const enemyDifficulty = mapConfig.enemyDifficulty;
    const enemyRealmStage = clampDungeonEnemyRealmStage(
      metadata.realm_stage,
      mapConfig,
    );

    const draft = await dungeonEnemyGenerator.enrichNarrative(
      dungeonEnemyGenerator.buildDraft({
        realm: realmRequirement as import('@shared/types/constants').RealmType,
        realmStage: enemyRealmStage,
        race: metadata.race,
        difficulty: enemyDifficulty,
        name: metadata.enemy_name,
        background: metadata.background,
        description: metadata.description,
        isBoss:
          mapConfig.difficultyTier === 'boss' && Boolean(metadata.is_boss),
      }),
    );
    const enemy = draft.cultivator;

    // 构建 BattleSession。角色当前 HP/MP 会在执行战斗时从持久 condition 注入。
    const session: BattleSession = {
      battleId,
      dungeonStateKey,
      cultivatorId,
      enemyData: {
        name: enemy.name,
        realm: enemy.realm,
        stage: enemy.realm_stage,
        level: `${enemy.realm} ${enemy.realm_stage}`,
        difficulty: enemyDifficulty,
      },
    };

    if (!options.deferPersistence) {
      await redis.set(
        `dungeon:battle:${battleId}`,
        JSON.stringify({ session, enemyObject: enemy }),
        'EX',
        3600,
      );
    }

    return {
      ...session,
      enemyObject: enemy,
    };
  }

  async handleBattleCallback(
    cultivatorId: string,
    battleResult: BattleRecordV3,
    nextCondition: CultivatorCondition,
    didLose: boolean,
    options: DungeonFlowOptions = {},
  ): Promise<{
    state?: DungeonState;
    roundData?: DungeonRound;
    isFinished: boolean;
    realGains?: ResourceOperation[];
    settlement?: DungeonSettlement;
    persist?: (
      tx: DbTransaction,
    ) => Promise<DungeonPersistenceSettlement | void>;
    afterCommit?: () => Promise<void>;
  }> {
    const state = await this.getState(cultivatorId);
    if (!state) throw new Error('Dungeon state not found');

    const lastHistory = state.history[state.history.length - 1];

    // Update State
    state.status = 'EXPLORING';
    delete state.activeBattleId;

    // Construct Narrative
    const enemyName = didLose
      ? battleResult.outcome.winner.name
      : battleResult.outcome.loser.name;
    const isWin = !didLose;
    if (!options.deferPersistence) {
      await updateCultivator(cultivatorId, { condition: nextCondition });
    }

    // 战斗失败处理：生成伤势状态
    if (!isWin) {
      discardCurrentRoundRewards(state);
      const outcomeText = `你终究是不敌 ${enemyName}，在其重击下狼狈遁走，侥幸捡回一条命。但你已无力再战，只得退出副本。`;
      lastHistory.outcome = outcomeText;

      const settled = await this.settleDungeon(state, {
        endDisposition: 'retreated_after_battle',
        battleDefeated: true,
        deferPersistence: options.deferPersistence,
      });
      if (!options.deferPersistence) {
        return settled;
      }
      return {
        ...settled,
        persist: async (tx) => {
          await updateCultivator(
            cultivatorId,
            { condition: nextCondition },
            tx,
          );
          const settlement = settled.persist
            ? await settled.persist(tx)
            : undefined;
          return mergeDungeonPersistenceSettlements(
            { condition: nextCondition },
            settlement && typeof settlement === 'object'
              ? settlement
              : undefined,
          );
        },
        afterCommit: settled.afterCommit,
      };
    }

    const outcomeText = `历经 ${battleResult.outcome.turns} 个回合的苦战，你成功击败了 ${enemyName}。虽然负了些伤，但总算化险为夷。`;
    lastHistory.outcome = outcomeText;
    this.recordDefeatedEnemy(state, enemyName);

    // FIX: Instead of calling AI immediately, enter LOOTING state
    state.status = 'LOOTING';
    if (!options.deferPersistence) {
      await this.saveState(cultivatorId, state);
    }
    if (options.deferPersistence) {
      return {
        state,
        isFinished: false,
        persist: async (tx) => {
          await updateCultivator(
            cultivatorId,
            { condition: nextCondition },
            tx,
          );
          await this.persistStateRecord(cultivatorId, state, undefined, tx);
          return { condition: nextCondition };
        },
        afterCommit: async () => {
          await this.saveRedisState(cultivatorId, state);
        },
      };
    }
    return { state, isFinished: false };
  }

  async probeBattleEnemy(cultivatorId: string, battleId: string) {
    const { enemyObject } = await this.getBattleContext(cultivatorId, battleId);
    return enemyObject;
  }

  async executeBattle(
    cultivatorId: string,
    battleId: string,
    battlePlan: DungeonBattlePlan,
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-battle-execute',
      () =>
        this.executeBattleUnlocked(cultivatorId, battleId, battlePlan, options),
      options.lease,
    );
  }

  private async executeBattleUnlocked(
    cultivatorId: string,
    battleId: string,
    battlePlan: DungeonBattlePlan,
    options: DungeonFlowOptions = {},
  ) {
    const { battleKey, enemyObject } = await this.getBattleContext(
      cultivatorId,
      battleId,
    );

    const cultivatorBundle = await loadCultivatorCombatInput(cultivatorId);
    if (!cultivatorBundle?.cultivator) {
      throw new Error('未找到修真者数据');
    }

    const execution = executePersistentWorldBattle({
      strategyId: 'persistent_world',
      player: cultivatorBundle.cultivator,
      opponent: enemyObject,
      playerSelectionStrategy:
        battlePlan === 'basic_attack_only'
          ? new BasicAttackOnlySelectionStrategy()
          : undefined,
    });
    const { battleResult, nextCondition, didLose } = execution;

    try {
      const callbackData = await this.handleBattleCallback(
        cultivatorId,
        battleResult,
        nextCondition,
        didLose,
        options,
      );
      if (options.deferPersistence) {
        const callbackAfterCommit = callbackData.afterCommit;
        return {
          battleResult,
          ...callbackData,
          afterCommit: async () => {
            if (callbackAfterCommit) {
              await callbackAfterCommit();
            }
            await redis.del(battleKey);
          },
        };
      }
      return {
        battleResult,
        ...callbackData,
      };
    } catch (error) {
      console.error('[DungeonService] 战斗回调失败，进入恢复路径:', error);
      const recovered = await this.recoverAfterBattleCallbackFailure(
        cultivatorId,
        battleResult,
        nextCondition,
        didLose,
        error instanceof Error ? error.message : undefined,
        options,
      );
      if (options.deferPersistence) {
        const recoveredAfterCommit = recovered.afterCommit;
        return {
          battleResult,
          ...recovered,
          afterCommit: async () => {
            if (recoveredAfterCommit) {
              await recoveredAfterCommit();
            }
            await redis.del(battleKey);
          },
        };
      }
      return {
        battleResult,
        ...recovered,
      };
    } finally {
      if (!options.deferPersistence) {
        await redis.del(battleKey);
      }
    }
  }

  async abandonBattle(
    cultivatorId: string,
    battleId: string,
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-battle-abandon',
      () => this.abandonBattleUnlocked(cultivatorId, battleId, options),
      options.lease,
    );
  }

  private async abandonBattleUnlocked(
    cultivatorId: string,
    battleId: string,
    options: DungeonFlowOptions = {},
  ) {
    const state = await this.getState(cultivatorId);
    if (!state || state.activeBattleId !== battleId) {
      throw new Error('当前没有匹配的遭遇战');
    }
    const battleKey = getDungeonBattleKey(battleId);

    delete state.activeBattleId;
    state.status = 'FINISHED';
    discardCurrentRoundRewards(state);

    try {
      const result = await this.settleDungeon(state, {
        abandonedBattle: true,
        endDisposition: 'abandoned_before_battle',
        deferPersistence: options.deferPersistence,
      });
      if (!options.deferPersistence) {
        return result;
      }
      const settlementAfterCommit = result.afterCommit;
      return {
        ...result,
        afterCommit: async () => {
          if (settlementAfterCommit) {
            await settlementAfterCommit();
          }
          await redis.del(battleKey);
        },
      };
    } finally {
      if (!options.deferPersistence) {
        await redis.del(battleKey);
      }
    }
  }

  /**
   * 休整后继续探索 (触发 AI 生成下一轮)
   */
  async continueFromLooting(
    cultivatorId: string,
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-looting-continue',
      () => this.continueFromLootingUnlocked(cultivatorId, options),
      options.lease,
    );
  }

  private async continueFromLootingUnlocked(
    cultivatorId: string,
    options: DungeonFlowOptions,
  ) {
    const state = await this.getState(cultivatorId);
    if (!state) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.NOT_FOUND,
        '副本已失效',
        404,
      );
    }
    if (state.status !== 'LOOTING') {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '当前副本状态已变化，请刷新后重试',
        409,
      );
    }

    state.status = 'GENERATING_NEXT';
    state.statusReason = undefined;
    state.recoverableActions = undefined;
    if (state.currentRound < state.maxRounds) state.currentRound++;

    return this.generateRoundAfterLooting(cultivatorId, state, options);
  }

  private async generateRoundAfterLooting(
    cultivatorId: string,
    state: DungeonState,
    options: DungeonFlowOptions = {},
  ) {
    const isTerminalEvent = state.currentRound >= state.maxRounds;
    let roundData: DungeonRound;
    try {
      roundData = await this.previewRoundResourceLoss(
        await this.bindRoundMaterialCosts(
          this.normalizeRoundOptions(
            await this.callAI(
              state,
              isTerminalEvent ? 'terminal' : 'advance',
            ),
            state,
          ),
          cultivatorId,
        ),
        cultivatorId,
      );
    } catch (error) {
      console.error('[DungeonService] 战后生成失败:', error);
      const recoverable = await this.markRecoverable(
        cultivatorId,
        state,
        error instanceof Error ? error.message : '战后继续推演失败',
        CONTINUE_RECOVERABLE_ACTIONS,
        options,
      );
      return options.deferPersistence
        ? {
            state: recoverable,
            isFinished: false,
            ...this.buildStateHooks(cultivatorId, recoverable),
          }
        : { state: recoverable, isFinished: false };
    }

    recordGeneratedActionResult(state, roundData);
    if (isTerminalEvent) {
      return this.settleDungeon(state, {
        deferPersistence: options.deferPersistence,
      });
    }

    this.prepareNextEventOptions(state, roundData);
    state.history.push({
      round: state.currentRound,
      scene: roundData.scene_description,
      gained_items: [],
    });

    state.status = 'EXPLORING';
    state.statusReason = undefined;
    state.recoverableActions = undefined;

    if (options.deferPersistence) {
      return {
        state,
        roundData,
        isFinished: false,
        ...this.buildStateHooks(cultivatorId, state),
      };
    }

    await this.saveState(cultivatorId, state);
    return { state, roundData, isFinished: false };
  }

  /**
   * 战后见好就收
   */
  async escapeFromLooting(
    cultivatorId: string,
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-looting-escape',
      () => this.escapeFromLootingUnlocked(cultivatorId, options),
      options.lease,
    );
  }

  private async escapeFromLootingUnlocked(
    cultivatorId: string,
    options: DungeonFlowOptions,
  ) {
    const state = await this.getState(cultivatorId);
    if (!state) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.NOT_FOUND,
        '副本已失效',
        404,
      );
    }
    if (state.status !== 'LOOTING') {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '当前副本状态已变化，请刷新后重试',
        409,
      );
    }
    return this.settleDungeon(state, {
      abandonedBattle: true,
      endDisposition: 'retreated_after_battle',
      deferPersistence: options.deferPersistence,
    });
  }

  /**
   * 战斗回调失败时的恢复路径。
   * 目标：确保不会卡在战斗中，后续结算失败也能进入可重试状态。
   */
  async recoverAfterBattleCallbackFailure(
    cultivatorId: string,
    battleResult: BattleRecordV3,
    nextCondition: CultivatorCondition,
    didLose: boolean,
    reason?: string,
    options: DungeonFlowOptions = {},
  ): Promise<{
    state?: DungeonState;
    roundData?: DungeonRound;
    isFinished: boolean;
    settlement?: DungeonSettlement;
    realGains?: ResourceOperation[];
    persist?: (
      tx: DbTransaction,
    ) => Promise<DungeonPersistenceSettlement | void>;
    afterCommit?: () => Promise<void>;
  }> {
    const state = await this.getState(cultivatorId);
    if (!state) {
      throw new Error('Dungeon state not found during recovery');
    }

    delete state.activeBattleId;

    const enemyName = didLose
      ? battleResult.outcome.winner.name
      : battleResult.outcome.loser.name;
    const isWin = !didLose;
    const lastHistory = state.history[state.history.length - 1];
    if (!options.deferPersistence) {
      await updateCultivator(cultivatorId, { condition: nextCondition });
    }

    if (!isWin) {
      discardCurrentRoundRewards(state);
      if (lastHistory) {
        lastHistory.outcome = `你不敌 ${enemyName}，被迫退出秘境。${reason ? `（天机紊乱：${reason}）` : ''}`;
      }

      const settled = await this.settleDungeon(state, {
        endDisposition: 'retreated_after_battle',
        battleDefeated: true,
        deferPersistence: options.deferPersistence,
      });
      if (!options.deferPersistence) return settled;
      const persistSettlement = settled.persist;
      return {
        ...settled,
        persist: async (tx) => {
          await updateCultivator(
            cultivatorId,
            { condition: nextCondition },
            tx,
          );
          const persisted = persistSettlement
            ? await persistSettlement(tx)
            : undefined;
          return mergeDungeonPersistenceSettlements(
            { condition: nextCondition },
            persisted && typeof persisted === 'object' ? persisted : undefined,
          );
        },
      };
    }

    // 胜利但回调失败，强制进入 LOOTING 状态进行自我修复
    state.status = 'LOOTING';
    this.recordDefeatedEnemy(state, enemyName);
    if (lastHistory) {
      lastHistory.outcome = `你击败了 ${enemyName}，但天机推演一时失序，需稳住心神。`;
    }
    if (!options.deferPersistence) {
      await this.saveState(cultivatorId, state);
    }
    if (options.deferPersistence) {
      return {
        state,
        isFinished: false,
        persist: async (tx) => {
          await updateCultivator(
            cultivatorId,
            { condition: nextCondition },
            tx,
          );
          await this.persistStateRecord(cultivatorId, state, undefined, tx);
          return { condition: nextCondition };
        },
        afterCommit: async () => {
          await this.saveRedisState(cultivatorId, state);
        },
      };
    }
    return { state, isFinished: false };
  }

  /**
   * 结算副本：采用“AI评价 + 后端发放”模式
   */
  async settleDungeon(
    state: DungeonState,
    options?: DungeonSettlementOptions,
  ): Promise<DungeonSettlementResult> {
    state.status = 'SETTLING';
    state.statusReason = undefined;
    state.recoverableActions = undefined;
    state.settlementEndDisposition =
      options?.endDisposition ??
      state.settlementEndDisposition ??
      (options?.abandonedBattle ? 'abandoned_before_battle' : 'completed');
    state.battleDefeated =
      options?.battleDefeated ?? state.battleDefeated ?? false;

    try {
      return await this.performSettlement(state, options);
    } catch (error) {
      console.error('[DungeonSettlement] 结算失败，进入可恢复状态:', error);
      const recoverableActions =
        error instanceof DungeonSettlementRecoverableError
          ? error.actions
          : SETTLE_RECOVERABLE_ACTIONS;
      const recoverable = await this.markRecoverable(
        state.cultivatorId,
        state,
        error instanceof Error ? error.message : '副本结算失败',
        recoverableActions,
        { deferPersistence: options?.deferPersistence },
      );
      return options?.deferPersistence
        ? {
            state: recoverable,
            isFinished: false,
            ...this.buildStateHooks(state.cultivatorId, recoverable),
          }
        : { state: recoverable, isFinished: false };
    }
  }

  private async performSettlement(
    state: DungeonState,
    options?: DungeonSettlementOptions,
  ): Promise<DungeonSettlementResult> {
    // --- 核心优化：使用 RewardFactory 将 AI 蓝图转化为真实奖励 ---
    // 获取地图境界门槛
    const mapNode = getMapNode(state.mapNodeId);
    const mapRealm =
      mapNode && 'realm_requirement' in mapNode
        ? (mapNode as SatelliteNode).realm_requirement
        : ('筑基' as RealmType);

    const endDisposition =
      options?.endDisposition ??
      state.settlementEndDisposition ??
      (options?.abandonedBattle ? 'abandoned_before_battle' : 'completed');
    const battleDefeated =
      options?.battleDefeated ?? state.battleDefeated ?? false;
    const allowExtraRewards = endDisposition === 'completed';
    const deferPersistence = options?.deferPersistence === true;
    const pendingActionToCommit =
      options?.pendingAction &&
      !this.hasCommittedAction(state, options.pendingAction.actionId)
        ? options.pendingAction
        : undefined;
    let settlement = state.settlement;
    if (!settlement && battleDefeated) {
      settlement = createBattleDefeatSettlement(state);
    } else if (!settlement) {
      const settlementContext = buildDungeonSettlementLlmContext({
        state,
        mapRealm,
        endDisposition,
      });
      if (!allowExtraRewards) {
        settlementContext.remainingExtraRewardSlots = 0;
      }
      const { system: settlementPrompt, user: settlementUserPrompt } =
        renderPrompt('dungeon-settlement', {
          materialTypeTable: DUNGEON_MATERIAL_TYPE_TABLE,
          settlementContextJson: stableCompactStringify(settlementContext),
        });

      const aiRes = await generateAiObject({
        system: settlementPrompt,
        prompt: settlementUserPrompt,
        schema: createDungeonSettlementLlmSchema(
          settlementContext.remainingExtraRewardSlots,
        ),
        name: 'DungeonSettlement',
        sceneId: 'dungeon-settlement',
      });
      const generatedSettlement = DungeonSettlementGeneratedSchema.parse({
        ending_narrative: normalizeDungeonResourceTerminology(
          aiRes.output.ending_narrative,
        ),
        settlement: {
          reward_tier: aiRes.output.reward_tier,
          reward_blueprints: aiRes.output.reward_blueprints,
          performance_tags: sanitizePerformanceTags(
            aiRes.output.performance_tags,
            aiRes.output.reward_tier,
          ),
        },
      });
      settlement = generatedSettlement;
    }
    settlement = constrainSettlementForDisposition(
      normalizeSettlementRewards(
        settlement,
        state.accumulatedRewards ?? [],
        allowExtraRewards,
      ),
      endDisposition,
    );

    if (pendingActionToCommit) {
      const userId = await findActiveCultivatorOwnerId(state.cultivatorId);
      if (!userId) {
        throw new Error('无法获取修真者所属用户');
      }
      if (!deferPersistence) {
        const result = await getExecutor().transaction(async (tx) => {
          const applied = await resourceEngine.applyInTransaction({
            userId,
            cultivatorId: state.cultivatorId,
            consume: pendingActionToCommit.costs as ResourceOperation[],
            tx,
          });
          if (applied.success) {
            await this.applyConditionResourceLosses(
              state.cultivatorId,
              pendingActionToCommit.costs,
              tx,
            );
          }
          return applied;
        });
        if (!result.success) {
          state.status = 'EXPLORING';
          state.pendingAction = {
            ...pendingActionToCommit,
            status: 'failed',
            error: result.errors?.join('; ') || '资源消耗失败',
          };
          state.costPreview = undefined;
          await this.saveState(state.cultivatorId, state);
          throw new DungeonSettlementRecoverableError(
            result.errors?.join('; ') || '资源消耗失败',
            ACTION_RECOVERABLE_ACTIONS,
          );
        }
      }
      this.commitCostsToState(state, pendingActionToCommit);
      state.pendingAction = undefined;
      state.costPreview = undefined;
      if (!deferPersistence) {
        await this.saveState(state.cultivatorId, state);
      }
    }

    if (!state.settlement) {
      state.settlement = settlement;
      if (!deferPersistence) {
        await this.saveState(state.cultivatorId, state);
      }
    }

    const committedSettlementGain = state.gainLedger?.find(
      (entry) => entry.source === 'settlement',
    );
    const realGains =
      state.realGains ??
      committedSettlementGain?.gains ??
      applyExplorationExperienceBonus(
        RewardFactory.generateAllRewards(
          settlement.settlement.reward_blueprints as RewardBlueprint[],
          mapRealm,
          settlement.settlement.reward_tier,
          state.dangerScore, // 传递危险分数用于奖励计算
          state.playerInfo, // 传递玩家信息用于修为计算
          mapNode ? resolveDungeonMapConfig(mapNode).difficultyTier : undefined,
        ),
        state,
      );
    state.realGains = realGains;
    if (!deferPersistence) {
      await this.saveState(state.cultivatorId, state);
    }

    // 获取 userId
    const userId = await findActiveCultivatorOwnerId(state.cultivatorId);
    if (!userId) {
      throw new Error('无法获取修真者所属用户');
    }

    let nextGainLedger = state.gainLedger ?? [];
    if (!committedSettlementGain) {
      // DungeonResourceGain 与 ResourceOperation 结构兼容
      // desc 字段在 ResourceEngine 中会被忽略
      nextGainLedger = [
        ...(state.gainLedger ?? []),
        {
          source: 'settlement' as const,
          gains: realGains,
          committedAt: new Date().toISOString(),
        },
      ];
      if (!deferPersistence) {
        const runId = state.runId;
        const result = await getExecutor().transaction(async (tx) => {
          const applied = await resourceEngine.applyInTransaction({
            userId,
            cultivatorId: state.cultivatorId,
            gain: realGains as ResourceOperation[],
            tx,
          });
          if (applied.success && runId) {
            await tx
              .update(dungeonRuns)
              .set({
                runState: {
                  ...state,
                  gainLedger: nextGainLedger,
                  realGains,
                },
                gainLedger: nextGainLedger,
              })
              .where(eq(dungeonRuns.id, runId));
          }
          return applied;
        });

        if (!result.success) {
          throw new Error(result.errors?.join('; ') || '资源获得失败');
        }
      }

      state.gainLedger = nextGainLedger;
      if (!deferPersistence) {
        await this.saveState(state.cultivatorId, state);
      }
    }

    let domainEventId: string | undefined;
    const recordDungeonSettledEvent = async (tx: DbTransaction) => {
      if (!state.runId) throw new Error('副本结算缺少运行编号');
      const event = await createDomainEvent(
        {
          type: 'dungeon.run.settled',
          aggregate: { type: 'dungeon-run', id: state.runId },
          data: {
            cultivatorId: state.cultivatorId,
            runId: state.runId,
            mapNodeId: state.mapNodeId,
            outcome: endDisposition,
          },
          deduplicationKey: `${state.cultivatorId}:dungeon:${state.runId}`,
        },
        tx,
      );
      domainEventId = event.id;
    };

    if (!deferPersistence) {
      await getExecutor().transaction(async (tx) => {
        await this.archiveDungeon(state, settlement, realGains, {
          tx,
          clearRedis: false,
        });
        await recordDungeonSettledEvent(tx);
      });
      await redis.del(getDungeonKey(state.cultivatorId));
      publishTransactionalMessageBestEffort(domainEventId, {
        source: 'dungeon_settlement',
        cultivatorId: state.cultivatorId,
        runId: state.runId,
      });
    }

    if (!deferPersistence) {
      return { isFinished: true, settlement, realGains };
    }

    return {
      isFinished: true,
      settlement,
      realGains,
      persist: async (tx) => {
        await this.assertTerminalRunCanCommit(tx, state);

        let consumedSettlement: DungeonPersistenceSettlement | undefined;
        let gainedSettlement: DungeonPersistenceSettlement | undefined;
        let condition: Cultivator['condition'] | undefined;
        if (pendingActionToCommit) {
          const consumeResult = await resourceEngine.applyInTransaction({
            userId,
            cultivatorId: state.cultivatorId,
            consume: pendingActionToCommit.costs as ResourceOperation[],
            tx,
          });
          if (!consumeResult.success) {
            throw new Error(consumeResult.errors?.join('; ') || '资源消耗失败');
          }
          condition =
            (await this.applyConditionResourceLosses(
              state.cultivatorId,
              pendingActionToCommit.costs,
              tx,
            )) ?? undefined;
          consumedSettlement = toDungeonPersistenceSettlement(consumeResult);
        }

        if (!committedSettlementGain) {
          const runId = state.runId;
          const gainResult = await resourceEngine.applyInTransaction({
            userId,
            cultivatorId: state.cultivatorId,
            gain: realGains as ResourceOperation[],
            tx,
          });
          if (gainResult.success && runId) {
            await tx
              .update(dungeonRuns)
              .set({
                runState: {
                  ...state,
                  gainLedger: nextGainLedger,
                  realGains,
                },
                gainLedger: nextGainLedger,
              })
              .where(eq(dungeonRuns.id, runId));
          }
          if (!gainResult.success) {
            throw new Error(gainResult.errors?.join('; ') || '资源获得失败');
          }
          gainedSettlement = toDungeonPersistenceSettlement(gainResult);
        }

        await this.archiveDungeon(state, settlement, realGains, {
          tx,
          clearRedis: false,
        });
        await recordDungeonSettledEvent(tx);
        return mergeDungeonPersistenceSettlements(
          consumedSettlement,
          gainedSettlement,
          condition ? { condition } : null,
        );
      },
      afterCommit: async () => {
        await redis.del(getDungeonKey(state.cultivatorId));
        publishTransactionalMessageBestEffort(domainEventId, {
          source: 'dungeon_settlement',
          cultivatorId: state.cultivatorId,
          runId: state.runId,
        });
      },
    };
  }

  /**
   * 内部工具：调用 AI 并处理上下文压缩
   */
  private async callAI(
    state: DungeonState,
    mode: DungeonRoundGenerationMode = 'advance',
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
          connections: [],
          x: 0,
          y: 0,
        });
    const realmGap = this.calculateRealmGap(state.playerInfo.realm, mapRealm);
    const phase = this.getPhase(state.currentRound, state.maxRounds, realmGap);
    const currentPlayer = await loadCultivatorDungeonPromptFacts(
      state.cultivatorId,
    );
    const currentResources = currentPlayer
      ? ConditionService.tickNaturalRecovery(
          currentPlayer,
          currentPlayer.condition,
        ).resources
      : undefined;
    const userContext: DungeonRoundLlmContext = buildDungeonRoundLlmContext({
      state,
      mapConfig,
      realmGap,
      phase,
      currentResources,
    });
    if (mode === 'terminal') {
      userContext.flow = {
        ...userContext.flow,
        stage: 'resolution',
        requiredOptionCount: 'none',
      };
    }

    const remainingRewardSlots = Math.max(
      0,
      DUNGEON_REWARD_BLUEPRINT_LIMIT - state.accumulatedRewards.length,
    );
    const eventRewardCount: 0 | 1 =
      mode === 'initial' || remainingRewardSlots === 0 ? 0 : 1;
    let continuityViolations: string[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const aiRes = await generateAiObject({
        system: this.getSystemPrompt(),
        prompt: stableCompactStringify(
          continuityViolations.length > 0
            ? {
                ...userContext,
                continuityCorrection: {
                  rejectedPreviousOutput: continuityViolations,
                  instruction:
                    '重新生成本轮并逐项修正 rejectedPreviousOutput；action_outcome 必须完整结算刚执行的 lastAction 并明确收起指定奖励，scene_description 只写结算后的新场景；探索目标必须是稳定名词对象，操作方式只填 action_mode；costs 只能写无条件确定扣除；不得宣称未由服务端写入的强化效果；不得复活已击败敌人，不得生成占位或重复奖励，场景正文不得夹带选项列表。',
                },
              }
            : userContext,
        ),
        schema: createDungeonRoundLlmSchema(
          eventRewardCount,
          mode === 'terminal' ? 'none' : 'up_to_three',
        ),
        name: 'DungeonRound',
        sceneId: 'dungeon-round',
      });

      const roundData = ensureRewardAcquisitionNarrative(
        DungeonRoundSchema.parse({
          scene_description: normalizeDungeonResourceTerminology(
            aiRes.output.scene_description,
          ),
          action_outcome: normalizeDungeonResourceTerminology(
            aiRes.output.action_outcome,
          ),
          interaction: {
            options: aiRes.output.options.map((option, index) => ({
              ...option,
              id: index + 1,
              text: normalizeDungeonResourceTerminology(option.text),
              exploration_target: normalizeExplorationTarget(
                normalizeDungeonResourceTerminology(
                  option.exploration_target,
                ),
                option.text,
              ),
              action_mode: normalizeDungeonResourceTerminology(
                option.action_mode,
              ),
              requirement: option.requirement
                ? normalizeDungeonResourceTerminology(option.requirement)
                : undefined,
              potential_cost: option.potential_cost
                ? normalizeDungeonResourceTerminology(option.potential_cost)
                : undefined,
              costs: (option.costs ?? []).map((cost) => ({
                ...cost,
                desc: cost.desc
                  ? normalizeDungeonResourceTerminology(cost.desc)
                  : undefined,
              })),
            })),
          },
          acquired_items: aiRes.output.acquired_items,
          status_update: {
            is_final_round: mode === 'terminal',
            internal_danger_score: aiRes.output.internal_danger_score,
          },
        }),
        userContext.lastAction?.target,
      );
      continuityViolations = findDungeonRoundContinuityViolations(
        state,
        roundData,
      );
      if (continuityViolations.length === 0) return roundData;
    }

    console.warn('[DungeonService] 副本连续性校验失败:', {
      cultivatorId: state.cultivatorId,
      mapNodeId: state.mapNodeId,
      round: state.currentRound,
      violations: continuityViolations,
    });
    throw new DungeonFlowError(
      DungeonFlowErrorCode.GENERATION_FAILED,
      '本轮秘境演化失败，请重试',
      503,
    );
  }

  async saveState(
    cultivatorId: string,
    state: DungeonState,
    battlePayload?: DungeonBattleCachePayload,
  ) {
    this.normalizeState(state);
    await this.persistStateRecord(cultivatorId, state, battlePayload);
    await this.saveRedisState(cultivatorId, state);
  }

  private async persistStateRecord(
    cultivatorId: string,
    state: DungeonState,
    battlePayload?: DungeonBattleCachePayload,
    tx?: DbTransaction,
  ) {
    this.normalizeState(state);
    const values = {
      cultivatorId,
      mapNodeId: state.mapNodeId,
      status: state.status,
      currentRound: state.currentRound,
      maxRounds: state.maxRounds,
      dangerScore: state.dangerScore,
      runState: state,
      costLedger: state.costLedger ?? [],
      gainLedger: state.gainLedger ?? [],
      pendingAction: state.pendingAction ?? null,
      activeBattleId: state.activeBattleId ?? null,
      battlePayload: battlePayload ?? null,
    };
    const q = tx ?? getExecutor();

    if (state.runId) {
      await q
        .update(dungeonRuns)
        .set(values)
        .where(eq(dungeonRuns.id, state.runId));
    } else {
      const inserted = await q
        .insert(dungeonRuns)
        .values(values)
        .returning({ id: dungeonRuns.id });
      state.runId = inserted[0]?.id;
      if (state.runId) {
        await q
          .update(dungeonRuns)
          .set({ runState: state })
          .where(eq(dungeonRuns.id, state.runId));
      }
    }
  }

  private async assertTerminalRunCanCommit(
    tx: DbTransaction,
    state: DungeonState,
  ) {
    if (!state.runId) {
      return;
    }

    const claimed = await tx
      .update(dungeonRuns)
      .set({
        status: 'FINISHED',
        endedAt: new Date(),
      })
      .where(
        and(
          eq(dungeonRuns.id, state.runId),
          isNull(dungeonRuns.endedAt),
          ne(dungeonRuns.status, 'FINISHED'),
        ),
      )
      .returning({ id: dungeonRuns.id });

    if (claimed.length === 1) {
      return;
    }

    const [run] = await tx
      .select({ id: dungeonRuns.id })
      .from(dungeonRuns)
      .where(eq(dungeonRuns.id, state.runId))
      .limit(1);
    if (!run) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.NOT_FOUND,
        '副本已失效',
        404,
      );
    }

    throw new DungeonFlowError(
      DungeonFlowErrorCode.INVALID_STATE,
      '当前副本已完成，请刷新查看结算',
      409,
    );
  }

  private async saveRedisState(cultivatorId: string, state: DungeonState) {
    await redis.set(
      getDungeonKey(cultivatorId),
      JSON.stringify(state),
      'EX',
      REDIS_TTL,
    );
  }

  async getState(cultivatorId: string) {
    const key = getDungeonKey(cultivatorId);
    const run = await this.loadActiveRun(cultivatorId);
    let state: DungeonState | null;
    if (run) {
      state = run.runState as DungeonState;
      state.runId = run.id;
      state.status = run.status as DungeonState['status'];
      state.currentRound = run.currentRound;
      state.maxRounds = run.maxRounds;
      state.dangerScore = run.dangerScore;
      state.costLedger = (run.costLedger as DungeonState['costLedger']) ?? [];
      state.gainLedger = (run.gainLedger as DungeonState['gainLedger']) ?? [];
      state.pendingAction =
        (run.pendingAction as DungeonState['pendingAction']) ?? undefined;
      state.activeBattleId = run.activeBattleId ?? state.activeBattleId;
      this.normalizeState(state);
      await redis.set(key, JSON.stringify(state), 'EX', REDIS_TTL);
    } else {
      state = parseRedisJson<DungeonState>(await redis.get(key), key);
    }
    if (!state) return null;
    return this.normalizeState(state);
  }

  async prepareDungeonContext(cultivatorId: string, mapNodeId: string) {
    const player = await this.getPlayer(cultivatorId);
    const mapNode = this.getMapNode(mapNodeId);
    assertDungeonRealmEligible(
      player.realm.split(' ')[0] as RealmType,
      mapNode.realm_requirement,
    );
    return {
      playerInfo: player,
      location: {
        location: mapNode.name,
        location_tags: mapNode.tags,
        location_description: mapNode.description,
      },
    };
  }

  async getPlayer(cultivatorId: string) {
    const cultivatorBundle =
      await loadCultivatorDungeonPromptFacts(cultivatorId);
    if (!cultivatorBundle) throw new Error('未找到名为该道友的记录');
    const cultivator = cultivatorBundle;
    const { finalAttributes, attrs } =
      getCultivatorDisplayAttributes(cultivator);
    return {
      id: cultivator.id,
      name: cultivator.name,
      realm: `${cultivator.realm} ${cultivator.realm_stage}`,
      gender: cultivator.gender,
      age: cultivator.age,
      lifespan: cultivator.lifespan,
      personality: cultivator.personality || '普通',
      attributes: { ...finalAttributes },
      resourceCaps: {
        maxHp: attrs.maxHp,
        maxMp: attrs.maxMp,
      },
      spiritual_roots: cultivator.spiritual_roots.map(
        (root) => `${root.element}(${root.grade})`,
      ),
      fates: cultivator.pre_heaven_fates.map(
        (fate) => `${fate.name}(${fate.description})`,
      ),
      skills: cultivator.cultivations.map((skill) => skill.name),
      spirit_stones: cultivator.spirit_stones,
      background: cultivator.background || '',
      inventory_summary:
        '玩家拥有储物袋。如有需要特定材料的操作，请使用模糊类型与品质要求。',
    };
  }

  getMapNode(mapNodeId: string) {
    const mapNode = getMapNode(mapNodeId);
    if (!mapNode) throw new Error('无效的地图节点');
    return mapNode;
  }

  async archiveDungeon(
    state: DungeonState,
    settlement: DungeonSettlement,
    realGains?: ResourceOperation[],
    options: { tx?: DbTransaction; clearRedis?: boolean } = {},
  ) {
    state.status = 'FINISHED';
    state.isFinished = true;
    state.settlement = settlement;
    state.realGains = realGains;
    state.pendingAction = undefined;
    state.costPreview = undefined;
    state.recoverableActions = undefined;
    state.activeBattleId = undefined;

    const archive = async (tx: DbTransaction) => {
      if (!state.archiveHistoryCommittedAt) {
        await tx.insert(dungeonHistories).values({
          cultivatorId: state.cultivatorId,
          theme: state.theme,
          result: settlement,
          log: state.history
            .map((h) => `[Round ${h.round}] ${h.scene} -> Choice: ${h.choice}`)
            .join('\n'),
          realGains: realGains ?? null,
        });
        state.archiveHistoryCommittedAt = new Date().toISOString();
      }

      if (state.runId) {
        await tx
          .update(dungeonRuns)
          .set({
            status: 'FINISHED',
            runState: this.normalizeState(state),
            costLedger: state.costLedger ?? [],
            gainLedger: state.gainLedger ?? [],
            pendingAction: null,
            activeBattleId: null,
            battlePayload: null,
            endedAt: new Date(),
          })
          .where(eq(dungeonRuns.id, state.runId));
      }
    };

    if (options.tx) {
      await archive(options.tx);
    } else {
      await getExecutor().transaction(archive);
    }

    if (options.clearRedis !== false) {
      await redis.del(getDungeonKey(state.cultivatorId));
    }
  }

  /**
   * Abandon the current dungeon
   */
  async recoverDungeon(
    cultivatorId: string,
    action: DungeonRecoverAction,
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-recover',
      () => this.recoverDungeonUnlocked(cultivatorId, action, options),
      options.lease,
    );
  }

  private async recoverDungeonUnlocked(
    cultivatorId: string,
    action: DungeonRecoverAction,
    options: DungeonFlowOptions = {},
  ) {
    const state = await this.getState(cultivatorId);
    if (!state) {
      throw new Error('副本已失效');
    }

    if (action === 'force_quit') {
      return this.quitDungeon(cultivatorId, options);
    }

    if (action === 'safe_retreat') {
      delete state.activeBattleId;
      state.status = 'SETTLING';
      state.statusReason = '已选择安全撤退';
      state.recoverableActions = undefined;
      return this.settleDungeon(state, {
        abandonedBattle: true,
        endDisposition: 'retreated_after_battle',
        deferPersistence: options.deferPersistence,
      });
    }

    if (action === 'retry_continue') {
      if (
        state.status !== 'RECOVERABLE_ERROR' ||
        !state.recoverableActions?.includes('retry_continue')
      ) {
        throw new DungeonFlowError(
          DungeonFlowErrorCode.INVALID_STATE,
          '当前副本状态无法重试推进',
          409,
        );
      }
      state.status = 'GENERATING_NEXT';
      state.statusReason = undefined;
      state.recoverableActions = undefined;
      return this.generateRoundAfterLooting(cultivatorId, state, options);
    }

    if (action === 'retry_settle') {
      if (
        state.status !== 'RECOVERABLE_ERROR' ||
        !state.recoverableActions?.includes('retry_settle')
      ) {
        throw new DungeonFlowError(
          DungeonFlowErrorCode.INVALID_STATE,
          '当前副本状态无法重试结算',
          409,
        );
      }
      state.status = 'SETTLING';
      state.statusReason = undefined;
      state.recoverableActions = undefined;
      delete state.activeBattleId;
      return this.settleDungeon(state, {
        pendingAction: state.pendingAction,
        deferPersistence: options.deferPersistence,
      });
    }

    if (action === 'retry') {
      const pending = state.pendingAction;
      if (!pending?.choiceId) {
        state.status = 'EXPLORING';
        state.statusReason = undefined;
        state.recoverableActions = undefined;
        state.pendingAction = undefined;
        state.costPreview = undefined;
        if (options.deferPersistence) {
          return {
            state,
            isFinished: false,
            ...this.buildStateHooks(cultivatorId, state),
          };
        }
        await this.saveState(cultivatorId, state);
        return { state, isFinished: false };
      }

      state.status = 'EXPLORING';
      state.statusReason = undefined;
      state.recoverableActions = undefined;
      state.pendingAction = undefined;
      state.costPreview = undefined;
      if (!options.deferPersistence) {
        await this.saveState(cultivatorId, state);
      }
      return this.handleActionUnlocked(
        cultivatorId,
        pending.choiceId,
        pending.actionId,
        options,
      );
    }

    throw new Error('未知的副本恢复动作');
  }

  async quitDungeon(cultivatorId: string, options: DungeonFlowOptions = {}) {
    const key = getDungeonKey(cultivatorId);

    const state = await this.getState(cultivatorId);
    if (state) {
      state.status = 'FINISHED';
      state.isFinished = true;
      state.pendingAction = undefined;
      state.costPreview = undefined;
      state.recoverableActions = undefined;
      state.activeBattleId = undefined;
      const persist = async (tx: DbTransaction) => {
        await tx.insert(dungeonHistories).values({
          cultivatorId: state.cultivatorId,
          theme: state.theme,
          result: {
            settlement: {
              reward_tier: '放弃',
              ending_narrative: '道友中途放弃了探索。',
            },
          },
          log:
            state.history
              .map(
                (h) => `[Round ${h.round}] ${h.scene} -> Choice: ${h.choice}`,
              )
              .join('\n') + '\n[ABANDONED]',
        });
        if (state.runId) {
          await tx
            .update(dungeonRuns)
            .set({
              status: 'FINISHED',
              runState: this.normalizeState(state),
              pendingAction: null,
              activeBattleId: null,
              battlePayload: null,
              endedAt: new Date(),
            })
            .where(eq(dungeonRuns.id, state.runId));
        }
      };

      if (options.deferPersistence) {
        return {
          success: true,
          persist,
          afterCommit: async () => {
            await redis.del(key);
          },
        };
      }

      await getExecutor().transaction(persist);
    }

    await redis.del(key);
    return { success: true };
  }
}

export const dungeonService = new DungeonService();
