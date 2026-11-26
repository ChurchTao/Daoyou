import { REALM_VALUES } from '@daoyou/constants/realms';
import type {
  BaixiaoAnswer,
  BaixiaoBankQuestion,
} from '@daoyou/game-domain/baixiao/meet';
import { BaixiaoQuestionSchema } from '@daoyou/game-domain/baixiao/question';
import { describe, expect, it } from 'vitest';
import {
  planExorcismSettlement,
  planExorcismWinReward,
} from '../dungeon/exorcism/rewards.js';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import {
  awardBaixiaoCard,
  BAIXIAO_MANUAL_QUALITIES,
  baixiaoCardState,
  baixiaoManualQuality,
  baixiaoQuotaStatus,
  baixiaoRewardBudget,
  baixiaoRewardsEarned,
  baixiaoSampleLimits,
  baixiaoWeek,
  createBaixiaoPaper,
  decideBaixiaoAnswer,
  decideBaixiaoCard,
  decideBaixiaoChallenge,
  finishBaixiao,
  planBaixiaoClearRewards,
  scoreBaixiao,
} from './meet.js';

describe('百晓盛会', () => {
  it('以北京时间周一 00:00 开启新一期', () => {
    const boundary = Date.parse('2026-11-30T00:00:00+08:00');
    expect(baixiaoWeek(boundary - 1)).toMatchObject({
      week: '2026-11-23',
      closesAt: boundary,
    });
    expect(baixiaoWeek(boundary)).toMatchObject({
      week: '2026-11-30',
      opensAt: boundary,
      closesAt: Date.parse('2026-12-07T00:00:00+08:00'),
    });
    expect(baixiaoWeek(boundary, -1).week).toBe('2026-11-23');
  });

  it('索引抽样按正式五类配额限制候选数', () => {
    const limits = baixiaoSampleLimits();
    expect(limits).toHaveLength(20);
    expect(limits).toContainEqual({
      category: 'literature',
      difficulty: 'medium',
      kind: 'choice',
      count: 5,
    });
    expect(limits).toContainEqual({
      category: 'literature',
      difficulty: 'medium',
      kind: 'judgment',
      count: 1,
    });
    expect(limits.filter((group) => group.category === 'game')).toHaveLength(3);
    expect(limits.every((group) => group.count > 0)).toBe(true);
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
    ).toHaveLength(8);
    expect(
      chosen.filter(({ category }) => category === 'history'),
    ).toHaveLength(6);
    expect(chosen.filter(({ category }) => category === 'riddle')).toHaveLength(
      4,
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

    const withoutGame = available.filter(({ category }) => category !== 'game');
    expect(createBaixiaoPaper(withoutGame, () => 0)).toBeNull();
    expect(
      baixiaoQuotaStatus(withoutGame).filter(
        ({ category, available }) => category === 'game' && available === 0,
      ),
    ).toHaveLength(3);

    const website = BaixiaoQuestionSchema.parse({
      knowledgeKey: 'game-easy',
      category: 'game',
      difficulty: 'easy',
      kind: 'choice',
      prompt: '《万界道友》的官方网站是？',
      options: ['idaoyou.cn', 'daoyou.org', '全部都是'],
      correct: 2,
      explanation: '两个域名均为官方网站。',
      source: '项目资料',
    });
    expect(
      BaixiaoQuestionSchema.safeParse({
        ...website,
        options: website.options.slice(0, 2),
        correct: 0,
      }).success,
    ).toBe(false);
    const fullBank = [
      ...available.filter(
        (q) => q.category !== 'game' || q.difficulty !== 'easy',
      ),
      { ...website, id: website.knowledgeKey },
    ];
    const fullPaper = createBaixiaoPaper(fullBank, () => 0, {
      preservePoolOrder: true,
    });
    expect(fullPaper).toHaveLength(25);
    expect(
      fullPaper!.find((slot) => slot.questionId === website.knowledgeKey),
    ).toMatchObject({ order: [1, 2, 0] });
    const fullQuestions = fullPaper!.map(({ questionId }) =>
      fullBank.find(({ id }) => id === questionId)!,
    );
    expect(
      ['literature', 'history', 'riddle', 'science', 'game'].map(
        (category) =>
          fullQuestions.filter((question) => question.category === category)
            .length,
      ),
    ).toEqual([8, 6, 4, 4, 3]);
    expect(
      fullQuestions
        .filter((question) => question.category === 'game')
        .map((question) => question.difficulty)
        .sort(),
    ).toEqual(['easy', 'hard', 'medium']);
    expect(
      ['easy', 'medium', 'hard'].map(
        (difficulty) =>
          fullQuestions.filter((question) => question.difficulty === difficulty)
            .length,
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

  it('全对修为等于两局同境普通难度除祟 S，逐题发完完整预算', () => {
    const context = {
      mapRealm: '金丹',
      playerRealm: '金丹',
      difficultyTier: 'normal',
    } as const;
    const level = getRealmStageLevel('金丹', '初期');
    const wins = [1, 2, 3, 4].map((wave) =>
      planExorcismWinReward(1, wave, level, context),
    );
    const settlement = planExorcismSettlement(1, 'S', 'cleared', level, context);
    const expected = 2 * [...wins, settlement].reduce(
      (total, reward) => total + reward.experience,
      0,
    );
    const budget = baixiaoRewardBudget('金丹');
    expect(budget).toEqual({ cultivationExp: expected, spiritStones: 0, insight: 0 });
    expect(baixiaoRewardsEarned(budget, 20).cultivationExp).toBe(Math.floor(expected * 0.8));
    expect(baixiaoRewardsEarned(budget, 25)).toEqual(budget);
  });

  it('通关评级沿用对应除祟战次和评级掉落', () => {
    const seed = 19;
    const level = getRealmStageLevel('金丹', '初期');
    const context = {
      mapRealm: '金丹',
      playerRealm: '金丹',
      difficultyTier: 'normal',
    } as const;
    const cases = [
      [16, 'D', 1, 'retreated'], [17, 'C', 2, 'retreated'],
      [18, 'B', 3, 'retreated'], [19, 'A', 4, 'cleared'],
      [20, 'S', 4, 'cleared'], [25, 'S', 4, 'cleared'],
    ] as const;
    expect(() => planBaixiaoClearRewards('金丹', 15, seed)).toThrow();
    for (const [correct, grade, waves, ending] of cases) {
      const result = planBaixiaoClearRewards('金丹', correct, seed);
      const wins = Array.from({ length: waves }, (_, i) =>
        planExorcismWinReward(seed, i + 1, level, context),
      );
      const settlement = planExorcismSettlement(seed, grade, ending, level, context);
      const rewards = [...wins, settlement];
      expect(result).toEqual({
        grade,
        difficultyTier: 'normal',
        insight: settlement.insight,
        spiritStones: rewards.reduce((total, reward) => total + reward.spiritStones, 0),
        plans: rewards.map((reward) => reward.plan),
      });
    }
  });

  it('典籍始终落在四个品阶，高境界的高品累计概率递增', () => {
    const draws = REALM_VALUES.map((realm) =>
      Array.from({ length: 100 }, (_, roll) => baixiaoManualQuality(realm, roll)),
    );
    for (let index = 0; index < draws.length; index++) {
      const current = draws[index];
      expect(current.every((quality) => BAIXIAO_MANUAL_QUALITIES.includes(quality))).toBe(true);
      const next = draws[index + 1];
      if (!next) continue;
      for (const threshold of [1, 2, 3]) {
        const high = (quality: (typeof BAIXIAO_MANUAL_QUALITIES)[number]) =>
          BAIXIAO_MANUAL_QUALITIES.indexOf(quality) >= threshold;
        expect(next.filter(high).length).toBeGreaterThanOrEqual(current.filter(high).length);
      }
    }
    expect(draws.at(-1)?.filter((quality) => quality === '神品')).toHaveLength(25);
  });
});
