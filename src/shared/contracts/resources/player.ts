import {
  ELEMENT_VALUES,
  ENEMY_RACE_VALUES,
  GENDER_VALUES,
  QUALITY_VALUES,
  REALM_STAGE_VALUES,
  REALM_VALUES,
  SPIRITUAL_ROOT_GRADE_VALUES,
} from '@shared/types/constants';
import type { TaskInstance } from '@shared/types/task';
import { CombatV6BuildInitializationStatusSchema } from '../combatV6';
import { z } from 'zod';
import type { PlayerResourceMap } from '../player';
import {
  artifactSchema,
  cultivationTechniqueSchema,
  skillSchema,
} from './inventory';
import type { ResourceChange } from './registry';

const combatV6SlotSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const combatV6PanelAttrSchema = z.enum([
  'physicalAtk',
  'physicalDef',
  'magicAtk',
  'magicDef',
  'maxHp',
  'maxMp',
  'healPower',
  'speed',
  'hit',
  'dodge',
  'critRate',
  'spellCritRate',
  'physicalFuryRate',
  'sealHit',
  'sealResist',
]);

const combatV6AttributeSchema = z.enum([
  'vitality',
  'strength',
  'spirit',
  'endurance',
  'speed',
  'willpower',
]);

const combatV6EquipmentInstanceSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string(),
    templateId: z.string(),
    name: z.string(),
    slot: z.enum(['weapon', 'head', 'armor', 'necklace', 'belt', 'footwear']),
    equipmentLevel: z.number().int(),
    requiredLevel: z.number().int(),
    baseStats: z.array(
      z.object({ attr: combatV6PanelAttrSchema, value: z.number() }).strict(),
    ),
    attributeBonuses: z.array(
      z.object({ attr: combatV6AttributeSchema, value: z.number() }).strict(),
    ),
    essenceIds: z.array(z.string()),
    artId: z.string().optional(),
    formationInscription: z
      .object({ patternId: z.string(), level: z.number().int() })
      .strict()
      .optional(),
    appraisalState: z.literal('appraised'),
    generatorVersion: z.enum([
      'dao_equipment_generator_v1',
      'dao_equipment_generator_v2',
    ]),
    createdAt: z.string(),
  })
  .strict();

export const PLAYER_RESOURCE_TOPICS = [
  'player.session',
  'player.profile',
  'player.condition',
  'player.progress',
  'player.currency',
  'player.loadout',
  'player.combat-v6-build',
  'player.mail-summary',
  'player.task-summary',
  'player.tasks',
] as const;

export type PlayerResourceTopic = (typeof PLAYER_RESOURCE_TOPICS)[number];

export interface PlayerResourceDataMap {
  'player.session': PlayerResourceMap['session'];
  'player.profile': PlayerResourceMap['profile'];
  'player.condition': PlayerResourceMap['condition'];
  'player.progress': PlayerResourceMap['progress'];
  'player.currency': PlayerResourceMap['currency'];
  'player.loadout': PlayerResourceMap['loadout'];
  'player.combat-v6-build': PlayerResourceMap['combat-v6-build'];
  'player.mail-summary': PlayerResourceMap['mail-summary'];
  'player.task-summary': PlayerResourceMap['task-summary'];
  'player.tasks': TaskInstance[];
}

export type TaskResourceViewParams = {
  status?: TaskInstance['status'];
};

export type TaskListReduction =
  | { status: 'applied'; data: TaskInstance[] }
  | { status: 'ignored' }
  | { status: 'stale' };

export function reduceTaskResourceList(
  current: TaskInstance[] | undefined,
  change: ResourceChange<'player.tasks'>,
  params: TaskResourceViewParams,
): TaskListReduction {
  if (change.operation === 'invalidate' || !current) {
    return { status: 'stale' };
  }
  if (change.operation === 'replace') {
    return {
      status: 'applied',
      data: params.status
        ? change.payload.filter((task) => task.status === params.status)
        : change.payload,
    };
  }
  if (change.operation === 'remove-items') {
    const ids = new Set(change.payload.ids.map(String));
    if (!current.some((task) => ids.has(task.id))) {
      return { status: 'ignored' };
    }
    return {
      status: 'applied',
      data: current.filter((task) => !ids.has(task.id)),
    };
  }
  if (change.operation === 'upsert-items') {
    const byId = new Map(current.map((task) => [task.id, task]));
    let changed = false;
    for (const task of change.payload.items) {
      if (params.status && task.status !== params.status) {
        changed = byId.delete(task.id) || changed;
      } else {
        changed = byId.get(task.id) !== task || changed;
        byId.set(task.id, task);
      }
    }
    return changed
      ? { status: 'applied', data: [...byId.values()] }
      : { status: 'ignored' };
  }
  return { status: 'stale' };
}

