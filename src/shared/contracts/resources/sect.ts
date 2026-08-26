import { SectDeliveryRequirementSchema } from '@shared/engine/sect/core/organization/taskRequirements';
import { SectTaskRewardSnapshotSchema } from '@shared/engine/sect/core/organization/taskRewards';
import { ItemLibraryEntrySchema } from '@shared/lib/itemLibrary';
import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
} from '@shared/types/constants';
import { z } from 'zod';
import type {
  SectConstructionMemberData,
  SectContributionRankingData,
  SectContextData,
  SectInfrastructureData,
  SectMembersData,
  SectProgressionData,
  SectShopData,
  SectTasksData,
} from '../sect';

export const SECT_RESOURCE_TOPICS = [
  'sect.membership',
  'sect.members',
  'sect.contribution-ranking',
  'sect.infrastructure',
  'sect.progression',
  'sect.tasks',
  'sect.shop',
  'sect.construction-member',
] as const;

export type SectResourceTopic = (typeof SECT_RESOURCE_TOPICS)[number];

export interface SectResourceDataMap {
  'sect.membership': SectContextData;
  'sect.members': SectMembersData;
  'sect.contribution-ranking': SectContributionRankingData;
  'sect.infrastructure': SectInfrastructureData;
  'sect.progression': SectProgressionData;
  'sect.tasks': SectTasksData;
  'sect.shop': SectShopData;
  'sect.construction-member': SectConstructionMemberData;
}

const sectPathStateSchema = z
  .object({
    pathId: z.string(),
    unlockedLayerIds: z.array(z.string()),
    tacticId: z.string(),
    activeMeridianSlot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    meridianLoadouts: z.array(
      z
        .object({
          slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          nodeIds: z.array(z.string()),
          version: z.number(),
        })
        .strict(),
    ),
  })
  .strict();
const sectTaskDialoguePresentationSchema = z
  .object({
    offeredReply: z.string(),
    activeReply: z.string(),
    claimableReply: z.string(),
    claimedReply: z.string(),
    instruction: z
      .array(
        z
          .object({
            text: z.string(),
            emphasis: z
              .enum(['quantity', 'quality', 'effect', 'appearance', 'warning'])
              .optional(),
          })
          .strict(),
      )
      .readonly(),
  })
  .strict();
export const sectTaskViewSchema = z
  .object({
    id: z.string(),
    definitionId: z.string(),
    kind: z.enum(['daily', 'weekly', 'promotion']),
    state: z.enum(['offered', 'active', 'claimable', 'claimed', 'locked']),
    periodKey: z.string(),
    progress: z.object({ current: z.number(), target: z.number() }).strict(),
    difficulty: z.enum(['easy', 'normal', 'hard', 'elite']).optional(),
    requirement: SectDeliveryRequirementSchema.optional(),
    reward: SectTaskRewardSnapshotSchema.optional(),
    battleTarget: z
      .object({
        kind: z.enum(['preset', 'cultivator']),
        name: z.string(),
        description: z.string(),
        realm: z.enum(REALM_VALUES),
        realmStage: z.enum(REALM_STAGE_VALUES),
        sectId: z.string().optional(),
        sectName: z.string().optional(),
      })
      .strict()
      .optional(),
    presentation: z
      .object({
        title: z.string(),
        description: z.string(),
        dialogue: sectTaskDialoguePresentationSchema,
      })
      .strict(),
    actions: z.array(
      z
        .object({
          key: z.string(),
          renderer: z.string(),
          label: z.string(),
          enabled: z.boolean(),
          disabledReason: z.string().optional(),
          parameters: z.record(z.string(), z.json()).optional(),
        })
        .strict(),
    ),
  })
  .strict();
