import { CAVE_FALLBACK_DRAFT } from '@daoyou/game-content/inquiry';
import type { InquiryDirectorDraft } from '@daoyou/game-domain/inquiry';
import { describe, expect, it } from 'vitest';
import { compileInquiryCase } from './compile.js';
import { assertInquiryCostType, quoteInquiryActionCost } from './costs.js';
import {
  applyInquiryAction,
  createInquiryProgress,
  finishInquiryBattle,
  judgeInquiryVerdict,
} from './progress.js';

function play(actionIds: string[], draft: InquiryDirectorDraft = CAVE_FALLBACK_DRAFT) {
  const compiled = compileInquiryCase(draft);
  if (!compiled.ok) throw new Error(compiled.reason);
  let progress = createInquiryProgress();
  const results = [];
  for (const actionId of actionIds) {
    const result = applyInquiryAction(progress, compiled.caseFile, actionId);
    progress = result.progress;
    results.push(result);
  }
  return { progress, results, caseFile: compiled.caseFile };
}

function altarDraft(): InquiryDirectorDraft {
  return {
    ...CAVE_FALLBACK_DRAFT,
    truthId: 'altar_cache',
    truthText: '正本就是祭坛上的玉简，打开敛骨匣才会解开压在玉简上的封印。齿间温玉是诱饵。',
    clues: {
      ...CAVE_FALLBACK_DRAFT.clues,
      corpse_cache: {
        title: '齿间诱饵',
        body: '齿间的温玉只是一枚诱饵，里面没有功法。',
        assertsCache: null,
      },
      altar_script: {
        title: '祭坛正本',
        body: '祭坛玉简才是封着功法正本的那一件，封印还压在匣上。',
        assertsCache: 'altar_item',
      },
      seam_note: {
        title: '石缝残笺',
        body: '残笺只说匣子连着祭坛，没有把温玉说成正本。',
        assertsCache: null,
      },
    },
  };
}

describe('cave inheritance inquiry', () => {
  it('reaches the mouth-cache truth by looking and comparing', () => {
    const { progress, caseFile } = play([
      'examine:seal_marks',
      'move:hall',
      'examine:corpse',
      'examine:altar_item',
      'examine:wall_inscription',
      'compare:handwriting',
    ]);
    expect(progress.knownClueIds).toEqual([
      'outward_seal',
      'corpse_cache',
      'altar_script',
      'wall_script',
      'handwriting_diff',
    ]);
    expect(progress.heldItemIds).toEqual(['mouth_jade']);
    expect(
      judgeInquiryVerdict(progress, caseFile, {
        cache: 'mouth_jade',
        casket: 'leave_shut',
      }),
    ).toEqual({ correct: true, rating: 'A' });
  });

  it('keeps clues when the casket starts a battle', () => {
    const seen = play([
      'examine:seal_marks',
      'move:hall',
      'examine:corpse',
    ]);
    const opened = applyInquiryAction(
      seen.progress,
      seen.caseFile,
      'open:casket',
    );
    expect(opened.effect.kind).toBe('battle');
    expect(opened.progress.knownClueIds).toEqual(seen.progress.knownClueIds);
    expect(opened.progress.pendingBattle).toBe(true);
    const after = finishInquiryBattle(opened.progress, 'victory');
    expect(after.knownClueIds).toEqual(seen.progress.knownClueIds);
    expect(after.foughtCasket).toBe(true);
    expect(after.pendingBattle).toBe(false);
  });

  it('leaves the room unchanged when the verdict is wrong', () => {
    const { progress, caseFile } = play([
      'examine:seal_marks',
      'move:hall',
      'examine:corpse',
      'examine:altar_item',
      'examine:wall_inscription',
      'compare:handwriting',
    ]);
    const before = structuredClone(progress);
    expect(
      judgeInquiryVerdict(progress, caseFile, {
        cache: 'altar_item',
        casket: 'open',
      }),
    ).toEqual({ correct: false, message: '这些证据对不上这个判断' });
    expect(progress).toEqual(before);
  });

  it('opens the altar cache without a battle and rates a lifespan cost as B', () => {
    const { progress, caseFile } = play(
      [
        'force_seam_life',
        'examine:seal_marks',
        'move:hall',
        'examine:corpse',
        'examine:altar_item',
        'examine:wall_inscription',
        'compare:handwriting',
        'open:casket',
        'take:altar_item',
      ],
      altarDraft(),
    );
    expect(progress.pendingBattle).toBe(false);
    expect(progress.casketOpened).toBe(true);
    expect(progress.heldItemIds).toContain('altar_relic');
    expect(
      judgeInquiryVerdict(progress, caseFile, {
        cache: 'altar_item',
        casket: 'open',
      }),
    ).toEqual({ correct: true, rating: 'B' });
  });

  it('does not bank a second reward for seeing the same clue or room', () => {
    const first = play(['examine:seal_marks', 'move:hall']);
    const back = applyInquiryAction(first.progress, first.caseFile, 'move:mouth');
    expect(back.rewardKey).toBeUndefined();
    const again = applyInquiryAction(
      back.progress,
      first.caseFile,
      'examine:seal_marks',
    );
    expect(again.effect).toEqual({ kind: 'known', clueId: 'outward_seal' });
    expect(again.rewardKey).toBeUndefined();
    expect(first.results[1]?.rewardKey).toBe('inquiry:visit:hall');
  });

  it('rejects a cost outside the five inquiry types', () => {
    expect(assertInquiryCostType('hp_loss')).toBe('hp_loss');
    expect(() => assertInquiryCostType('cultivation_exp')).toThrow(
      '秘境探查不接受代价',
    );
  });

  it('quotes the shared cave costs from the map realm', () => {
    expect(quoteInquiryActionCost('steady_array', '筑基', 'normal')).toEqual({
      type: 'spirit_stones',
      value: 250,
    });
    expect(quoteInquiryActionCost('force_seam', '筑基', 'normal')).toEqual({
      type: 'hp_loss',
      value: 0.02,
    });
    expect(quoteInquiryActionCost('force_seam_life', '筑基', 'normal')).toEqual({
      type: 'lifespan',
      value: 1,
    });
  });

  it('accepts the fallback case and rejects a draft that names the other cache', () => {
    const fallback = compileInquiryCase(CAVE_FALLBACK_DRAFT);
    expect(fallback.ok).toBe(true);
    if (!fallback.ok) return;
    expect(fallback.caseFile.truthId).toBe('mouth_cache');

    const broken = compileInquiryCase({
      ...CAVE_FALLBACK_DRAFT,
      clues: {
        ...CAVE_FALLBACK_DRAFT.clues,
        altar_script: {
          ...CAVE_FALLBACK_DRAFT.clues.altar_script,
          assertsCache: 'altar_item',
        },
      },
    });
    expect(broken).toEqual({
      ok: false,
      reason: '线索把另一套真相说成了钥匙',
    });
    const spoiled = compileInquiryCase({
      ...CAVE_FALLBACK_DRAFT,
      opening: '你刚到洞口，就知道正本在齿间温玉里。',
    });
    expect(spoiled).toEqual({ ok: false, reason: '开场白提前说出了正本' });
  });
});
