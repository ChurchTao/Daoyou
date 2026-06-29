import type { LogSpan } from '@shared/engine/battle-v5/systems/log/types';
import type {
  BattleStateTimeline,
  UnitStateSnapshot,
} from '@shared/engine/battle-v5/systems/state/types';
import {
  ENEMY_RACE_VALUES,
  REALM_STAGE_VALUES,
  REALM_VALUES,
  type EnemyRace,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import { z } from 'zod';

export const ADMIN_BATTLE_SCENARIOS = [
  'fixed_vs_template',
  'template_vs_template',
  'fixed_vs_live_sample',
  'live_sample_vs_live_sample',
] as const;

export type AdminBattleScenario = (typeof ADMIN_BATTLE_SCENARIOS)[number];

export const AdminBattleDuelRequestSchema = z
  .object({
    playerCultivatorId: z.string().uuid(),
    opponentCultivatorId: z.string().uuid(),
  })
  .refine((value) => value.playerCultivatorId !== value.opponentCultivatorId, {
    message: '不能使用同一个角色进行精确对战',
    path: ['opponentCultivatorId'],
  });

export const AdminBattleTemplateFiltersSchema = z
  .object({
    realms: z.array(z.enum(REALM_VALUES)).min(1).optional(),
    realmStages: z.array(z.enum(REALM_STAGE_VALUES)).min(1).optional(),
    races: z.array(z.enum(ENEMY_RACE_VALUES)).min(1).optional(),
    difficultyMin: z.number().int().min(0).max(100).optional(),
    difficultyMax: z.number().int().min(0).max(100).optional(),
    bossRate: z.number().min(0).max(1).optional(),
  })
  .optional()
  .superRefine((value, context) => {
    if (!value) return;
    const min = value.difficultyMin ?? 0;
    const max = value.difficultyMax ?? 100;
    if (min > max) {
      context.addIssue({
        code: 'custom',
        message: 'difficultyMin 不能大于 difficultyMax',
        path: ['difficultyMin'],
      });
    }
  });

export const AdminBattleLiveSampleFiltersSchema = z
  .object({
    realms: z.array(z.enum(REALM_VALUES)).min(1).optional(),
    realmStages: z.array(z.enum(REALM_STAGE_VALUES)).min(1).optional(),
  })
  .optional();

export const AdminBattleMonteCarloRequestSchema = z
  .object({
    scenario: z.enum(ADMIN_BATTLE_SCENARIOS),
    anchorCultivatorId: z.string().uuid().optional(),
    sampleCount: z.number().int().min(1).optional().default(100),
    templateFilters: AdminBattleTemplateFiltersSchema,
    liveSampleFilters: AdminBattleLiveSampleFiltersSchema,
    sampleLogLimit: z.number().int().min(0).max(5).optional().default(3),
  })
  .superRefine((value, context) => {
    const usesLiveSamples =
      value.scenario === 'fixed_vs_live_sample' ||
      value.scenario === 'live_sample_vs_live_sample';
    const maxSamples = usesLiveSamples ? 100 : 300;
    if (value.sampleCount > maxSamples) {
      context.addIssue({
        code: 'custom',
        message: `sampleCount 不能超过 ${maxSamples}`,
        path: ['sampleCount'],
      });
    }

    const requiresAnchor =
      value.scenario === 'fixed_vs_template' ||
      value.scenario === 'fixed_vs_live_sample';
    if (requiresAnchor && !value.anchorCultivatorId) {
      context.addIssue({
        code: 'custom',
        message: '该场景必须提供 anchorCultivatorId',
        path: ['anchorCultivatorId'],
      });
    }
  });

export type AdminBattleDuelRequest = z.infer<
  typeof AdminBattleDuelRequestSchema
>;
export type AdminBattleMonteCarloRequest = z.infer<
  typeof AdminBattleMonteCarloRequestSchema
>;
export type AdminBattleTemplateFilters = NonNullable<
  AdminBattleMonteCarloRequest['templateFilters']
>;
export type AdminBattleLiveSampleFilters = NonNullable<
  AdminBattleMonteCarloRequest['liveSampleFilters']
>;

export interface AdminBattleParticipantSummary {
  side: 'A' | 'B';
  source: 'cultivator' | 'template';
  cultivatorId: string;
  name: string;
  title: string | null;
  realm: RealmType;
  realmStage: RealmStage;
  race?: EnemyRace;
  template?: {
    difficulty: number;
    difficultyBand: 'core' | 'variant' | 'advanced' | 'legendary';
    variantSeed: string;
  };
}

export interface AdminBattleFinalUnitState {
  participant: AdminBattleParticipantSummary;
  snapshot: UnitStateSnapshot;
}

export interface AdminBattleDuelResult {
  participants: {
    a: AdminBattleParticipantSummary;
    b: AdminBattleParticipantSummary;
  };
  winnerSide: 'A' | 'B';
  loserSide: 'A' | 'B';
  turns: number;
  finalState: {
    a: AdminBattleFinalUnitState;
    b: AdminBattleFinalUnitState;
  };
  logs: string[];
  logSpans: LogSpan[];
  stateTimeline: BattleStateTimeline;
}

export interface AdminBattleMonteCarloSample {
  index: number;
  participants: {
    a: AdminBattleParticipantSummary;
    b: AdminBattleParticipantSummary;
  };
  winnerSide: 'A' | 'B';
  turns: number;
  finalHp: {
    a: { current: number; max: number };
    b: { current: number; max: number };
  };
  logs: string[];
}

export interface AdminBattleMonteCarloBreakdown {
  dimension: string;
  key: string;
  sampleCount: number;
  aWins: number;
  bWins: number;
  aWinRate: number;
  averageTurns: number;
}

export interface AdminBattleMonteCarloResult {
  scenario: AdminBattleScenario;
  sampleCount: number;
  aWins: number;
  bWins: number;
  aWinRate: number;
  bWinRate: number;
  turnStats: {
    average: number;
    p50: number;
    p95: number;
    min: number;
    max: number;
  };
  breakdowns: AdminBattleMonteCarloBreakdown[];
  samples: AdminBattleMonteCarloSample[];
}