const sectShopItemSchema = z
  .object({
    id: z.string().uuid(),
    itemLibraryItemId: z.string(),
    price: z.number().int().positive(),
    quantity: z.number().int().positive(),
    perUserLimit: z.number().int().positive().nullable(),
    status: z.enum(['active', 'archived']),
    sortOrder: z.number().int(),
    purchasedCount: z.number().int().nonnegative(),
    remainingPurchases: z.number().int().nonnegative().nullable(),
    item: ItemLibraryEntrySchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const SECT_RESOURCE_DATA_SCHEMAS = {
  'sect.membership': z
    .object({
      sectId: z.string(),
      membershipId: z.string(),
      status: z.enum(['prospect', 'active']),
      joinedAt: z.string().optional(),
      discipleRank: z.enum(['registered', 'outer', 'inner', 'true']),
      contribution: z.number(),
      lifetimeContribution: z.number(),
      office: z.enum(['none', 'steward', 'protector', 'elder']),
      promotedAt: z.string().optional(),
      permissions: z.record(
        z.string(),
        z
          .object({
            granted: z.boolean(),
            requiredRank: z
              .enum(['registered', 'outer', 'inner', 'true'])
              .optional(),
            reason: z.string().optional(),
            reasonCode: z
              .enum(['rank_locked', 'version_locked', 'content_locked'])
              .optional(),
          })
          .strict(),
      ),
      configVersion: z.number().int().nonnegative(),
    })
    .strict(),
  'sect.members': z
    .object({
      items: z.array(
        z
          .object({
            cultivatorId: z.string().uuid(),
            name: z.string(),
            realm: z.string(),
            realmStage: z.string(),
            discipleRank: z.enum(['registered', 'outer', 'inner', 'true']),
            office: z.enum(['none', 'steward', 'protector', 'elder']),
            joinedAt: z.string().optional(),
            activityState: z.enum([
              'online',
              'active_today',
              'active_7d',
              'inactive',
            ]),
          })
          .strict(),
      ),
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
    })
    .strict(),
  'sect.contribution-ranking': z
    .object({
      metric: z.literal('lifetime_contribution'),
      generatedAt: z.string(),
      entries: z
        .array(
          z
            .object({
              rank: z.number().int().positive(),
              cultivatorId: z.string().uuid(),
              name: z.string(),
              discipleRank: z.enum(['registered', 'outer', 'inner', 'true']),
              office: z.enum(['none', 'steward', 'protector', 'elder']),
              contribution: z.number().int().nonnegative(),
            })
            .strict(),
        )
        .max(20),
      currentMember: z
        .object({
          rank: z.number().int().positive(),
          cultivatorId: z.string().uuid(),
          name: z.string(),
          discipleRank: z.enum(['registered', 'outer', 'inner', 'true']),
          office: z.enum(['none', 'steward', 'protector', 'elder']),
          contribution: z.number().int().nonnegative(),
        })
        .strict(),
    })
    .strict(),
  'sect.infrastructure': z
    .object({
      facilities: z.array(
        z
          .object({
            key: z.string(),
            level: z.number(),
            progress: z.number(),
            target: z.number().nullable(),
            maxLevel: z.number(),
            upgradeable: z.boolean(),
            updatedAt: z.string().optional(),
          })
          .strict(),
      ),
    })
    .strict(),
  'sect.progression': z
    .object({
      activePathId: z.string().optional(),
      methods: z.record(z.string(), z.number()),
      paths: z.array(sectPathStateSchema),
      abilityLoadout: z.tuple([
        z.string().nullable(),
        z.string().nullable(),
        z.string().nullable(),
        z.string().nullable(),
      ]),
    })
    .strict(),
  'sect.tasks': z
    .object({
      dateKey: z.string(),
      weekKey: z.string(),
      items: z.array(sectTaskViewSchema),
    })
    .strict(),
  'sect.shop': z
    .object({
      weekKey: z.string(),
      contribution: z.number(),
      items: z.array(sectShopItemSchema),
    })
    .strict(),
  'sect.construction-member': z
    .object({
      dateKey: z.string(),
      constructedToday: z.boolean(),
      facilityKey: z.string().optional(),
      spiritStones: z.number().optional(),
      constructionPoints: z.number().optional(),
      contribution: z.number().optional(),
    })
    .strict(),
} satisfies {
  [TTopic in SectResourceTopic]: z.ZodType<SectResourceDataMap[TTopic]>;
};
