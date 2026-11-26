import type { RealmType } from '@daoyou/constants/realms';
import type { ExorcismGrade } from '@daoyou/game-domain/dungeon/exorcism';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import {
  BAIXIAO_CARD_STREAK,
  BAIXIAO_CARD_TYPES,
  BAIXIAO_CHALLENGE_WIN_MS,
  BAIXIAO_FOCUS_PENALTY_MS,
  BAIXIAO_MISS_LIMIT,
  BAIXIAO_PENALTY_MS,
  BAIXIAO_QUESTION_COUNT,
  BAIXIAO_QUESTION_MS,
  BAIXIAO_SESSION_MS,
  type BaixiaoAnswer,
  type BaixiaoBankQuestion,
  type BaixiaoCard,
  type BaixiaoFinish,
  type BaixiaoHand,
  type BaixiaoPaperSlot,
  type BaixiaoResources,
  type BaixiaoScore,
} from '@daoyou/game-domain/baixiao/meet';
import {
  EXORCISM_GRADE_WINS,
  exorcismGradeExperience,
  planExorcismSettlement,
  planExorcismWinReward,
  type ExorcismRewardContext,
} from '../dungeon/exorcism/rewards.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const CHINA_OFFSET = 8 * HOUR;

export function baixiaoWeek(now: number) {
  const china = new Date(now + CHINA_OFFSET);
  const monday =
    Date.UTC(china.getUTCFullYear(), china.getUTCMonth(), china.getUTCDate()) -
    ((china.getUTCDay() + 6) % 7) * DAY;
  const opensAt = monday + 3 * DAY + 14 * HOUR - CHINA_OFFSET;
  const closesAt = opensAt + 3 * HOUR;
  return {
    week: new Date(monday).toISOString().slice(0, 10),
    opensAt,
    closesAt,
    lastStartAt: closesAt - BAIXIAO_SESSION_MS,
  };
}

type Quota = {
  category: BaixiaoBankQuestion['category'];
  difficulty: BaixiaoBankQuestion['difficulty'];
  count: number;
  maxJudgment: number;
};

const BAIXIAO_QUOTAS: readonly Quota[] = [
  { category: 'literature', difficulty: 'easy', count: 1, maxJudgment: 1 },
  { category: 'literature', difficulty: 'medium', count: 5, maxJudgment: 1 },
  { category: 'literature', difficulty: 'hard', count: 2, maxJudgment: 0 },
  { category: 'history', difficulty: 'easy', count: 2, maxJudgment: 1 },
  { category: 'history', difficulty: 'medium', count: 3, maxJudgment: 1 },
  { category: 'history', difficulty: 'hard', count: 1, maxJudgment: 0 },
  { category: 'riddle', difficulty: 'easy', count: 1, maxJudgment: 0 },
  { category: 'riddle', difficulty: 'medium', count: 2, maxJudgment: 1 },
  { category: 'riddle', difficulty: 'hard', count: 1, maxJudgment: 0 },
  { category: 'science', difficulty: 'easy', count: 1, maxJudgment: 0 },
  { category: 'science', difficulty: 'medium', count: 2, maxJudgment: 0 },
  { category: 'science', difficulty: 'hard', count: 1, maxJudgment: 0 },
  { category: 'game', difficulty: 'easy', count: 1, maxJudgment: 0 },
  { category: 'game', difficulty: 'medium', count: 1, maxJudgment: 0 },
  { category: 'game', difficulty: 'hard', count: 1, maxJudgment: 0 },
];

type QuestionGroup = Pick<
  BaixiaoBankQuestion,
  'category' | 'difficulty' | 'kind'
>;
type QuestionCandidate = QuestionGroup &
  Pick<BaixiaoBankQuestion, 'id' | 'knowledgeKey' | 'options'>;
type QuestionGroupCount = QuestionGroup & { count: number };

function groupKey({ category, difficulty, kind }: QuestionGroup) {
  return `${category}:${difficulty}:${kind}`;
}

export function baixiaoSampleLimits(): QuestionGroupCount[] {
  return BAIXIAO_QUOTAS.flatMap(
    ({ category, difficulty, count, maxJudgment }) => {
      const groups: QuestionGroupCount[] = [
        { category, difficulty, kind: 'choice', count },
      ];
      if (maxJudgment > 0)
        groups.push({
          category,
          difficulty,
          kind: 'judgment',
          count: maxJudgment,
        });
      return groups;
    },
  );
}

export function countBaixiaoQuotas(groups: readonly QuestionGroupCount[]) {
  const counts = new Map(groups.map((group) => [groupKey(group), group.count]));
  return BAIXIAO_QUOTAS.map((quota) => {
    const choices = counts.get(groupKey({ ...quota, kind: 'choice' })) ?? 0;
    const judgments = counts.get(groupKey({ ...quota, kind: 'judgment' })) ?? 0;
    return {
      ...quota,
      available: choices + Math.min(judgments, quota.maxJudgment),
    };
  });
}

