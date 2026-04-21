/**
 * BattleRecord
 *
 * v5 原生战斗记录 DTO。所有面向业务层/展示层/持久化层的战斗结果都使用该结构。
 * 特点：
 *   - 直接透传 battle-v5 的 stateTimeline + logSpans，不再做降级兼容。
 *   - 胜负方以 Cultivator 全量对象给出，便于上层取名/排行榜评分等。
 *   - 新增的派生指标（maxHp / 剩余资源）由 v5 原生的 winnerSnapshot/loserSnapshot 提供。
 *
 * 旧的 engine/battle/types 的 BattleEngineResult / TurnSnapshot 结构将在 Phase 4 UI 切换
 * 后全量删除。此模块同时提供一个 `toLegacyTimeline` helper 以便过渡期逐个替换 UI。
 */

import type { LogSpan } from '@/engine/battle-v5/systems/log/types';
import type {
  BattleStateFrame,
  BattleStateTimeline,
  BuffStateView,
  UnitStateSnapshot,
} from '@/engine/battle-v5/systems/state/types';
import type { Cultivator } from '@/types/cultivator';

/**
 * 初始进入战场的状态覆盖（新旧通用）
 */
export interface InitialUnitState {
  /** HP 损失百分比 (0-1) */
  hpLossPercent?: number;
  /** MP 损失百分比 (0-1) */
  mpLossPercent?: number;
  /** 是否为练功房模式 */
  isTraining?: boolean;
  /** 木桩最大血量覆盖（仅练功房有效） */
  opponentMaxHpOverride?: number;
}

/**
 * v5 原生战斗记录。
 */
export interface BattleRecord {
  winner: Cultivator;
  loser: Cultivator;
  /** 战斗的文本日志数组（兼容现有 AI 战报/UI 简易列表） */
  logs: string[];
  /** 战斗回合数 */
  turns: number;
  /** 玩家方 Cultivator ID（与 Unit.id / winner.id / loser.id 一致） */
  player: string;
  /** 对手方 Cultivator ID */
  opponent: string;
  /**
   * 结构化日志片段。AI 战报 prompt 与富交互 UI 应基于 spans 渲染。
   */
  logSpans: LogSpan[];
  /**
   * v5 状态时间线（帧 + delta + unit 映射）。UI/回放/AI 都应基于此构建。
   */
  stateTimeline: BattleStateTimeline;
  /** 胜者终态快照（v5 Unit.getSnapshot() 的原始输出） */
  winnerSnapshot: UnitStateSnapshot;
  /** 败者终态快照（可能不存在，例如双存活但被强制结算） */
  loserSnapshot?: UnitStateSnapshot;
}

/**
 * 将 stateTimeline 中 action_post 帧转为回合级状态序列。
 * 适用于暂时未切到原生时间线的旧 UI 过渡期。
 */
export interface TurnSnapshot {
  turn: number;
  player: {
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    buffs: string[];
  };
  opponent: {
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    buffs: string[];
  };
}

function projectUnit(
  snapshot: UnitStateSnapshot,
): TurnSnapshot['player'] {
  return {
    hp: snapshot.hp.current,
    maxHp: snapshot.hp.max,
    mp: snapshot.mp.current,
    maxMp: snapshot.mp.max,
    buffs: snapshot.buffs.map((buff: BuffStateView) => buff.name),
  };
}

/**
 * 将 BattleRecord 的时间线折算成 legacy TurnSnapshot[]。
 * 仅供 Phase 4 UI 切换过渡期使用。
 */
export function toLegacyTimeline(
  record: BattleRecord,
  playerId?: string,
  opponentId?: string,
): TurnSnapshot[] {
  const ids = record.stateTimeline?.unitIds ?? [];
  const pId = playerId ?? ids[0];
  const oId = opponentId ?? ids[1];
  if (!pId || !oId) return [];
  const frames: BattleStateFrame[] = record.stateTimeline?.frames ?? [];
  const byTurn = new Map<number, TurnSnapshot>();

  for (const frame of frames) {
    const player = frame.units[pId];
    const opponent = frame.units[oId];
    if (!player || !opponent) continue;

    byTurn.set(frame.turn, {
      turn: frame.turn,
      player: projectUnit(player),
      opponent: projectUnit(opponent),
    });
  }

  return [...byTurn.values()].sort((a, b) => a.turn - b.turn);
}

/**
 * UI 视图态战斗结果（只读视图）。
 *
 * 在 BattleRecord 原生字段之上，给 UI 展示层补上若干派生视图字段：
 *   - timeline: 从 stateTimeline 折算出的回合级快照（等价旧 TurnSnapshot[]）
 *   - playerHp / opponentHp: 终态血量
 *   - log: 等价 logs（保留旧 UI 兼容字段名）
 *
 * 持久化层仍写入 BattleRecord；`toViewRecord` 在读出时一次性补齐。
 */
export interface BattleViewRecord extends BattleRecord {
  /** 回合级快照时间线（由 stateTimeline 派生） */
  timeline: TurnSnapshot[];
  /** 玩家终态气血 */
  playerHp: number;
  /** 对手终态气血 */
  opponentHp: number;
  /** 兼容旧 UI：等价于 logs */
  log: string[];
}

function finalHp(
  record: BattleRecord,
  unitId: string | undefined,
): number {
  if (!unitId) return 0;
  const frames = record.stateTimeline?.frames ?? [];
  for (let i = frames.length - 1; i >= 0; i--) {
    const snap = frames[i].units[unitId];
    if (snap) return snap.hp.current;
  }
  return 0;
}

/**
 * 将 BattleRecord 封装为 UI 视图态。幂等。
 */
export function toViewRecord(record: BattleRecord): BattleViewRecord {
  const asView = record as BattleViewRecord;
  if (
    Array.isArray(asView.timeline) &&
    Array.isArray(asView.log) &&
    typeof asView.playerHp === 'number' &&
    typeof asView.opponentHp === 'number'
  ) {
    return asView;
  }

  const [playerUnitId, opponentUnitId] = record.stateTimeline?.unitIds ?? [];
  return {
    ...record,
    timeline: toLegacyTimeline(record, playerUnitId, opponentUnitId),
    playerHp: finalHp(record, playerUnitId),
    opponentHp: finalHp(record, opponentUnitId),
    log: record.logs ?? [],
  };
}
