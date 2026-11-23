import { getPerformanceScript } from '@daoyou/game-content/performance/catalog';
import {
  getStoryBattle,
  MINE_SPARRING_BATTLE,
  MINE_SPARRING_MOVES,
  mineSparringFlag,
} from '@daoyou/game-content/story/battles';
import { getStoryChapter } from '@daoyou/game-content/story/catalog';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import type { CombatV6SectId } from '@daoyou/game-domain/combat';
import { emptyStoryFacts } from '@daoyou/game-domain/story';
import { storyGateOpen, storySceneOpen } from '@daoyou/game-domain/story/gates';
import { describe, expect, it } from 'vitest';

import { createEmptySectCombatProgressV6, createFreshCombatV6MethodLevels } from '../sects/build-state.js';
import { createStoryBattleHost, storyBattleOutcome } from './battle-host.js';
import { mineSparringEffects } from './mine-sparring.js';
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

describe('木人试手', () => {
  const chapter = getStoryChapter('mine-sparring');
  const battle = getStoryBattle(MINE_SPARRING_BATTLE);
  const facts = emptyStoryFacts();
  const entering = () => acknowledgePerformance(
    chapter, openingStoryProgress(chapter.id), facts, 'mine-sparring-yard', 'done',
  ).progress;

  it.each(['won', 'lost'] as const)(
    '按 %s 收场并从白水镇差帖进入第七章',
    (outcome) => {
      const fought = acknowledgeBattle(
        chapter,
        entering(),
        facts,
        battle.id,
        outcome,
      );
      expect(presentStory(chapter, fought.progress, facts)).toMatchObject({
        scriptId: 'mine-sparring-verdict',
        flags: [`battle.mine-sparring.${outcome}`],
      });
      const watch = acknowledgePerformance(
        chapter,
        fought.progress,
        facts,
        'mine-sparring-verdict',
        'done',
      );
      const errand = acknowledgePerformance(
        chapter,
        watch.progress,
        facts,
        'mine-sparring-watch',
        'done',
      );
      expect(errand.finished).toBe(true);
      expect(chapter.next).toBe('mine-errand');
      const next = getStoryChapter(chapter.next!);
      expect(
        presentStory(next, openingStoryProgress(next.id), facts),
      ).toMatchObject({
        scriptId: 'mine-errand-ask',
      });
    },
  );

  it('只在落败后允许再试，清掉前一场效果并照实记新战果', () => {
    const lost = acknowledgeBattle(chapter, entering(), facts, battle.id, 'lost', [mineSparringFlag('triple')]);
    const replay = acknowledgePerformance(chapter, lost.progress, facts, 'mine-sparring-verdict', 'retry');
    expect(replay.progress.beatId).toBe('fight');
    expect(replay.progress.marks).toEqual([]);
    const won = acknowledgeBattle(chapter, replay.progress, facts, battle.id, 'won');
    expect(presentStory(chapter, won.progress, facts).flags).toEqual(['battle.mine-sparring.won']);
    expect(() => acknowledgePerformance(chapter, won.progress, facts, 'mine-sparring-verdict', 'retry'))
      .toThrow('只有这场试手落败后才能再试');
  });

  const starterMoves = {
    lingxiao: 'triple',
    wuxiang: 'pierce',
    tianyan: 'wood',
    youdu: 'siphon',
    jiujie: 'thunder',
    bailu: 'poxie',
    wanqiao: 'rift',
    xiaoyue: 'pounce',
  } as const;

  it.each(Object.keys(starterMoves) as CombatV6SectId[])('%s 两路的新人都能施放早课神通', (sectId) => {
    const move = starterMoves[sectId];
    for (const path of COMBAT_V6_SECT_DEFINITIONS[sectId].paths) {
      const host = createStoryBattleHost({
        cultivator: {
          id: 'student', name: '新弟子', realm: '炼气', realm_stage: '初期',
          attributes: { vitality: 10, strength: 10, spirit: 10, endurance: 10, speed: 10, willpower: 10 },
        },
        sect: createEmptySectCombatProgressV6(sectId, path.id, createFreshCombatV6MethodLevels(sectId)),
        equipment: {},
        manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
      }, battle, 9);
      const target = host.state.units.find((unit) => unit.side === 1)!.id;
      host.submit(host.playerId, { type: 'skill', skillId: MINE_SPARRING_MOVES[move], targets: [target] });
      host.resolveRound();
      expect(mineSparringEffects(host.runtimeSnapshot())).toContain(mineSparringFlag(move));
      if (sectId === 'tianyan') {
        host.submit(host.playerId, { type: 'skill', skillId: MINE_SPARRING_MOVES.fire, targets: [target] });
        host.resolveRound();
        expect(mineSparringEffects(host.runtimeSnapshot())).toContain(mineSparringFlag('wood-fire'));
      }
    }
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
