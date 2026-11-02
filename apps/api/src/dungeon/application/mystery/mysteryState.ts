import { getMysteryTemplate } from '@daoyou/game-content/dungeon/scenarios';
import type {
  MysteryCaseFile,
  MysteryRecord,
  MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';
import { projectMysteryView } from '@daoyou/game-rules/dungeon/mystery';
import type { DungeonState } from '../flow/types.js';

export function requireMysteryTemplate(id: string): MysteryScenarioTemplate {
  const template = getMysteryTemplate(id);
  if (!template) throw new Error(`剧本模板不存在：${id}`);
  return template;
}

export function isKeyClue(caseFile: MysteryCaseFile, clueId: string) {
  return caseFile.clues.some((c) => c.id === clueId && c.key);
}

/** 案卷含隐藏真相，下发前一律替换为玩家投影。 */
export function toClientDungeonState(state: DungeonState): DungeonState {
  if (!state.mystery) return state;
  const { mystery, ...rest } = state;
  return {
    ...rest,
    mysteryView: projectMysteryView(
      mystery,
      requireMysteryTemplate(mystery.templateId),
    ),
  };
}

function isDungeonState(value: unknown): value is DungeonState {
  return Boolean(value && typeof value === 'object' && 'mystery' in value);
}

/** 处理命令结果中可能携带完整状态的字段。 */
export function toClientDungeonResult<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  const result = { ...(value as Record<string, unknown>) };
  if (isDungeonState(result.state))
    result.state = toClientDungeonState(result.state);
  const callback = result.callbackData as Record<string, unknown> | undefined;
  if (callback && isDungeonState(callback.dungeonState)) {
    result.callbackData = {
      ...callback,
      dungeonState: toClientDungeonState(callback.dungeonState),
    };
  }
  return result as T;
}

function finaleOpponent(mystery: MysteryRecord) {
  const role = requireMysteryTemplate(mystery.templateId).finale?.role;
  return mystery.caseFile.npcs.find((n) => n.role === role)?.name ?? null;
}

/** 结局叙事的输入：只给已发生的事实与评分结论。 */
export function mysteryEndingContext(mystery: MysteryRecord) {
  return {
    mode: 'mystery',
    title: mystery.caseFile.title,
    truth: mystery.caseFile.truth,
    deduction: mystery.result
      ? {
          correct: mystery.result.correct,
          tier: mystery.result.tier,
          branches: mystery.result.branches,
          confrontation: mystery.result.confrontation ?? null,
          opponent: finaleOpponent(mystery),
        }
      : null,
    recentEvents: mystery.run.log
      .slice(-12)
      .map((entry) =>
        entry.speaker ? `${entry.speaker}：${entry.text}` : entry.text,
      ),
  };
}