export function baixiaoQuotaStatus<T extends QuestionCandidate>(
  bank: readonly T[],
) {
  const unique = [
    ...new Map(
      bank.map((question) => [question.knowledgeKey, question]),
    ).values(),
  ];
  const groups = new Map<string, QuestionGroupCount>();
  for (const { category, difficulty, kind } of unique) {
    const group = { category, difficulty, kind };
    const key = groupKey(group);
    const existing = groups.get(key);
    if (existing) existing.count++;
    else groups.set(key, { ...group, count: 1 });
  }
  return countBaixiaoQuotas([...groups.values()]).map((quota) => ({
    ...quota,
    pool: unique.filter(
      (question) =>
        question.category === quota.category &&
        question.difficulty === quota.difficulty,
    ),
  }));
}

function shuffled<T>(items: readonly T[], drawIndex: (size: number) => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = drawIndex(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function createBaixiaoPaper(
  bank: readonly QuestionCandidate[],
  drawIndex: (size: number) => number,
  { preservePoolOrder = false } = {},
): BaixiaoPaperSlot[] | null {
  const quotas = baixiaoQuotaStatus(bank);
  if (quotas.some((quota) => quota.available < quota.count)) return null;
  const drawn = quotas.flatMap(({ pool, count, maxJudgment }) => {
    let judgments = 0;
    const selected: QuestionCandidate[] = [];
    for (const question of preservePoolOrder
      ? pool
      : shuffled(pool, drawIndex)) {
      if (question.kind === 'judgment') {
        if (judgments >= maxJudgment) continue;
        judgments++;
      }
      selected.push(question);
      if (selected.length === count) break;
    }
    return selected;
  });
  return orderBaixiaoPaper(
    drawn.map(({ id, kind, options }) => ({
      id,
      kind,
      optionCount: options.length,
    })),
    drawIndex,
  );
}

function orderBaixiaoPaper(
  questions: readonly {
    id: string;
    kind: BaixiaoBankQuestion['kind'];
    optionCount: number;
  }[],
  drawIndex: (size: number) => number,
): BaixiaoPaperSlot[] {
  return shuffled(questions, drawIndex).map((question) => ({
    questionId: question.id,
    order:
      question.kind === 'choice'
        ? shuffled(
            Array.from({ length: question.optionCount }, (_, index) => index),
            drawIndex,
          )
        : [0, 1],
  }));
}

export function decideBaixiaoAnswer(
  issuedAt: number,
  receivedAt: number,
  choice: number,
  correct: number,
): BaixiaoAnswer {
  const elapsedMs = Math.max(0, receivedAt - issuedAt);
  if (elapsedMs >= BAIXIAO_QUESTION_MS)
    return { verdict: 'timeout', elapsedMs: BAIXIAO_QUESTION_MS };
  return { verdict: choice === correct ? 'correct' : 'wrong', elapsedMs };
}

export function baixiaoCardState(answers: readonly BaixiaoAnswer[]) {
  const hand: BaixiaoHand = { pass: 1, fortune: 2, challenge: 2 };
  let streak = 0;
  for (const answer of answers) {
    if (answer.usedCard) hand[answer.usedCard]--;
    if (answer.bonusCard) hand[answer.bonusCard]++;
    streak =
      answer.verdict === 'correct' ? (streak + 1) % BAIXIAO_CARD_STREAK : 0;
  }
  return { hand, streak };
}

export function awardBaixiaoCard(
  streak: number,
  answer: BaixiaoAnswer,
  drawIndex: (size: number) => number,
): BaixiaoAnswer {
  if (answer.verdict !== 'correct' || streak + 1 !== BAIXIAO_CARD_STREAK)
    return answer;
  return {
    ...answer,
    bonusCard: BAIXIAO_CARD_TYPES[drawIndex(BAIXIAO_CARD_TYPES.length)],
  };
}

export function decideBaixiaoCard(
  card: Exclude<BaixiaoCard, 'challenge'>,
  issuedAt: number,
  receivedAt: number,
  drawIndex: (size: number) => number,
): BaixiaoAnswer {
  const answer = decideBaixiaoAnswer(issuedAt, receivedAt, 0, 0);
  if (answer.verdict === 'timeout') return answer;
  return {
    ...answer,
    verdict: card === 'pass' || drawIndex(2) === 0 ? 'correct' : 'wrong',
    usedCard: card,
  };
}

export function decideBaixiaoChallenge(victory: boolean): BaixiaoAnswer {
  return {
    verdict: victory ? 'correct' : 'wrong',
    elapsedMs: victory ? BAIXIAO_CHALLENGE_WIN_MS : BAIXIAO_QUESTION_MS,
    usedCard: 'challenge',
  };
}

export function scoreBaixiao(
  answers: readonly BaixiaoAnswer[],
  focusPenalties = 0,
): BaixiaoScore {
  let correct = 0;
  let wrong = 0;
  let timeout = 0;
  let focus = 0;
  let elapsedMs = 0;
  for (const answer of answers) {
    elapsedMs += answer.elapsedMs;
    switch (answer.verdict) {
      case 'correct':
        correct++;
        break;
      case 'wrong':
        wrong++;
        break;
      case 'timeout':
        timeout++;
        break;
      case 'focus':
        focus++;
        break;
    }
  }
  const mistakes = wrong + timeout + focus;
  const penaltyMs =
    mistakes * BAIXIAO_PENALTY_MS + focusPenalties * BAIXIAO_FOCUS_PENALTY_MS;
  return {
    correct,
    mistakes,
    wrong,
    timeout,
    focus,
    ...(focusPenalties > 0 ? { focusPenalties } : {}),
    elapsedMs,
    penaltyMs,
    totalMs: elapsedMs + penaltyMs,
  };
}

export function finishBaixiao(score: BaixiaoScore): BaixiaoFinish | null {
  if (score.mistakes >= BAIXIAO_MISS_LIMIT) return 'eliminated';
  if (score.correct + score.mistakes === BAIXIAO_QUESTION_COUNT)
    return 'cleared';
  return null;
}

export function baixiaoRewardBudget(realm: RealmType): BaixiaoResources {
  return {
    cultivationExp: 2 * exorcismGradeExperience('S', baixiaoExorcismContext(realm)),
    spiritStones: 0,
    insight: 0,
  };
}

function baixiaoExorcismContext(realm: RealmType): ExorcismRewardContext {
  return { mapRealm: realm, playerRealm: realm, difficultyTier: 'normal' };
}

export function planBaixiaoClearRewards(
  realm: RealmType,
  correct: number,
  seed: number,
) {
  const minimumCorrect = BAIXIAO_QUESTION_COUNT - BAIXIAO_MISS_LIMIT + 1;
  if (correct < minimumCorrect) throw new Error('百晓盛会未通关');
  const grades = [
    'D', 'C', 'B', 'A', 'S',
  ] as const satisfies readonly ExorcismGrade[];
  const grade = grades[Math.min(correct - minimumCorrect, grades.length - 1)];
  const context = baixiaoExorcismContext(realm);
  const level = getRealmStageLevel(realm, '初期');
  const wins = Array.from({ length: EXORCISM_GRADE_WINS[grade] }, (_, index) =>
    planExorcismWinReward(seed, index + 1, level, context),
  );
  const settlement = planExorcismSettlement(
    seed,
    grade,
    grade === 'S' || grade === 'A' ? 'cleared' : 'retreated',
    level,
    context,
  );
  const rewards = [...wins, settlement];
  return {
    grade,
    difficultyTier: context.difficultyTier,
    insight: settlement.insight,
    spiritStones: rewards.reduce(
      (total, reward) => total + reward.spiritStones,
      0,
    ),
    plans: rewards.map((reward) => reward.plan),
  };
}

export const BAIXIAO_MANUAL_QUALITIES = ['地品', '天品', '仙品', '神品'] as const;
const BAIXIAO_MANUAL_WEIGHTS = {
  炼气: [90, 9, 1, 0],
  筑基: [84, 12, 4, 0],
  金丹: [76, 16, 7, 1],
  元婴: [68, 20, 10, 2],
  化神: [59, 24, 13, 4],
  炼虚: [50, 27, 16, 7],
  合体: [42, 28, 19, 11],
  大乘: [34, 27, 22, 17],
  渡劫: [25, 25, 25, 25],
} satisfies Record<RealmType, readonly [number, number, number, number]>;

export function baixiaoManualQuality(realm: RealmType, roll: number) {
  let cutoff = 0;
  for (const [index, weight] of BAIXIAO_MANUAL_WEIGHTS[realm].entries()) {
    cutoff += weight;
    if (roll < cutoff) return BAIXIAO_MANUAL_QUALITIES[index];
  }
  throw new Error('百晓典籍品阶抽签超出范围');
}

export function baixiaoRewardsEarned(
  budget: BaixiaoResources,
  correct: number,
): BaixiaoResources {
  return {
    cultivationExp: Math.floor(
      (budget.cultivationExp * correct) / BAIXIAO_QUESTION_COUNT,
    ),
    spiritStones: Math.floor(
      (budget.spiritStones * correct) / BAIXIAO_QUESTION_COUNT,
    ),
    insight: Math.floor((budget.insight * correct) / BAIXIAO_QUESTION_COUNT),
  };
}
