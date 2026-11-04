import type { MysteryPlayerView } from './mystery.js';
import type { DungeonSettlement } from './state.js';

/** 结案时的玩家可见快照，不保存完整案卷或尚未揭晓的真相。 */
export type DungeonHistoryMystery = Pick<
  MysteryPlayerView,
  'title' | 'templateName' | 'turn' | 'clues' | 'log' | 'result'
>;

export type DungeonHistoryResult = DungeonSettlement & {
  runId?: string;
  mystery?: DungeonHistoryMystery;
};
