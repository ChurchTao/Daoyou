import {
  createSectTaskOfferSnapshot,
  resolveSectTaskDifficulty,
  SectTaskRecordPayloadSchema,
  type SectTaskDefinition,
  type SectTaskOfferPolicyDefinition,
  type SectTaskOfferSnapshot,
  type SectTaskRecordPayload,
  type SectTaskRewardCadence,
} from '@daoyou/game-rules/sect-organization';
import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import { organizationError } from '@server/sects/organization/applicationSupport.js';
import type {
  SectTaskOfferPolicyRegistry,
  SectTaskRewardPolicyRegistry,
} from '@server/sects/organization/SectTaskSettlement.js';

function resolveRewardCadence(
  definition: SectTaskDefinition,
): SectTaskRewardCadence {
  if (definition.kind === 'daily' || definition.kind === 'weekly')
    return definition.kind;
  return organizationError(
    `晋升任务 ${definition.id} 不支持周期型经济奖励`,
    500,
  );
}

export class SectTaskOfferService {
  constructor(
    private readonly offers: SectTaskOfferPolicyRegistry,
    private readonly rewards: SectTaskRewardPolicyRegistry,
  ) {}

  create(input: {
    definition: SectTaskDefinition;
    membershipId: string;
    periodKey: string;
    attempt: number;
    realm: RealmType;
    realmStage: RealmStage;
    executorKey: string;
    offer?: SectTaskOfferPolicyDefinition;
  }): SectTaskOfferSnapshot {
    const offerDefinition = input.offer;
    const offerPolicy = offerDefinition
      ? this.offers.require(offerDefinition.policy)
      : undefined;
    const rewardDefinition = input.definition.reward;
    const rewardPolicy = rewardDefinition
      ? this.rewards.require(rewardDefinition.policy)
      : undefined;
    const rulesVersion =
      1 + (offerPolicy?.version ?? 0) * 100 + (rewardPolicy?.version ?? 0);
    const offerResult = offerPolicy
      ? (() => {
          const parsed = offerPolicy.inputSchema.safeParse(
            offerDefinition?.input ?? {},
          );
          if (!parsed.success)
            organizationError(
              `宗门任务告示配置无效：${offerDefinition?.policy}`,
              500,
            );
          return offerPolicy.create(
            {
              membershipId: input.membershipId,
              taskId: input.definition.id,
              periodKey: input.periodKey,
              attempt: input.attempt,
              realm: input.realm,
              realmStage: input.realmStage,
              rulesVersion,
            },
            parsed.data,
          );
        })()
      : { difficulty: 'easy' as const };
    const difficulty = resolveSectTaskDifficulty(
      input.definition.minimumDifficulty,
      offerResult.difficulty,
    );
    const reward = rewardPolicy
      ? (() => {
          const parsed = rewardPolicy.inputSchema.safeParse(
            rewardDefinition?.input ?? {},
          );
          if (!parsed.success)
            organizationError(
              `宗门任务奖励配置无效：${rewardDefinition?.policy}`,
              500,
            );
          return rewardPolicy.calculate(
            {
              realm: input.realm,
              realmStage: input.realmStage,
              difficulty,
              cadence: resolveRewardCadence(input.definition),
            },
            parsed.data,
          );
        })()
      : undefined;
    return createSectTaskOfferSnapshot({
      rulesVersion,
      anchorRealm: input.realm,
      anchorRealmStage: input.realmStage,
      periodKey: input.periodKey,
      executorKey: input.executorKey,
      requirement: offerResult.requirement,
      difficulty,
      reward,
    });
  }

  payload(
    definition: SectTaskDefinition,
    offer: SectTaskOfferSnapshot,
  ): SectTaskRecordPayload {
    return SectTaskRecordPayloadSchema.parse({
      schemaVersion: 2,
      target: definition.target,
      offer,
      executorData: {},
    });
  }
}
