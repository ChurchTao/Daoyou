import {
  BAIXIAO_CARD_TYPES,
  BAIXIAO_QUESTION_COUNT,
  type BaixiaoAnswer,
  type BaixiaoBankQuestion,
  type BaixiaoFinish,
  type BaixiaoHand,
  type BaixiaoResources,
  type BaixiaoScore,
} from '@daoyou/game-domain/baixiao/meet';
import { BaixiaoQuestionSchema } from '@daoyou/game-domain/baixiao/question';
import { z } from 'zod';

export const BaixiaoWeekCommandSchema = z
  .object({
    week: z.iso.date(),
  })
  .strict();

export const BaixiaoTurnCommandSchema = BaixiaoWeekCommandSchema.extend({
  position: z
    .number()
    .int()
    .min(0)
    .max(BAIXIAO_QUESTION_COUNT - 1),
});

export const BaixiaoFocusCommandSchema = BaixiaoTurnCommandSchema.extend({
  action: z.literal('focus'),
  endsAt: z.number().int().positive(),
  expectedFocusPenalties: z.number().int().nonnegative(),
});

export const BaixiaoResolveCommandSchema = z.discriminatedUnion('action', [
  BaixiaoTurnCommandSchema.extend({
    action: z.literal('answer'),
    option: z.number().int().min(0).max(3),
  }),
  BaixiaoFocusCommandSchema,
  BaixiaoTurnCommandSchema.extend({ action: z.literal('timeout') }),
  BaixiaoTurnCommandSchema.extend({
    action: z.literal('card'),
    card: z.enum(BAIXIAO_CARD_TYPES),
  }),
]);

export const BaixiaoImportSchema = z
  .object({
    questions: z.array(BaixiaoQuestionSchema).min(1).max(350),
  })
  .strict();

export const BaixiaoQuestionStatusSchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(350),
    status: z.enum(['published', 'retired']),
  })
  .strict();

export type BaixiaoResolveCommand = z.infer<typeof BaixiaoResolveCommandSchema>;
export type BaixiaoPhase =
  'waiting' | 'open' | 'closing' | 'closed' | 'settled' | 'unavailable';

export interface BaixiaoQuestionView {
  position: number;
  prompt: string;
  kind: BaixiaoBankQuestion['kind'];
  options: string[];
  deadline: number;
}

export interface BaixiaoSessionView {
  endsAt: number;
  position: number;
  question: BaixiaoQuestionView | null;
  challengeId: string | null;
  hand: BaixiaoHand;
  streak: number;
  latest: (BaixiaoAnswer & { position: number }) | null;
  finished: BaixiaoFinish | null;
  score: BaixiaoScore;
  earned: BaixiaoResources;
  itemName: string | null;
}

export interface BaixiaoStatus {
  week: string;
  opensAt: number;
  lastStartAt: number;
  closesAt: number;
  serverTime: number;
  phase: BaixiaoPhase;
  otherCharacter: boolean;
  session: BaixiaoSessionView | null;
}

export interface BaixiaoRankingRow {
  cultivatorId: string;
  name: string;
  title: string | null;
  gender: string | null;
  realm: string;
  rank: number;
  score: BaixiaoScore;
}

export interface BaixiaoRanking {
  week: string;
  publishedWeek: string | null;
  phase: BaixiaoPhase;
  rows: BaixiaoRankingRow[];
  mine: { rank: number; score: BaixiaoScore } | null;
}

export interface BaixiaoImportResult {
  inserted: number;
  skipped: number;
}

export type BaixiaoQuestionStatus = 'published' | 'retired';

export interface BaixiaoAdminView {
  week: string;
  phase: BaixiaoPhase;
  frozenQuestions: number;
  materials: number;
  bank: (BaixiaoBankQuestion & { status: BaixiaoQuestionStatus })[];
  quotas: Array<{
    category: BaixiaoBankQuestion['category'];
    difficulty: BaixiaoBankQuestion['difficulty'];
    count: number;
    available: number;
  }>;
}
