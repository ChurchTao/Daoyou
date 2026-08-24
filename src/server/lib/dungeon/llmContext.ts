import { truncateText } from '@server/utils/llmPayload';
import type { ResolvedDungeonMapConfig } from '@shared/lib/game/mapSystem';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type {
  DungeonOptionCost,
  DungeonRoundLlmContext,
  DungeonSettlementLlmContext,
  DungeonState,
  History,
  RewardBlueprint,
} from './types';

const HISTORY_LIMIT = 3;
const JOURNEY_LIMIT = 5;
const SCENE_SUMMARY_MAX_CHARS = 80;
const OUTCOME_SUMMARY_MAX_CHARS = 60;
const MAP_DESCRIPTION_MAX_CHARS = 80;
const FALLBACK_TEXT = '未见分明痕迹';
const DUNGEON_REWARD_BLUEPRINT_LIMIT = 5;

function toResourcePercent(current: number, max: number | undefined): number {
  const safeMax = Number.isFinite(max) ? Math.max(1, max ?? 1) : 1;
  const safeCurrent = Number.isFinite(current) ? current : 0;
  return Math.round(Math.max(0, Math.min(1, safeCurrent / safeMax)) * 100);
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function stripParenthetical(text: string): string {
  return text.replace(/（.*?）|\(.*?\)/g, '').trim();
}

function summarizeRoots(roots: string[]): string[] {
  return uniqueStrings(roots.map((root) => truncateText(root, 16))).slice(0, 4);
}

function summarizeFates(fates: string[]): string[] {
  return uniqueStrings(
    fates.map((fate) => truncateText(stripParenthetical(fate), 14)),
  ).slice(0, 4);
}

function summarizeTechniques(skills: string[]): string[] {
  return uniqueStrings(skills.map((skill) => truncateText(skill, 16))).slice(
    0,
    4,
  );
}

function summarizeHistoryEntry(entry: History) {
  return {
    round: entry.round,
    sceneSummary: truncateText(entry.scene, SCENE_SUMMARY_MAX_CHARS),
    ...(entry.choice ? { choice: truncateText(entry.choice, 30) } : {}),
    ...(entry.outcome
      ? {
          outcomeSummary: truncateText(
            entry.outcome,
            OUTCOME_SUMMARY_MAX_CHARS,
          ),
        }
      : {}),
    ...(entry.gained_items?.length
      ? {
          gainedItemNames: entry.gained_items
            .slice(0, 4)
            .map((item) => truncateText(item, 16)),
        }
      : {}),
  };
}

function summarizeJourney(history: History[]): string[] {
  return history.slice(-JOURNEY_LIMIT).map((entry) => {
    const scene = truncateText(entry.scene, 36) || FALLBACK_TEXT;
    const choice = entry.choice
      ? `选${truncateText(entry.choice, 18)}`
      : '未留抉择';
    const outcome = entry.outcome
      ? `结果${truncateText(entry.outcome, 24)}`
      : '结果未明';
    return `第${entry.round}轮：${scene}；${choice}；${outcome}`;
  });
}

function summarizeRewards(
  rewards: RewardBlueprint[],
): DungeonSettlementLlmContext['accumulatedRewards'] {
  return rewards.map((reward) => ({
    ...(reward.name ? { name: truncateText(reward.name, 18) } : {}),
    ...(reward.description
      ? { description: truncateText(reward.description, 48) }
      : {}),
    ...(reward.material_type ? { material_type: reward.material_type } : {}),
    ...(reward.element ? { element: reward.element } : {}),
    ...(typeof reward.reward_score === 'number'
      ? { reward_score: reward.reward_score }
      : {}),
  }));
}

function buildLastAction(
  state: DungeonState,
): DungeonRoundLlmContext['lastAction'] {
  const lastHistory = [...state.history]
    .reverse()
    .find((entry) => Boolean(entry.choice));
  const pendingExploration = state.pendingAction?.exploration;
  const committedExploration = lastHistory
    ? [...(state.exploredExplorationLeads ?? [])]
        .reverse()
        .find((entry) => entry.completedRound === lastHistory.round)
    : undefined;
  const exploration = pendingExploration ?? committedExploration;
  const choice = state.pendingAction?.choiceText ?? lastHistory?.choice;
  if (!exploration || !choice) return undefined;

  return {
    target: truncateText(exploration.target, 30),
    choice: truncateText(choice, 120),
    sourceRound: exploration.completedRound,
  };
}

function isSystemFinishAction(target: string, choice: string): boolean {
  return (
    target === '秘境出口' ||
    choice.startsWith('收束此行') ||
    choice.includes('确认后进入结算')
  );
}

function buildSettlementFinalAction(
  state: DungeonState,
): DungeonSettlementLlmContext['finalAction'] {
  const pendingExploration = state.pendingAction?.exploration;
  const pendingChoice = state.pendingAction?.choiceText;
  if (
    pendingExploration &&
    pendingChoice &&
    !isSystemFinishAction(pendingExploration.target, pendingChoice)
  ) {
    return {
      target: truncateText(pendingExploration.target, 30),
      choice: truncateText(pendingChoice, 120),
      sourceRound: pendingExploration.completedRound,
    };
  }

  for (const history of [...state.history].reverse()) {
    if (!history.choice) continue;
    const exploration = [...(state.exploredExplorationLeads ?? [])]
      .reverse()
      .find((entry) => entry.completedRound === history.round);
    if (
      !exploration ||
      isSystemFinishAction(exploration.target, history.choice)
    ) {
      continue;
    }
    return {
      target: truncateText(exploration.target, 30),
      choice: truncateText(history.choice, 120),
      sourceRound: exploration.completedRound,
    };
  }

  return undefined;
}

function summarizeRewardNames(rewards: RewardBlueprint[]): string[] {
  return rewards
    .map((reward) => {
      if (!reward.name) return '';
      if (!reward.material_type) return truncateText(reward.name, 18);
      return `${truncateText(reward.name, 18)}[${reward.material_type}]`;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function buildCombatStyleSummary(state: DungeonState): string {
  const root = stripParenthetical(state.playerInfo.spiritual_roots[0] ?? '');
  const technique = state.playerInfo.skills[0] ?? '无明显法门';
  const fate = stripParenthetical(state.playerInfo.fates[0] ?? '');
  const parts = uniqueStrings([
    root ? `${truncateText(root, 8)}灵根` : undefined,
    technique ? `主修${truncateText(technique, 10)}` : undefined,
    fate ? `命数偏${truncateText(fate, 8)}` : undefined,
  ]);

  return parts.join('，') || '路数未明';
}

function buildSacrificeSummary(
  costs: DungeonOptionCost[] | undefined,
): DungeonSettlementLlmContext['sacrificeSummary'] {
  if (!costs?.length) return [];

  const grouped = new Map<
    string,
    {
      type: DungeonOptionCost['type'];
      count: number;
      totalValue: number;
      sample?: string;
    }
  >();

  for (const cost of costs) {
    const key = `${cost.type}:${cost.required_type ?? ''}:${cost.required_quality ?? ''}`;
    const current = grouped.get(key) ?? {
      type: cost.type,
      count: 0,
      totalValue: 0,
    };
    current.count += 1;
    current.totalValue +=
      typeof cost.value === 'number' && Number.isFinite(cost.value)
        ? cost.value
        : 0;

    if (!current.sample) {
      if (cost.type === 'material') {
        current.sample = [cost.required_quality, cost.required_type]
          .filter(Boolean)
          .join(' ');
      } else if (cost.desc) {
        current.sample = truncateText(cost.desc, 20);
      }
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((entry) => ({
    type: entry.type,
    count: entry.count,
    totalValue: Number(entry.totalValue.toFixed(4)),
    ...(entry.sample ? { sample: entry.sample } : {}),
  }));
}

function buildBattleAftermath(history: History[]): string | undefined {
  const outcome = history[history.length - 1]?.outcome;
  if (!outcome) return undefined;

  if (!/苦战|击败|不敌|遁走/u.test(outcome)) {
    return undefined;
  }

  return truncateText(outcome, 60);
}

export function buildDungeonRoundLlmContext(args: {
  state: DungeonState;
  mapConfig: ResolvedDungeonMapConfig;
  realmGap: number;
  phase: string;
  currentResources?: CultivatorCondition['resources'];
}): DungeonRoundLlmContext {
  const { state, mapConfig, realmGap, phase, currentResources } = args;
  const battleAftermath = buildBattleAftermath(state.history);
  const lastAction = buildLastAction(state);
  const branchFlow = state.branchFlow;
  const stage = branchFlow?.stage ?? 'explore';

  return {
    round: state.currentRound,
    maxRounds: state.maxRounds,
    phase,
    realmGap,
    dangerScore: state.dangerScore,
    map: {
      name: state.location.location,
      realmRequirement: mapConfig.realmRequirement,
      difficultyTier: mapConfig.difficultyTier,
      difficultyLabel: mapConfig.difficultyLabel,
      enemyDifficulty: mapConfig.enemyDifficulty,
      allowedEnemyRealmStages: mapConfig.allowedEnemyRealmStages,
      tags: state.location.location_tags.slice(0, 6),
      descriptionSummary: truncateText(
        state.location.location_description,
        MAP_DESCRIPTION_MAX_CHARS,
      ),
    },
    player: {
      name: state.playerInfo.name,
      realm: state.playerInfo.realm,
      age: state.playerInfo.age,
      lifespan: state.playerInfo.lifespan,
      coreTraits: uniqueStrings([
        truncateText(state.playerInfo.personality, 14),
      ]),
      rootsSummary: summarizeRoots(state.playerInfo.spiritual_roots),
      fatesSummary: summarizeFates(state.playerInfo.fates),
      techniqueNames: summarizeTechniques(state.playerInfo.skills),
      combatStyleSummary: buildCombatStyleSummary(state),
      ...(currentResources
        ? {
            resources: {
              hpPercent: toResourcePercent(
                currentResources.hp.current,
                currentResources.hp.max,
              ),
              mpPercent: toResourcePercent(
                currentResources.mp.current,
                currentResources.mp.max,
              ),
            },
          }
        : {}),
    },
    history: state.history.slice(-HISTORY_LIMIT).map(summarizeHistoryEntry),
    ...(lastAction ? { lastAction } : {}),
    ...(battleAftermath ? { battleAftermath } : {}),
    defeatedEnemyNames: uniqueStrings(state.defeatedEnemyNames ?? []).map(
      (name) => truncateText(name, 18),
    ),
    accumulatedRewardNames: summarizeRewardNames(state.accumulatedRewards),
    flow: {
      stage,
      requiredOptionCount: 'up_to_three',
      eventIndex: state.currentRound,
      totalEvents: state.maxRounds,
      pendingBranchCount: (branchFlow?.pendingBranches ?? []).reduce(
        (count, checkpoint) => count + checkpoint.options.length,
        0,
      ),
      ...(branchFlow?.activeRootOption
        ? {
            activeRootTarget: truncateText(
              branchFlow.activeRootOption.exploration_target ??
                branchFlow.activeRootOption.text,
              30,
            ),
          }
        : {}),
    },
  };
}

export function buildDungeonSettlementLlmContext(args: {
  state: DungeonState;
  mapRealm: RealmType;
  endDisposition: DungeonSettlementLlmContext['endDisposition'];
}): DungeonSettlementLlmContext {
  const { state, mapRealm, endDisposition } = args;
  const finalAction = buildSettlementFinalAction(state);

  return {
    map: {
      name: state.location.location,
      realmRequirement: mapRealm,
    },
    player: {
      name: state.playerInfo.name,
      realm: state.playerInfo.realm,
    },
    ...(finalAction ? { finalAction } : {}),
    journeySummary: summarizeJourney(state.history),
    dangerScore: state.dangerScore,
    completedEventCount: state.history.filter(
      (entry) => Boolean(entry.choice && entry.outcome),
    ).length,
    unresolvedBranchCount: (state.branchFlow?.pendingBranches ?? []).reduce(
      (count, checkpoint) => count + checkpoint.options.length,
      0,
    ),
    sacrificeSummary: buildSacrificeSummary(state.summary_of_sacrifice),
    accumulatedRewards: summarizeRewards(state.accumulatedRewards),
    rewardBlueprintLimit: DUNGEON_REWARD_BLUEPRINT_LIMIT,
    accumulatedRewardCount: state.accumulatedRewards.length,
    remainingExtraRewardSlots: Math.max(
      0,
      DUNGEON_REWARD_BLUEPRINT_LIMIT - state.accumulatedRewards.length,
    ),
    endDisposition,
  };
}
