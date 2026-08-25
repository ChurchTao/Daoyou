import type { SectOrganizationModule } from '@shared/engine/sect';
import {
  SectTaskItemRewardGrantStrategyRegistry,
  SectTaskMaterialRewardGrantStrategy,
  type SectTaskItemRewardGrantStrategy,
} from './TaskRewardStrategies';
import { createStandardSectDomainEventDispatcher } from './SectDomainEventDispatcher';
import {
  CompletedDailyTaskProgressStrategy,
  DeliverySectTaskOfferPolicy,
  ProgressSignalFulfillmentStrategy,
  RealmSectTaskRewardPolicy,
  SectTaskFulfillmentRegistry,
  SectTaskOfferPolicyRegistry,
  SectTaskProgressRegistry,
  SectTaskRewardPolicyRegistry,
  type SectTaskFulfillmentStrategy,
  type SectTaskOfferPolicy,
  type SectTaskProgressStrategy,
  type SectTaskRewardPolicy,
} from './SectTaskSettlement';
import {
  ArtifactDeliveryTaskExecutor,
  BattleTaskExecutor,
  DungeonExplorationTaskExecutor,
  MaterialDeliveryTaskExecutor,
  MiningGameTaskExecutor,
  PillDeliveryTaskExecutor,
  ProgressTaskExecutor,
  SectTaskExecutorRegistry,
  SweepGameTaskExecutor,
  type SectTaskExecutor,
} from './task-executors/SectTaskExecutor';

export interface SectOrganizationPluginManifest {
  /** `*` contributes reusable application mechanics; other ids belong to one sect. */
  readonly sectId: string;
  readonly executors?: readonly (() => SectTaskExecutor)[];
  readonly offerPolicies?: readonly (() => SectTaskOfferPolicy)[];
  readonly rewardPolicies?: readonly (() => SectTaskRewardPolicy)[];
  readonly fulfillments?: readonly (() => SectTaskFulfillmentStrategy)[];
  readonly progress?: readonly (() => SectTaskProgressStrategy)[];
  readonly rewardGrants?: readonly (() => SectTaskItemRewardGrantStrategy)[];
}

export const CORE_SECT_ORGANIZATION_PLUGIN: SectOrganizationPluginManifest = {
  sectId: '*',
  executors: [
    () => new SweepGameTaskExecutor(),
    () => new MiningGameTaskExecutor(),
    () => new BattleTaskExecutor(),
    () => new DungeonExplorationTaskExecutor(),
    () => new PillDeliveryTaskExecutor(),
    () => new ArtifactDeliveryTaskExecutor(),
    () => new MaterialDeliveryTaskExecutor(),
    () => new ProgressTaskExecutor(),
  ],
  offerPolicies: [() => new DeliverySectTaskOfferPolicy()],
  rewardPolicies: [() => new RealmSectTaskRewardPolicy()],
  fulfillments: [() => new ProgressSignalFulfillmentStrategy()],
  progress: [() => new CompletedDailyTaskProgressStrategy()],
  rewardGrants: [() => new SectTaskMaterialRewardGrantStrategy()],
};

export interface SectOrganizationPluginComposition {
  executors: SectTaskExecutorRegistry;
  offerPolicies: SectTaskOfferPolicyRegistry;
  rewardPolicies: SectTaskRewardPolicyRegistry;
  fulfillments: SectTaskFulfillmentRegistry;
  progress: SectTaskProgressRegistry;
  rewardGrants: SectTaskItemRewardGrantStrategyRegistry;
  events: ReturnType<typeof createStandardSectDomainEventDispatcher>;
}

function allTasks(organization: SectOrganizationModule) {
  return [
    ...organization.tasks.listDaily(),
    ...organization.tasks.listWeekly(),
    ...organization.tasks.listPromotion(),
  ];
}

function assertContributionNamespace(
  sectId: string,
  key: string,
  label: string,
): void {
  const prefix = sectId === '*' ? 'sect.' : `${sectId}.`;
  if (!key.startsWith(prefix))
    throw new Error(`${label} ${key} 必须使用 ${prefix} 命名空间`);
}

