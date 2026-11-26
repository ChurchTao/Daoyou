import type {
  ContestAttempt,
  ContestCompletionReward,
  ContestMaterial,
  ContestPaper,
  ContestQuestion,
  ContestStandingDetail,
} from '@daoyou/game-domain/alchemy/contest';
import { z } from 'zod';
import type { WeeklyRankingPeriod } from './weekly-activity.js';

export const ContestStartSchema = z.object({ week: z.iso.date() }).strict();
export const ContestBrewSchema = ContestStartSchema.extend({
  requestId: z.uuid(),
  expectedAttempts: z.number().int().min(0).max(2),
  heat: z.enum(['gentle', 'steady', 'fierce']),
  doses: z
    .array(
      z
        .object({
          materialId: z.string().min(1).max(120),
          dose: z.number().int().min(1).max(2),
        })
        .strict(),
    )
    .min(2)
    .max(4),
});

export type ContestMaterialView = Pick<
  ContestMaterial,
  'id' | 'name' | 'description' | 'type' | 'rank' | 'element'
>;

export type ContestBrewCommand = z.infer<typeof ContestBrewSchema>;
export type ContestStatus = {
  week: string;
  opensAt: string;
  closesAt: string;
  serverTime: string;
  phase: 'waiting' | 'open' | 'closed' | 'settled' | 'unavailable';
  session: {
    deadline: string;
    finished: boolean;
    remaining: Record<string, number>;
    qi: number;
    attempts: ContestAttempt[];
    standing: ContestStandingDetail | null;
    completionReward: ContestCompletionReward | null;
    question: ContestQuestion;
    materials: ContestMaterialView[];
  } | null;
  otherCharacter: boolean;
};
export type ContestRankingEntry = {
  id: string;
  name: string;
  title: string | null;
  realm: string | null;
  realmStage: string | null;
  gender: string | null;
  rank: number;
  score: number;
  reputation: number | null;
};

export type ContestRanking = {
  period: WeeklyRankingPeriod;
  title: string | null;
  pillName: string | null;
  entries: ContestRankingEntry[];
  own: { id: string; rank: number; score: number } | null;
};

export type ContestPreparationResult =
  | 'prepared'
  | 'reserve-prepared'
  | 'reserve-used'
  | 'already-prepared'
  | 'registration-opened'
  | 'generation-disabled'
  | 'generation-failed';

export type AdminAlchemyContest = {
  generationEnabled: boolean;
  rounds: {
    week: string;
    opensAt: string;
    closesAt: string;
    announcedAt: string | null;
    settledAt: string | null;
    paper: ContestPaper | null;
    reserve: ContestPaper | null;
    preparationClosed: boolean;
    canPrepare: boolean;
    canUseReserve: boolean;
  }[];
};

export type ContestRankingDetail = {
  week: string;
  pillName: string;
  score: number;
  bestAttempt: number;
  attemptCount: number;
  materialPoints: number;
  qiPoints: number;
  usedMaterials: number;
  usedQi: number;
  elapsedMs: number;
  result: Pick<
    ContestAttempt,
    'effects' | 'qualifiedLots' | 'appearance' | 'toxicity' | 'points' | 'score'
  >;
};
