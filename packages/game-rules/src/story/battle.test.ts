import { getPerformanceScript } from '@daoyou/game-content/performance/catalog';
import { getStoryBattle } from '@daoyou/game-content/story/battles';
import { getStoryChapter } from '@daoyou/game-content/story/catalog';
import { emptyStoryFacts } from '@daoyou/game-domain/story';
import { storyGateOpen, storySceneOpen } from '@daoyou/game-domain/story/gates';
import { describe, expect, it } from 'vitest';

import { storyBattleOutcome } from './battle-host.js';
import { openingStoryProgress } from './progress.js';
import {
  acknowledgeBattle,
  acknowledgePerformance,
  presentStory,
} from './resolve.js';

describe('剧情战', () => {
  const creek = getStoryChapter('mountain-bend');
  const facts = emptyStoryFacts();
  const atFight = () => {
    let progress = openingStoryProgress('mountain-bend');
    progress = acknowledgePerformance(
      creek,
      progress,
      facts,
      'mountain-summit',
      'done',
    ).progress;
    return acknowledgePerformance(
      creek,
      progress,
      facts,
      'mountain-basket',
      'done',
    ).progress;
  };

  it('演出之后停在剧情战上，打完才往下走，结果记成标记', () => {
    const waiting = atFight();
    expect(presentStory(creek, waiting, facts).battleId).toBe('v1-ambush');
    const done = acknowledgeBattle(creek, waiting, facts, 'v1-ambush', 'lost');
    expect(done.progress.beatId).toBe('white-paw');
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
    expect(twice.progress.beatId).toBe('white-paw');
    expect(presentStory(creek, twice.progress, facts).flags).not.toContain(
      'battle.v1-ambush.lost',
    );
  });

  it('这一幕演完时把赠礼发出去，只发一次', () => {
    const fought = acknowledgeBattle(
      creek,
      atFight(),
      facts,
      'v1-ambush',
      'won',
    );
    const found = acknowledgePerformance(
      creek,
      fought.progress,
      facts,
      'mountain-white-paw',
      'done',
    );
    expect(found.grants).toEqual([]);
    const watched = acknowledgePerformance(
      creek,
      found.progress,
      facts,
      'mountain-companion',
      'done',
    );
    expect(watched.grants).toEqual(['starter-beast']);
    expect(
      acknowledgePerformance(
        creek,
        watched.progress,
        facts,
        'mountain-companion',
        'done',
      ).grants,
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

describe('石滩首战', () => {
  const chapter = getStoryChapter('mine-shift');
  const crossing = getStoryChapter('mine-crossing');
  const facts = emptyStoryFacts();

  it.each(['won', 'rescued', 'lost'] as const)(
    '按 %s 接第二章，赠礼在开打前结算一次',
    (outcome) => {
      const work = acknowledgePerformance(
        chapter,
        openingStoryProgress(chapter.id),
        facts,
        'mine-shift-work',
        'done',
      );
      expect(work.grants).toEqual(['starter-beast']);
      const bridge = acknowledgePerformance(
        chapter,
        work.progress,
        facts,
        'mine-shift-bridge',
        'done',
      );
      expect(bridge.grants).toEqual([]);
      expect(presentStory(chapter, bridge.progress, facts).battleId).toBe(
        'mine-ambush',
      );
      const fought = acknowledgeBattle(
        chapter,
        bridge.progress,
        facts,
        'mine-ambush',
        outcome,
      );
      expect(fought.finished).toBe(true);
      const mark = 'battle.mine-ambush.' + outcome;
      const flags = presentStory(chapter, fought.progress, facts).flags;
      expect(flags).toEqual([mark]);

      const next = presentStory(
        crossing,
        openingStoryProgress(crossing.id),
        facts,
        flags,
      );
      expect(next).toMatchObject({
        scriptId: 'mine-crossing-shoal',
        flags: [mark],
      });
      const cues = getPerformanceScript(next.scriptId!).cues;
      expect(
        cues.some(
          (cue) =>
            'when' in cue &&
            cue.when &&
            'flag' in cue.when &&
            cue.when.flag === mark,
        ),
      ).toBe(true);
    },
  );
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
