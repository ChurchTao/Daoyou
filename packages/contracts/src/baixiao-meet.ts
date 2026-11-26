import {
  BAIXIAO_CARD_TYPES,
  BAIXIAO_QUESTION_COUNT,
  type BaixiaoAnswer,
  type BaixiaoBankQuestion,
  type BaixiaoFinish,
  type BaixiaoHand,
  type BaixiaoResources,
  type BaixiaoReward,
  type BaixiaoScore,
} from '@daoyou/game-domain/baixiao/meet';
import {
  BaixiaoCategorySchema,
  BaixiaoDifficultySchema,
  BaixiaoQuestionSchema,
} from '@daoyou/game-domain/baixiao/question';
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

export const BAIXIAO_IMPORT_BATCH_SIZE = 350;

export const BaixiaoImportFileSchema = z
  .object({
    questions: z.array(BaixiaoQuestionSchema).min(1),
  })
  .strict();

export const BaixiaoImportSchema = BaixiaoImportFileSchema.extend({
  questions: BaixiaoImportFileSchema.shape.questions.max(
    BAIXIAO_IMPORT_BATCH_SIZE,
  ),
});

export const BaixiaoQuestionStatusSchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(350),
    status: z.enum(['published', 'retired']),
  })
  .strict();

export const BAIXIAO_ADMIN_PAGE_SIZE = 50;

export const BaixiaoAdminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  query: z.string().trim().max(180).optional(),
  category: BaixiaoCategorySchema.optional(),
  difficulty: BaixiaoDifficultySchema.optional(),
  status: z.enum(['published', 'retired']).optional(),
});

export type BaixiaoAdminListQuery = z.infer<typeof BaixiaoAdminListQuerySchema>;

export type BaixiaoResolveCommand = z.infer<typeof BaixiaoResolveCommandSchema>;
export type BaixiaoPhase =
  'waiting' | 'open' | 'closing' | 'closed' | 'settled' | 'unavailable';

interface BaixiaoQuestionHeading {
  position: number;
  prompt: string;
  category: BaixiaoBankQuestion['category'];
  difficulty: BaixiaoBankQuestion['difficulty'];
}

export interface BaixiaoQuestionView extends BaixiaoQuestionHeading {
  kind: BaixiaoBankQuestion['kind'];
  options: string[];
  deadline: number;
}

export interface BaixiaoQuestionReview extends BaixiaoQuestionHeading {
  verdict: Exclude<BaixiaoAnswer['verdict'], 'correct'>;
  answer: string;
  explanation: string;
}

export interface BaixiaoSessionView {
  endsAt: number;
  position: number;
  question: BaixiaoQuestionView | null;
  review: BaixiaoQuestionReview | null;
  challengeId: string | null;
  hand: BaixiaoHand;
  streak: number;
  latest: (BaixiaoAnswer & { position: number }) | null;
  finished: BaixiaoFinish | null;
  score: BaixiaoScore;
  earned: BaixiaoResources;
  reward: BaixiaoReward | null;
}

export interface BaixiaoStatus {
  week: string;
  opensAt: number;
  lastStartAt: number;
  closesAt: number;
  serverTime: number;
  serverWorkMs?: number;
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

export type BaixiaoAdminQuestion = BaixiaoBankQuestion & {
  status: BaixiaoQuestionStatus;
};

export interface BaixiaoAdminQuestionPage {
  page: number;
  total: number;
  bank: BaixiaoAdminQuestion[];
}

export type BaixiaoPracticeQuestion = Pick<
  BaixiaoBankQuestion,
  'id' | 'prompt' | 'kind' | 'options' | 'correct' | 'category' | 'difficulty'
>;

export interface BaixiaoAdminView {
  week: string;
  phase: BaixiaoPhase;
  published: number;
  retired: number;
  materials: number;
  distribution: Array<{
    category: BaixiaoBankQuestion['category'];
    difficulty: BaixiaoBankQuestion['difficulty'];
    count: number;
  }>;
  quotas: Array<{
    category: BaixiaoBankQuestion['category'];
    difficulty: BaixiaoBankQuestion['difficulty'];
    count: number;
    available: number;
  }>;
}
