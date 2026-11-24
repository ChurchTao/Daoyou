import type { BaixiaoQuestionData } from './question.js';

export type { BaixiaoQuestionData } from './question.js';

export const BAIXIAO_NODE_ID = 'SAT_DJ_BAIXIAO';
export const BAIXIAO_QUESTION_COUNT = 25;
export const BAIXIAO_MISS_LIMIT = 10;
export const BAIXIAO_QUESTION_MS = 45_000;
export const BAIXIAO_CHALLENGE_WIN_MS = 25_000;
export const BAIXIAO_CARD_STREAK = 4;
export const BAIXIAO_RANK_UNIT_MS = 100;
export const BAIXIAO_PENALTY_MS = 20_000;
export const BAIXIAO_FOCUS_PENALTY_MS = 15_000;
export const BAIXIAO_SESSION_MS = 15 * 60_000;

export type BaixiaoBankQuestion = BaixiaoQuestionData & { id: string };
export type BaixiaoPaperSlot = { questionId: string; order: number[] };
export type BaixiaoVerdict = 'correct' | 'wrong' | 'timeout' | 'focus';
export type BaixiaoFinish = 'cleared' | 'eliminated' | 'expired';
export const BAIXIAO_CARD_TYPES = ['pass', 'fortune', 'challenge'] as const;
export type BaixiaoCard = (typeof BAIXIAO_CARD_TYPES)[number];
export type BaixiaoHand = Record<BaixiaoCard, number>;

export interface BaixiaoAnswer {
  verdict: BaixiaoVerdict;
  elapsedMs: number;
  usedCard?: BaixiaoCard;
  bonusCard?: BaixiaoCard;
}

export interface BaixiaoResources {
  cultivationExp: number;
  spiritStones: number;
  insight: number;
}

export interface BaixiaoScore {
  correct: number;
  mistakes: number;
  wrong: number;
  timeout: number;
  focus: number;
  focusPenalties?: number;
  elapsedMs: number;
  penaltyMs: number;
  totalMs: number;
}
