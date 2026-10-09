import {
  INQUIRY_FALLBACKS,
  getInquiryPlay,
  inquiryPlayForNode,
  listInquiryPlays,
} from '@daoyou/game-content/inquiry';
import type { InquiryPlay, InquiryProgress } from '@daoyou/game-domain/inquiry';
import { describe, expect, it } from 'vitest';
import { assertInquiryPlay, compileInquiryCase } from './compile.js';
import { assertInquiryCostType, quoteInquiryCost } from './costs.js';
import {
  acceptInquiryNarration,
  applyInquiryAction,
  createInquiryProgress,
  finishInquiryBattle,
  inquiryActions,
  inquiryNarrativeFacts,
  inquiryToolActionId,
  inquiryVerdictReady,
  judgeInquiryVerdict,
} from './progress.js';

function solve(play: InquiryPlay) {
  assertInquiryPlay(play);
  const compiled = compileInquiryCase(play, INQUIRY_FALLBACKS[play.id]);
  if (!compiled.ok) throw new Error(`${play.id}: ${compiled.reason}`);
  const truth = play.truths.find((item) => item.id === compiled.caseFile.truthId);
  if (!truth) throw new Error(`${play.id} 备用真相不存在`);
  let progress = createInquiryProgress(play);
  for (let step = 0; step < 40 && !inquiryVerdictReady(play, progress); step += 1) {
    const actions = inquiryActions(progress, play, compiled.caseFile);
    const next =
      actions.find((action) => action.id.startsWith('examine:') && !action.repeat) ??
      actions.find((action) => action.id.startsWith('compare:')) ??
      actions.find((action) => action.cost && !action.cost.revealsClue) ??
      actions.find(
        (action) =>
          action.id.startsWith('move:') &&
          !progress.visitedLocationIds.includes(action.id.slice('move:'.length)),
      ) ??
      actions.find(
        (action) =>
          action.id.startsWith('open:') && truth.containerJudgement === 'open',
      );
    if (!next) break;
    const result = applyInquiryAction(progress, play, compiled.caseFile, next.id);
    if (result.effect.kind === 'rejected') break;
    progress = result.progress;
    if (result.effect.kind === 'battle') {
      progress = finishInquiryBattle(progress, 'victory', next.id.slice('open:'.length));
    }
  }
  return {
    progress,
    caseFile: compiled.caseFile,
    judgement: judgeInquiryVerdict(progress, play, compiled.caseFile, {
      answerId: truth.answerId,
      container: truth.containerJudgement,
    }),
  };
}

