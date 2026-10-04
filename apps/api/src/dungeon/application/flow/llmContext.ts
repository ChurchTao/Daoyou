import { truncateText } from '@server/utils/llmPayload.js';
import type { ResolvedDungeonMapConfig } from '@daoyou/game-domain/world/map';
import type {
  DungeonRoundLlmContext,
  DungeonState,
  History,
  RewardBlueprint,
} from '@server/dungeon/application/flow/types.js';

const HISTORY_LIMIT = 4;
const SCENE_SUMMARY_MAX_CHARS = 140;
const OUTCOME_SUMMARY_MAX_CHARS = 90;
const MAP_DESCRIPTION_MAX_CHARS = 100;

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

function buildBattleAftermath(history: History[]): string | undefined {
  const outcome = history[history.length - 1]?.outcome;
  if (!outcome) return undefined;

  if (!/苦战|击败|不敌|遁走/u.test(outcome)) {
    return undefined;
  }

  return truncateText(outcome, 60);
}

function summarizePendingChoice(
  state: DungeonState,
): DungeonRoundLlmContext['pendingChoice'] {
  const action = state.pendingAction;
  if (!action) return undefined;

  return {
    text: truncateText(action.choiceText ?? '已作出选择', 36),
    costs: action.costs.map((cost) => ({
      type: cost.type,
      value: cost.value,
      ...(cost.required_quality
        ? { requiredQuality: cost.required_quality }
        : {}),
      ...(cost.required_type ? { requiredType: cost.required_type } : {}),
    })),
  };
}

export function buildDungeonRoundLlmContext(args: {
  state: DungeonState;
  mapConfig: ResolvedDungeonMapConfig;
  realmGap: number;
  phase: string;
}): DungeonRoundLlmContext {
  const { state, mapConfig, realmGap, phase } = args;
  const battleAftermath = buildBattleAftermath(state.history);
  const pendingChoice = summarizePendingChoice(state);

  return {
    progress: {
      round: state.currentRound,
      totalRounds: state.maxRounds,
      phase,
      dangerScore: state.dangerScore,
    },
    setting: {
      name: state.location.location,
      realmRequirement: mapConfig.realmRequirement,
      difficulty: mapConfig.difficultyLabel,
      realmGap,
      allowedEnemyRealmStages: mapConfig.allowedEnemyRealmStages,
      tags: state.location.location_tags.slice(0, 4),
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
      traits: uniqueStrings([truncateText(state.playerInfo.personality, 14)]),
      combatStyle: buildCombatStyleSummary(state),
    },
    recentHistory: state.history
      .slice(-HISTORY_LIMIT)
      .map(summarizeHistoryEntry),
    ...(pendingChoice ? { pendingChoice } : {}),
    ...(battleAftermath ? { battleAftermath } : {}),
    securedRewardNames: summarizeRewardNames(state.accumulatedRewards),
  };
}