const attributesSchema = z
  .object({
    vitality: z.number(),
    strength: z.number(),
    spirit: z.number(),
    endurance: z.number(),
    speed: z.number(),
    willpower: z.number(),
  })
  .strict();
const spiritualRootSchema = z
  .object({
    element: z.enum(ELEMENT_VALUES),
    strength: z.number(),
    baseStrength: z.number().optional(),
    marrowWashBonus: z.number().optional(),
    grade: z.enum(SPIRITUAL_ROOT_GRADE_VALUES).optional(),
  })
  .strict();
const fateEffectRollMetaSchema = z
  .object({
    qualityAnchor: z.enum(QUALITY_VALUES),
    minValue: z.number(),
    maxValue: z.number(),
    rolledPercentile: z.number(),
    roundingStep: z.number(),
    variancePercentile: z.number().optional(),
    varianceMultiplier: z.number().optional(),
    strengthMultiplier: z.number().optional(),
  })
  .strict();
const fateEffectEntrySchema = z
  .object({
    id: z.string(),
    effectId: z.string(),
    scope: z.enum(['daily', 'drawback']),
    polarity: z.enum(['boon', 'burden']),
    effectType: z.enum([
      'retreat_exp_multiplier',
      'retreat_insight_multiplier',
      'breakthrough_bonus',
      'natural_recovery_multiplier',
      'toxicity_penalty_multiplier',
      'alchemy_spirit_stone_multiplier',
      'refine_spirit_stone_multiplier',
      'enlightenment_insight_multiplier',
      'inn_cultivation_loss_multiplier',
      'system_spirit_stone_multiplier',
      'market_purchase_price_multiplier',
    ]),
    value: z.number(),
    label: z.string(),
    description: z.string(),
    rollMeta: fateEffectRollMetaSchema,
  })
  .strict();
