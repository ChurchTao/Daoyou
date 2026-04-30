/**
 * BattleRecord
 *
 * v5 原生战斗记录 DTO。所有面向业务层/展示层/持久化层的战斗结果都使用该结构。
 * 特点：
 *   - 直接透传 battle-v5 的 stateTimeline + logSpans，不再做降级兼容。
 *   - 胜负方以 Cultivator 全量对象给出，便于上层取名/排行榜评分等。
 *   - 新增的派生指标（maxHp / 剩余资源）由 v5 原生的 winnerSnapshot/loserSnapshot 提供。
 */

import type { LogSpan } from '@/engine/battle-v5/systems/log/types';
import type {
  BattleStateTimeline,
  UnitStateSnapshot,
} from '@/engine/battle-v5/systems/state/types';
import type { Cultivator } from '@/types/cultivator';

/**
 * 初始进入战场的状态覆盖
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
  /** 战斗的文本日志数组（兼容现有简易列表） */
  logs: string[];
  /** 战斗回合数 */
  turns: number;
  /** 玩家方 Cultivator ID（与 Unit.id / winner.id / loser.id 一致） */
  player: string;
  /** 对手方 Cultivator ID */
  opponent: string;
  /**
   * 结构化日志片段。富交互 UI 应基于 spans 渲染。
   */
  logSpans: LogSpan[];
  /**
   * v5 状态时间线（帧 + delta + unit 映射）。UI/回放都基于此构建。
   */
  stateTimeline: BattleStateTimeline;
  /** 胜者终态快照 */
  winnerSnapshot: UnitStateSnapshot;
  /** 败者终态快照 */
  loserSnapshot?: UnitStateSnapshot;
}

/**
 * UI 视图态战斗结果（兼容层已移除，目前与 BattleRecord 一致）。
 */
export type BattleViewRecord = BattleRecord;

export type BattleRecordType = 'challenge' | 'challenged' | 'normal';

export interface BattleRecordV2Summary {
  id: string;
  createdAt: Date | null;
  battleType: BattleRecordType;
  opponentCultivatorId: string | null;
  winner: Cultivator;
  loser: Cultivator;
  turns: number;
}

export interface BattleRecordV2Detail {
  id: string;
  createdAt: Date | null;
  battleResult: BattleRecord;
  battleReport?: string | null;
}

/**
 * 将 BattleRecord 封装为 UI 视图态。
 */
export function toViewRecord(record: BattleRecord): BattleViewRecord {
  return record;
}

