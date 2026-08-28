import { describe, expect, it } from 'vitest';
import {
  parseDungeonHistoryLog,
  serializeDungeonHistoryLog,
} from './historyLog';

describe('dungeon history log', () => {
  it('serializes and parses choices with their actual costs', () => {
    const log = serializeDungeonHistoryLog([
      {
        round: 1,
        scene: '你抵达残阵入口。',
        choice: '布置阵旗后稳步进入。',
        actual_costs: ['灵石-15'],
      },
      {
        round: 2,
        scene: '妖兽拦住去路。',
        choice: '正面迎战。',
      },
    ]);

    expect(parseDungeonHistoryLog(log)).toEqual([
      {
        round: 1,
        scene: '你抵达残阵入口。',
        choice: '布置阵旗后稳步进入。',
        actualCosts: ['灵石-15'],
      },
      {
        round: 2,
        scene: '妖兽拦住去路。',
        choice: '正面迎战。',
        actualCosts: [],
      },
    ]);
  });

  it('continues to parse legacy records without cost data', () => {
    expect(
      parseDungeonHistoryLog(
        '[Round 3] 石门缓缓开启。 -> Choice: 进入石门。\n[ABANDONED]',
      ),
    ).toEqual([
      {
        round: 3,
        scene: '石门缓缓开启。',
        choice: '进入石门。',
        actualCosts: [],
      },
    ]);
  });
});