const preHeavenFateSchema = z
  .object({
    name: z.string(),
    quality: z.enum(QUALITY_VALUES).optional(),
    description: z.string().optional(),
    effects: z.array(fateEffectEntrySchema).optional(),
    generationModel: z
      .object({
        version: z.string(),
        rollVersion: z.string(),
        quality: z.enum(QUALITY_VALUES),
        effectIds: z.array(z.string()),
        compositionHash: z.string(),
        category: z.enum(['single_positive', 'dual_sided']),
      })
      .strict()
      .optional(),
    namingMetadata: z
      .object({
        status: z.enum(['success', 'fallback']),
        originalName: z.string().optional(),
        provider: z.string().optional(),
        styleInsight: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const profileCultivatorSchema = z
  .object({
    id: z.string().uuid().optional(),
    createdAt: z.string().optional(),
    name: z.string(),
    title: z.string().nullable().optional(),
    gender: z.enum(GENDER_VALUES),
    playerRace: z.literal('human').optional(),
    raceNarrative: z.string().optional(),
    race: z.enum(ENEMY_RACE_VALUES).optional(),
    origin: z.string().optional(),
    personality: z.string().optional(),
    realm: z.enum(REALM_VALUES),
    realm_stage: z.enum(REALM_STAGE_VALUES),
    age: z.number(),
    lifespan: z.number(),
    status: z.enum(['active', 'dead']).optional(),
    closed_door_years_total: z.number().optional(),
    attributes: attributesSchema,
    unallocated_attribute_points: z.number().optional(),
    spiritual_roots: z.array(spiritualRootSchema),
    pre_heaven_fates: z.array(preHeavenFateSchema),
    background: z.string().optional(),
    description: z.string().optional(),
    prompt: z.string().optional(),
    balance_notes: z.string().optional(),
    last_yield_at: z.string().optional(),
  })
  .strict();
const conditionProgressTrackSchema = z
  .object({
    level: z.number(),
    progress: z.number(),
  })
  .strict();
const bodyCultivationSchema = z
  .object({
    version: z.literal(1),
    realm: z.enum([
      'mortal_body',
      'bronze_skin',
      'iron_bone',
      'jade_marrow',
      'golden_body',
      'dharma_body',
      'dao_body',
    ]),
    tracks: z.record(z.string(), conditionProgressTrackSchema),
    milestones: z.record(z.string(), z.boolean()),
    breakthrough: z
      .object({
        targetRealm: z.enum([
          'mortal_body',
          'bronze_skin',
          'iron_bone',
          'jade_marrow',
          'golden_body',
          'dharma_body',
          'dao_body',
        ]),
        progress: z.number(),
        failedAttempts: z.number(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const conditionStatusSchema = z
  .object({
    key: z.enum([
      'weakness',
      'minor_wound',
      'major_wound',
      'near_death',
      'breakthrough_focus',
      'protect_meridians',
      'clear_mind',
      'cultivation_boost',
    ]),
    stacks: z.number(),
    source: z.enum(['battle', 'pill', 'event', 'system']),
    duration: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('until_removed') }).strict(),
      z.object({ kind: z.literal('time'), expiresAt: z.string() }).strict(),
    ]),
    usesRemaining: z.number().optional(),
    payload: z
      .record(z.string(), z.union([z.number(), z.string(), z.boolean()]))
      .optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
const conditionSchema = z
  .object({
    combatV6: z.object({maxHp:z.number().positive(),maxMp:z.number().nonnegative(),recoveryPaused:z.boolean()}).strict().optional(),
    version: z.literal(1),
    resources: z
      .object({
        hp: z
          .object({ current: z.number(), max: z.number().optional() })
          .strict(),
        mp: z
          .object({ current: z.number(), max: z.number().optional() })
          .strict(),
      })
      .strict(),
    gauges: z.object({ pillToxicity: z.number() }).strict(),
    tracks: z
      .object({
        bodyCultivation: bodyCultivationSchema.optional(),
        tempering: z.record(z.string(), conditionProgressTrackSchema),
        marrowWash: z
          .object({
            level: z.number(),
            progress: z.number(),
            version: z.literal(1).optional(),
            realm: z.number().optional(),
            breakthroughs: z.number().optional(),
          })
          .strict(),
      })
      .strict(),
    counters: z
      .object({
        longTermPillUsesByRealm: z.record(z.string(), z.number()),
        cultivationPillUsesByRealm: z.record(z.string(), z.number()),
        longevityPillUsesByRealm: z.record(z.string(), z.number()),
        bodyCultivationPillUses: z.number().optional(),
      })
      .strict(),
    statuses: z.array(conditionStatusSchema),
    timestamps: z
      .object({
        lastRecoveryAt: z.string().optional(),
        lastBattleAt: z.string().optional(),
        lastPillAt: z.string().optional(),
        lastBreakthroughAt: z.string().optional(),
      })
      .strict(),
    metrics: z
      .object({
        totalRecoveredHp: z.number().optional(),
        totalRecoveredMp: z.number().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const cultivationProgressSchema = z
  .object({
    cultivation_exp: z.number(),
    exp_cap: z.number(),
    comprehension_insight: z.number(),
    breakthrough_failures: z.number(),
    bottleneck_state: z.boolean(),
    inner_demon: z.boolean(),
    deviation_risk: z.number(),
    last_epiphany_at: z.string().optional(),
    epiphany_buff_expires_at: z.string().optional(),
  })
  .strict();
const taskActionLinkSchema = z
  .object({
    label: z.string(),
    href: z.string(),
  })
  .strict();
const taskObjectiveProgressSchema = z
  .object({
    id: z.string(),
    kind: z.enum([
      'auto_complete',
      'craft_breakthrough_pill',
      'insight_at_least',
      'technique_quality_at_least',
      'status_active',
      'complete_dungeon',
      'win_task_challenge',
      'event_count',
    ]),
    title: z.string(),
    description: z.string(),
    completed: z.boolean(),
    progressText: z.string(),
  })
  .strict();
const taskStageProgressSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    completionText: z.string(),
    completed: z.boolean(),
    current: z.boolean(),
    links: z.array(taskActionLinkSchema),
    objectives: z.array(taskObjectiveProgressSchema),
  })
  .strict();
const taskProgressSnapshotSchema = z
  .object({
    title: z.string(),
    summary: z.string(),
    fromRealm: z.enum(REALM_VALUES).optional(),
    toRealm: z.enum(REALM_VALUES).optional(),
    isCompleted: z.boolean(),
    currentStageId: z.string().nullable(),
    currentStageIndex: z.number(),
    totalStages: z.number(),
    missingRequirements: z.array(z.string()),
    dailyKind: z.enum(['alchemy', 'dungeon', 'ranking']).optional(),
    resetKey: z.string().optional(),
    rewardSummary: z.array(z.string()).optional(),
    rewardClaimedAt: z.string().optional(),
    stages: z.array(taskStageProgressSchema),
  })
  .strict();
export const taskInstanceSchema = z
  .object({
    id: z.string().uuid(),
    definitionId: z.string(),
    category: z.enum(['breakthrough_major', 'daily', 'tutorial']),
    status: z.enum(['active', 'completed']),
    currentStage: z.string().nullable(),
    objectives: z.array(
      z
        .object({
          objectiveId: z.string(),
          completed: z.boolean(),
          progressValue: z.number().optional(),
          completedAt: z.string().optional(),
          updatedAt: z.string().optional(),
        })
        .strict(),
    ),
    metadata: z
      .object({
        fromRealm: z.enum(REALM_VALUES).optional(),
        toRealm: z.enum(REALM_VALUES).optional(),
        taskTheme: z
          .enum([
            'foundation',
            'core',
            'heart_demon',
            'tribulation',
            'law_insight',
          ])
          .optional(),
        dailyKind: z.enum(['alchemy', 'dungeon', 'ranking']).optional(),
        resetKey: z.string().optional(),
        rewardSummary: z.array(z.string()).optional(),
        rewardClaimedAt: z.string().optional(),
        rewardGrantPendingKey: z.string().optional(),
        rewardExpGrantedKey: z.string().optional(),
        rewardGrantedKey: z.string().optional(),
      })
      .strict(),
    createdAt: z.string(),
    updatedAt: z.string(),
    completedAt: z.string().nullable().optional(),
    snapshot: taskProgressSnapshotSchema,
  })
  .strict();

export const PLAYER_RESOURCE_DATA_SCHEMAS = {
  'player.session': z
    .object({
      activeCultivator: z
        .object({
          id: z.string().uuid(),
          status: z.literal('active'),
          sectId: z.string().nullable(),
        })
        .strict()
        .nullable(),
      note: z.string().optional(),
    })
    .strict(),
  'player.profile': z.object({ cultivator: profileCultivatorSchema }).strict(),
  'player.condition': conditionSchema,
  'player.progress': cultivationProgressSchema,
  'player.currency': z
    .object({
      spiritStones: z.number(),
      reputation: z.number(),
      qi: z.number(),
      qiLastRefreshedAt: z.string().nullable(),
    })
    .strict(),
  'player.loadout': z
    .object({
      skills: z.array(skillSchema),
      cultivations: z.array(cultivationTechniqueSchema),
      artifacts: z.array(artifactSchema),
      equipped: z
        .object({
          weapon: z.string().nullable(),
          armor: z.string().nullable(),
          accessory: z.string().nullable(),
        })
        .strict(),
    })
    .strict(),
  'player.combat-v6-build': z
    .object({
      schemaVersion: z.literal(1),
      status: CombatV6BuildInitializationStatusSchema,
      revision: z.number().int().nonnegative(),
      membershipId: z.string().uuid().optional(),
      sectId: z.enum(['lingxiao', 'youdu', 'wuxiang', 'tianyan', 'jiujie']).optional(),
      sectName: z.string().optional(),
      activePathId: z.string().optional(),
      meridianDepth: z.number().int().min(0).max(7),
      methods: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          slot: combatV6SlotSchema,
          level: z.number().int().min(0).max(180),
          isPrimary: z.boolean(),
        }),
      ),
      paths: z.array(z.object({ id: z.string(), name: z.string() })),
      manuals: z
        .object({
          version: z.literal(1),
          revision: z.number().int().nonnegative(),
          build: z.object({
            slots: z.array(
              z.object({
                slot: combatV6SlotSchema,
                manualId: z.string(),
              }),
            ),
          }),
        })
        .optional(),
      equipment: z
        .object({
          weapon: combatV6EquipmentInstanceSchema.optional(),
          head: combatV6EquipmentInstanceSchema.optional(),
          armor: combatV6EquipmentInstanceSchema.optional(),
          necklace: combatV6EquipmentInstanceSchema.optional(),
          belt: combatV6EquipmentInstanceSchema.optional(),
          footwear: combatV6EquipmentInstanceSchema.optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  'player.mail-summary': z
    .object({ unreadCount: z.number().int().nonnegative() })
    .strict(),
  'player.task-summary': z
    .object({
      activeCount: z.number().int().nonnegative(),
      claimableCount: z.number().int().nonnegative(),
    })
    .strict(),
  'player.tasks': z.array(taskInstanceSchema),
} satisfies {
  [TTopic in PlayerResourceTopic]: z.ZodType<PlayerResourceDataMap[TTopic]>;
};
