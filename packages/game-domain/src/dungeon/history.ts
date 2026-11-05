import type { MysteryPlayerView } from './mystery.js';
import type { DungeonSettlement } from './state.js';
import type { ExorcismGrade, ExorcismRunState } from './exorcism.js';

/** 结案时的玩家可见快照，不保存完整案卷或尚未揭晓的真相。 */
export type DungeonHistoryMystery = Pick<
  MysteryPlayerView,
  'title' | 'templateName' | 'turn' | 'clues' | 'log' | 'result'
>;

/** 除祟结束时的快照。grade 为 null 表示一场未胜。 */
export type DungeonHistoryExorcism = Pick<
  ExorcismRunState,
  'bossId' | 'wins' | 'countered' | 'endReason' | 'finalHpRatio'
> & { grade: ExorcismGrade | null };

export type DungeonHistoryResult = DungeonSettlement & {
  runId?: string;
  mystery?: DungeonHistoryMystery;
  exorcism?: DungeonHistoryExorcism;
};