describe('inquiry plays', () => {
  it('binds three map nodes to three plays and solves each from its fallback', () => {
    expect(listInquiryPlays().map((play) => play.id)).toEqual([
      'cave_inheritance',
      'forbidden_trial',
      'scripture_cellar',
    ]);
    expect(inquiryPlayForNode('SAT_TN_01')?.id).toBe('cave_inheritance');
    expect(inquiryPlayForNode('SAT_TN_04')?.id).toBe('forbidden_trial');
    expect(inquiryPlayForNode('SAT_TN_07')?.id).toBe('scripture_cellar');
    expect(inquiryPlayForNode('SAT_TN_02')).toBeNull();

    for (const play of listInquiryPlays()) {
      const solved = solve(play);
      expect(solved.judgement, play.id).toEqual({ correct: true, rating: 'A' });
      expect(solved.progress.foughtContainer, play.id).toBe(false);
      expect(solved.progress.paidLifespan, play.id).toBe(false);
    }
  });

  it('hides costs until the obstacle has been seen, and keeps that text stable', () => {
    const play = getInquiryPlay('cave_inheritance');
    if (!play) throw new Error('缺少洞府玩法');
    const compiled = compileInquiryCase(play, INQUIRY_FALLBACKS[play.id]);
    if (!compiled.ok) throw new Error(compiled.reason);
    const start = inquiryActions(createInquiryProgress(play), play, compiled.caseFile).map(
      (action) => action.id,
    );
    expect(start).toEqual(['examine:seal_marks', 'examine:stone_seam']);
    const looked = applyInquiryAction(
      createInquiryProgress(play),
      play,
      compiled.caseFile,
      'examine:stone_seam',
    );
    const unlocked = inquiryActions(looked.progress, play, compiled.caseFile).map(
      (action) => action.id,
    );
    expect(unlocked).toContain('cost:stone_seam:steady');
    expect(unlocked).not.toContain('open:casket');
    const again = applyInquiryAction(
      looked.progress,
      play,
      compiled.caseFile,
      'examine:stone_seam',
    );
    expect(again.effect.narrationKey).toBe('blocked:stone_seam');
    expect(again.progress.knownClueIds).toEqual(looked.progress.knownClueIds);
  });

  it('rejects a cost outside the five inquiry types and quotes a configured cost', () => {
    expect(assertInquiryCostType('hp_loss')).toBe('hp_loss');
    expect(() => assertInquiryCostType('cultivation_exp')).toThrow('秘境探查不接受代价');
    const play = getInquiryPlay('forbidden_trial');
    const cost = play?.objects.find((object) => object.blocked)?.blocked?.costs[0];
    if (!cost) throw new Error('缺少代价');
    expect(quoteInquiryCost(cost, '筑基', 'normal')).toEqual({
      type: 'spirit_stones',
      value: 250,
    });
  });

  it('rejects a draft that names the other answer or spoils the first glance', () => {
    const play = getInquiryPlay('scripture_cellar');
    if (!play) throw new Error('缺少地窖玩法');
    const fallback = INQUIRY_FALLBACKS[play.id]!;
    const broken = compileInquiryCase(play, {
      ...fallback,
      clues: {
        ...fallback.clues,
        scroll_b_text: { ...fallback.clues.scroll_b_text, assertsAnswer: 'scroll_b' },
      },
    });
    expect(broken.ok).toBe(false);
    const spoiled = compileInquiryCase(play, {
      ...fallback,
      locations: { ...fallback.locations, stair: '你刚到梯口，就看见真卷放在甲卷上。' },
    });
    expect(spoiled).toEqual({ ok: false, reason: '第一眼正文提前说出了答案' });
  });

  it('does not grant a second visit reward for returning to a room', () => {
    const play = getInquiryPlay('cave_inheritance');
    if (!play) throw new Error('缺少洞府玩法');
    const compiled = compileInquiryCase(play, INQUIRY_FALLBACKS[play.id]);
    if (!compiled.ok) throw new Error(compiled.reason);
    let progress: InquiryProgress = createInquiryProgress(play);
    progress = applyInquiryAction(progress, play, compiled.caseFile, 'examine:seal_marks').progress;
    const entered = applyInquiryAction(progress, play, compiled.caseFile, 'move:hall');
    const back = applyInquiryAction(entered.progress, play, compiled.caseFile, 'move:mouth');
    expect(entered.rewardKey).toBe('inquiry:visit:hall');
    expect(back.rewardKey).toBeUndefined();
    expect(back.effect).toEqual({ kind: 'note', narrationKey: 'move:mouth' });
  });

  it('gives the narrator only the facts this action revealed', () => {
    const play = getInquiryPlay('cave_inheritance');
    if (!play) throw new Error('缺少洞府玩法');
    const compiled = compileInquiryCase(play, INQUIRY_FALLBACKS[play.id]);
    if (!compiled.ok) throw new Error(compiled.reason);
    const looked = applyInquiryAction(
      createInquiryProgress(play),
      play,
      compiled.caseFile,
      'examine:seal_marks',
    );
    const facts = inquiryNarrativeFacts(
      play,
      compiled.caseFile,
      looked.progress,
      'examine:seal_marks',
    );
    expect(facts.lines.join('\n')).toContain('外补的禁制');
    expect(facts.lines.join('\n')).not.toContain('齿间');
    expect(facts.lines.join('\n')).not.toContain(compiled.caseFile.truthText);
    expect(acceptInquiryNarration(play, '并未看见任何人，未进行交互。', facts.lines)).toBe(
      false,
    );
    expect(
      acceptInquiryNarration(
        play,
        '刻痕从洞外压进来，不像洞主自己封上的。',
        facts.lines,
      ),
    ).toBe(true);
    expect(inquiryToolActionId('inspect', { targetId: 'seal_marks' })).toBe(
      'examine:seal_marks',
    );
    expect(inquiryToolActionId('pay', { objectId: 'stone_seam', costId: 'steady' })).toBe(
      'cost:stone_seam:steady',
    );
    expect(inquiryToolActionId('inspect', {})).toBeNull();
  });
});
