import type {
  BaixiaoAnswer,
  BaixiaoBankQuestion,
} from '@daoyou/game-domain/baixiao/meet';
import { describe, expect, it } from 'vitest';
import {
  awardBaixiaoCard,
  baixiaoCardState,
  baixiaoQuotaStatus,
  baixiaoRewardBudget,
  baixiaoRewardsEarned,
  baixiaoWeek,
  createBaixiaoPaper,
  decideBaixiaoAnswer,
  decideBaixiaoCard,
  decideBaixiaoChallenge,
  finishBaixiao,
  scoreBaixiao,
} from './meet.js';

describe('百晓盛会', () => {
  it('在北京时间周四 14:00 开场，最晚入场还剩 45 分钟', () => {
    const clock = baixiaoWeek(Date.parse('2026-11-25T16:00:00Z'));
    expect(clock.week).toBe('2026-11-23');
    expect(new Date(clock.opensAt).toISOString()).toBe(
      '2026-11-26T06:00:00.000Z',
    );
    expect(new Date(clock.lastStartAt).toISOString()).toBe(
      '2026-11-26T07:15:00.000Z',
    );
    expect(new Date(clock.closesAt).toISOString()).toBe(
      '2026-11-26T08:00:00.000Z',
    );
    expect(baixiaoWeek(Date.parse('2026-11-29T16:00:00Z')).week).toBe(
      '2026-11-30',
    );
  });

  it('按分类、难度及题型抽题，避免重复知识点并固定选项排列', () => {
    const bank = baixiaoQuotaStatus([]).flatMap((quota) => {
      const members: BaixiaoBankQuestion[] = [];
      for (let index = 0; index < quota.count + 5; index++) {
        const key = `${quota.category}-${quota.difficulty}-${index}`;
        const kind = index >= quota.count ? 'choice' : 'judgment';
        members.push({
          id: key,
          knowledgeKey: key,
          category: quota.category,
          difficulty: quota.difficulty,
          kind,
          prompt: '题干',
          options: kind === 'choice' ? ['甲', '乙', '丙', '丁'] : ['是', '否'],
          correct: 0,
          source: '测试',
          explanation: '解析',
        });
      }
      return members;
    });
    expect(
      createBaixiaoPaper(
        bank.filter((question) => question.kind === 'judgment'),
        () => 0,
      ),
    ).toBeNull();
    // Enough single-choice candidates per quota with judgment candidates still in the draw.
    const extra = bank
      .filter((question) => question.kind === 'choice')
      .map((question) => ({
        ...question,
        id: question.id + '-extra',
        knowledgeKey: question.knowledgeKey + '-extra',
      }));
    const available = [...bank, ...extra, { ...bank[0], id: 'same-knowledge' }];
    const paper = createBaixiaoPaper(available, () => 0);
    expect(paper).toHaveLength(25);
    const chosen = paper!.map((slot) =>
      available.find(({ id }) => id === slot.questionId)!,
    );
    expect(new Set(chosen.map((question) => question.knowledgeKey)).size).toBe(
      25,
    );
    expect(
      chosen.filter(({ category }) => category === 'literature'),
    ).toHaveLength(11);
    expect(
      chosen.filter(({ category }) => category === 'history'),
    ).toHaveLength(8);
    expect(chosen.filter(({ category }) => category === 'riddle')).toHaveLength(
      6,
    );
    expect(
      chosen.filter(({ difficulty }) => difficulty === 'easy'),
    ).toHaveLength(6);
    expect(
      chosen.filter(({ difficulty }) => difficulty === 'medium'),
    ).toHaveLength(13);
    expect(
      chosen.filter(({ difficulty }) => difficulty === 'hard'),
    ).toHaveLength(6);
    expect(
      chosen.filter(({ kind }) => kind === 'judgment').length,
    ).toBeLessThanOrEqual(5);
    paper!.forEach(({ order }, index) => {
      expect(order.toSorted()).toEqual(
        chosen[index].options.map((_, option) => option),
      );
    });

    const science: BaixiaoBankQuestion[] = (
      ['easy', 'medium', 'medium', 'hard'] as const
    ).map((difficulty, index) => ({
      ...extra[0],
      id: `science-${index}`,
      knowledgeKey: `science-${index}`,
      category: 'science',
      difficulty,
    }));
    expect(baixiaoQuotaStatus([...available, ...science.slice(0, 3)])).toEqual(
      baixiaoQuotaStatus(available),
    );
    const expanded = [...available, ...science];
    const expandedPaper = createBaixiaoPaper(expanded, () => 0)!;
    const expandedQuestions = expandedPaper.map(({ questionId }) =>
      expanded.find(({ id }) => id === questionId)!,
    );
    expect(expandedQuestions).toHaveLength(25);
    expect(
      ['literature', 'history', 'riddle', 'science'].map(
        (category) =>
          expandedQuestions.filter((q) => q.category === category).length,
      ),
    ).toEqual([9, 7, 5, 4]);
    expect(
      ['easy', 'medium', 'hard'].map(
        (difficulty) =>
          expandedQuestions.filter((q) => q.difficulty === difficulty).length,
      ),
    ).toEqual([6, 13, 6]);
  });

  it('第 45 秒截止，惩罚只计入成绩，且第 10 次失败优先淘汰', () => {
    const correct = decideBaixiaoAnswer(1000, 45_999, 0, 0);
    const timeout = decideBaixiaoAnswer(1000, 46_000, 0, 0);
    const focus: BaixiaoAnswer = { verdict: 'focus', elapsedMs: 5000 };
    const wrong = decideBaixiaoAnswer(1000, 1500, 1, 0);
    expect(correct).toEqual({ verdict: 'correct', elapsedMs: 44_999 });
    expect(timeout).toEqual({ verdict: 'timeout', elapsedMs: 45_000 });
    const answers = [correct, timeout, focus, wrong];
    expect(scoreBaixiao(answers)).toEqual({
      correct: 1,
      mistakes: 3,
      focus: 1,
      timeout: 1,
      wrong: 1,
      elapsedMs: 95_499,
      penaltyMs: 60_000,
      totalMs: 155_499,
    });
    const result = (count: number, misses: number) =>
      scoreBaixiao([
        ...Array<BaixiaoAnswer>(count).fill(correct),
        ...Array<BaixiaoAnswer>(misses).fill(wrong),
      ]);
    expect(finishBaixiao(result(15, 10))).toBe('eliminated');
    expect(finishBaixiao(result(16, 9))).toBe('cleared');
    expect(finishBaixiao(result(15, 9))).toBeNull();
  });

  it('失焦每次加 15 秒，题数、作答用时、失误和连对保持原值', () => {
    const answers: BaixiaoAnswer[] = [
      { verdict: 'correct', elapsedMs: 5000 },
      { verdict: 'wrong', elapsedMs: 1000 },
      { verdict: 'correct', elapsedMs: 4000 },
    ];
    const baseline = scoreBaixiao(answers);
    expect(scoreBaixiao(answers, 2)).toEqual({
      ...baseline,
      focusPenalties: 2,
      penaltyMs: 50_000,
      totalMs: 60_000,
    });
    expect(finishBaixiao(scoreBaixiao(answers, 10))).toBeNull();
    expect(baixiaoCardState(answers).streak).toBe(1);
  });

  it('对策卡在时限内扣除，挑战胜负各自计时，四连对时三种卡等权补充', () => {
    const correct: BaixiaoAnswer = { verdict: 'correct', elapsedMs: 1500 };
    const pass = decideBaixiaoCard('pass', 1_000, 1_400, () => 1);
    const goodFortune = decideBaixiaoCard('fortune', 1_000, 2_000, () => 0);
    const badFortune = decideBaixiaoCard('fortune', 1_000, 2_000, () => 1);
    const win = decideBaixiaoChallenge(true);
    const loss = decideBaixiaoChallenge(false);
    expect(pass).toEqual({
      verdict: 'correct',
      elapsedMs: 400,
      usedCard: 'pass',
    });
    expect(goodFortune.verdict).toBe('correct');
    expect(badFortune.verdict).toBe('wrong');
    expect(decideBaixiaoCard('pass', 1_000, 46_000, () => 0)).toEqual({
      verdict: 'timeout',
      elapsedMs: 45_000,
    });
    expect(win).toEqual({
      verdict: 'correct',
      elapsedMs: 25_000,
      usedCard: 'challenge',
    });
    expect(scoreBaixiao([loss])).toMatchObject({ wrong: 1, totalMs: 65_000 });
    const trail = [correct, pass, goodFortune];
    expect(baixiaoCardState(trail)).toEqual({
      hand: { pass: 0, fortune: 1, challenge: 2 },
      streak: 3,
    });
    for (const [index, card] of ['pass', 'fortune', 'challenge'].entries())
      expect(
        awardBaixiaoCard(3, win, (size) => {
          expect(size).toBe(3);
          return index;
        }).bonusCard,
      ).toBe(card);
    const awarded = awardBaixiaoCard(3, win, () => 0);
    expect(baixiaoCardState([...trail, awarded])).toEqual({
      hand: { pass: 1, fortune: 1, challenge: 1 },
      streak: 0,
    });
    expect(awardBaixiaoCard(3, badFortune, () => 0)).toEqual(badFortune);
    expect(baixiaoCardState([...trail, badFortune]).streak).toBe(0);
  });

  it('奖励是两份平均历练收益，累计后保留整份预算', () => {
    const budget = baixiaoRewardBudget('炼气', '初期');
    expect(budget.cultivationExp).toBeGreaterThan(0);
    expect(budget.spiritStones).toBeGreaterThan(0);
    expect(budget.insight).toBe(72);
    expect(baixiaoRewardsEarned(budget, 0)).toEqual({
      spiritStones: 0,
      insight: 0,
      cultivationExp: 0,
    });
    expect(baixiaoRewardsEarned(budget, 25)).toEqual(budget);
    expect(baixiaoRewardsEarned(budget, 20).insight).toBe(57);
  });
});