export function composeSectOrganizationPlugins(args: {
  organizations: readonly {
    sectId: string;
    organization: SectOrganizationModule;
  }[];
  manifests: readonly SectOrganizationPluginManifest[];
}): SectOrganizationPluginComposition {
  const knownSects = new Set(args.organizations.map((entry) => entry.sectId));
  const manifests = new Map<string, SectOrganizationPluginManifest>();
  for (const manifest of args.manifests) {
    if (manifests.has(manifest.sectId))
      throw new Error(`宗门服务端插件重复注册：${manifest.sectId}`);
    if (manifest.sectId !== '*' && !knownSects.has(manifest.sectId))
      throw new Error(`宗门服务端插件没有对应内容模块：${manifest.sectId}`);
    manifests.set(manifest.sectId, manifest);
  }
  const contributions = args.manifests.flatMap((manifest) =>
    (manifest.executors ?? []).map((create) => ({ manifest, value: create() })),
  );
  const offerContributions = args.manifests.flatMap((manifest) =>
    (manifest.offerPolicies ?? []).map((create) => ({
      manifest,
      value: create(),
    })),
  );
  const taskRewardContributions = args.manifests.flatMap((manifest) =>
    (manifest.rewardPolicies ?? []).map((create) => ({
      manifest,
      value: create(),
    })),
  );
  const fulfillmentContributions = args.manifests.flatMap((manifest) =>
    (manifest.fulfillments ?? []).map((create) => ({
      manifest,
      value: create(),
    })),
  );
  const progressContributions = args.manifests.flatMap((manifest) =>
    (manifest.progress ?? []).map((create) => ({ manifest, value: create() })),
  );
  const rewardContributions = args.manifests.flatMap((manifest) =>
    (manifest.rewardGrants ?? []).map((create) => ({
      manifest,
      value: create(),
    })),
  );
  for (const { manifest, value } of [
    ...contributions,
    ...offerContributions,
    ...taskRewardContributions,
    ...fulfillmentContributions,
    ...progressContributions,
    ...rewardContributions,
  ])
    assertContributionNamespace(manifest.sectId, value.key, '宗门插件 key');
  const executors = new SectTaskExecutorRegistry(
    contributions.map(({ value }) => value),
  );
  const offerPolicies = new SectTaskOfferPolicyRegistry(
    offerContributions.map(({ value }) => value),
  );
  const rewardPolicies = new SectTaskRewardPolicyRegistry(
    taskRewardContributions.map(({ value }) => value),
  );
  const fulfillments = new SectTaskFulfillmentRegistry(
    fulfillmentContributions.map(({ value }) => value),
  );
  const progress = new SectTaskProgressRegistry(
    progressContributions.map(({ value }) => value),
  );
  const rewardGrants = new SectTaskItemRewardGrantStrategyRegistry(
    rewardContributions.map(({ value }) => value),
  );
  for (const { sectId, organization } of args.organizations) {
    for (const task of allTasks(organization)) {
      const variants = task.availability?.variants ?? [];
      const variantKeys = new Set<string>();
      for (const variant of variants) {
        if (!variant.key)
          throw new Error(
            `宗门 ${sectId} 的任务 ${task.id} 存在空执行变体 key`,
          );
        if (variantKeys.has(variant.key))
          throw new Error(
            `宗门 ${sectId} 的任务 ${task.id} 重复注册执行变体：${variant.key}`,
          );
        variantKeys.add(variant.key);
      }
      const executorKeys = new Set([
        task.executorKey,
        ...variants.map((variant) => variant.executorKey),
      ]);
      for (const key of executorKeys)
        if (!executors.has(key))
          throw new Error(
            `宗门 ${sectId} 的任务 ${task.id} 缺少执行器：${key}`,
          );
      if (task.offer && !offerPolicies.has(task.offer.policy))
        throw new Error(
          `宗门 ${sectId} 的任务 ${task.id} 缺少告示策略：${task.offer.policy}`,
        );
      for (const variant of variants)
        if (variant.offer && !offerPolicies.has(variant.offer.policy))
          throw new Error(
            `宗门 ${sectId} 的任务 ${task.id} 的变体 ${variant.key} 缺少告示策略：${variant.offer.policy}`,
          );
      if (task.reward && !rewardPolicies.has(task.reward.policy))
        throw new Error(
          `宗门 ${sectId} 的任务 ${task.id} 缺少奖励策略：${task.reward.policy}`,
        );
      for (const rule of task.fulfillment)
        if (!fulfillments.has(rule.strategy))
          throw new Error(
            `宗门 ${sectId} 的任务 ${task.id} 缺少达成策略：${rule.strategy}`,
          );
      if (task.progress && !progress.has(task.progress.strategy))
        throw new Error(
          `宗门 ${sectId} 的任务 ${task.id} 缺少进度策略：${task.progress.strategy}`,
        );
    }
  }

  return {
    executors,
    offerPolicies,
    rewardPolicies,
    fulfillments,
    progress,
    rewardGrants,
    events: createStandardSectDomainEventDispatcher({
      fulfillments,
      progress,
      rewards: rewardGrants,
      offerPolicies,
      rewardPolicies,
    }),
  };
}
