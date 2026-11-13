import { getStoryBattle } from '@daoyou/game-content/story/battles';
import { getStoryChapter } from '@daoyou/game-content/story/catalog';
import { emptyStoryFacts } from '@daoyou/game-domain/story';
import {
  storyGateOpen,
  storySceneOpen,
} from '@daoyou/game-domain/story/gates';
import { describe, expect, it } from 'vitest';

import { storyBattleOutcome } from './battle-host.js';
import { openingStoryProgress } from './progress.js';
import {
  acknowledgeBattle,
  acknowledgePerformance,
  presentStory,
} from './resolve.js';

describe('剧情战', () => {
  const creek = getStoryChapter('v1-creek');
  const facts = emptyStoryFacts();
  const atFight = () => {
    let progress = openingStoryProgress('v1-creek');
    progress = acknowledgePerformance(creek, progress, facts, 'v1-wake', 'done')
      .progress;
    return acknowledgePerformance(creek, progress, facts, 'v1-ambush', 'done')
      .progress;
  };

  it('演出之后停在剧情战上，打完才往下走，结果记成标记', () => {
    const waiting = atFight();
    expect(presentStory(creek, waiting, facts).battleId).toBe('v1-ambush');
    const done = acknowledgeBattle(creek, waiting, facts, 'v1-ambush', 'lost');
    expect(done.progress.beatId).toBe('cubs');
    expect(presentStory(creek, done.progress, facts).flags).toContain(
      'battle.v1-ambush.lost',
    );
  });

  it('不是眼下这一场就不认，重复记也不会多走', () => {
    const waiting = atFight();
    expect(() =>
      acknowledgeBattle(creek, waiting, facts, 'no-such', 'won'),
    ).toThrow('当前没有这场剧情战');
    const once = acknowledgeBattle(creek, waiting, facts, 'v1-ambush', 'won');
    const twice = acknowledgeBattle(
      creek,
      once.progress,
      facts,
      'v1-ambush',
      'lost',
    );
    expect(twice.progress.beatId).toBe('cubs');
    expect(presentStory(creek, twice.progress, facts).flags).not.toContain(
      'battle.v1-ambush.lost',
    );
  });

  it('这一幕演完时把赠礼发出去，只发一次', () => {
    const fought = acknowledgeBattle(creek, atFight(), facts, 'v1-ambush', 'won');
    const watched = acknowledgePerformance(
      creek,
      fought.progress,
      facts,
      'v1-cubs',
      'done',
    );
    expect(watched.grants).toEqual(['starter-beast']);
    expect(
      acknowledgePerformance(creek, watched.progress, facts, 'v1-cubs', 'done')
        .grants,
    ).toEqual([]);
  });

  it('赢了算赢，打满回合有人收场，其余算输', () => {
    const battle = getStoryBattle('v1-ambush');
    const at = (finished: boolean, round: number, outcome?: string) =>
      storyBattleOutcome(battle, { finished, round, outcome });
    expect(at(true, 2, 'victory')).toBe('won');
    expect(at(true, 2, 'defeat')).toBe('lost');
    expect(at(true, 2, 'aborted')).toBe('lost');
    expect(at(false, battle.rescueAfter!)).toBeNull();
    expect(at(false, battle.rescueAfter! + 1)).toBe('rescued');
  });
});

describe('入口总表', () => {
  it('不设限时都开；设限时只开主线打开过的门，表里没有的场景一直开着', () => {
    expect(storySceneOpen(null, 'dungeon')).toBe(true);
    expect(storySceneOpen(['map'], 'dungeon')).toBe(false);
    expect(storySceneOpen(['dungeon'], 'dungeon')).toBe(true);
    expect(storySceneOpen(['map'], 'wild')).toBe(true);
    expect(storySceneOpen([], 'cave')).toBe(true);
    expect(storySceneOpen([], 'inventory')).toBe(true);
    expect(storyGateOpen([], 'yield')).toBe(false);
  });
});
