import type { SectOrganizationModule } from '@shared/engine/sect';
import {
  ArtifactDonationSpecification,
  MaterialDonationSpecification,
  MaterialRewardGrantStrategy,
  PillDonationSpecification,
  PillRewardGrantStrategy,
  SectDonationSpecificationRegistry,
  SectRewardGrantStrategyRegistry,
  SpiritStoneDonationSpecification,
  SpiritStoneRewardGrantStrategy,
  type SectDonationSpecification,
  type SectRewardGrantStrategy,
} from './EconomyStrategies';
import {
  createStandardSectDomainEventDispatcher,
  type SectDomainEventHandlerContribution,
} from './SectDomainEventDispatcher';
import {
  CompletedDailyTaskProgressStrategy,
  ContributionTaskSettlementStrategy,
  ProgressSignalSettlementStrategy,
  RealmDailyRewardSettlementStrategy,
  SectTaskProgressRegistry,
  SectTaskSettlementRegistry,
  type SectTaskProgressStrategy,
  type SectTaskSettlementStrategy,
} from './SectTaskSettlement';
import {
  ArtifactDeliveryTaskExecutor,
  BattleTaskExecutor,
  MaterialDeliveryTaskExecutor,
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
  readonly settlements?: readonly (() => SectTaskSettlementStrategy)[];
  readonly progress?: readonly (() => SectTaskProgressStrategy)[];
  readonly rewardGrants?: readonly (() => SectRewardGrantStrategy)[];
  readonly donations?: readonly (() => SectDonationSpecification)[];
  readonly eventHandlers?: readonly SectDomainEventHandlerContribution[];
}

export const CORE_SECT_ORGANIZATION_PLUGIN: SectOrganizationPluginManifest = {
  sectId: '*',
  executors: [
    () => new SweepGameTaskExecutor(),
    () => new BattleTaskExecutor(),
    () => new PillDeliveryTaskExecutor(),
    () => new ArtifactDeliveryTaskExecutor(),
    () => new MaterialDeliveryTaskExecutor(),
    () => new ProgressTaskExecutor(),
  ],
  settlements: [
    () => new ContributionTaskSettlementStrategy(),
    () => new RealmDailyRewardSettlementStrategy(),
    () => new ProgressSignalSettlementStrategy(),
  ],
  progress: [() => new CompletedDailyTaskProgressStrategy()],
  rewardGrants: [
    () => new SpiritStoneRewardGrantStrategy(),
    () => new MaterialRewardGrantStrategy(),
    () => new PillRewardGrantStrategy(),
  ],
  donations: [
    () => new SpiritStoneDonationSpecification(),
    () => new MaterialDonationSpecification(),
    () => new PillDonationSpecification(),
    () => new ArtifactDonationSpecification(),
  ],
};

export interface SectOrganizationPluginComposition {
  executors: SectTaskExecutorRegistry;
  settlements: SectTaskSettlementRegistry;
  progress: SectTaskProgressRegistry;
  rewardGrants: SectRewardGrantStrategyRegistry;
  donations: SectDonationSpecificationRegistry;
  events: ReturnType<typeof createStandardSectDomainEventDispatcher>;
}

function allTasks(organization: SectOrganizationModule) {
  return [
    ...organization.tasks.listDaily(),
    ...organization.tasks.listWeekly(),
    ...organization.tasks.listPromotion(),
  ];
}

export function composeSectOrganizationPlugins(args: {
  organizations: readonly { sectId: string; organization: SectOrganizationModule }[];
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
  for (const sectId of knownSects)
    if (!manifests.has(sectId))
      throw new Error(`宗门缺少服务端插件：${sectId}`);

  const contributions = args.manifests.flatMap((manifest) => manifest.executors ?? []);
  const settlementContributions = args.manifests.flatMap(
    (manifest) => manifest.settlements ?? [],
  );
  const progressContributions = args.manifests.flatMap(
    (manifest) => manifest.progress ?? [],
  );
  const rewardContributions = args.manifests.flatMap(
    (manifest) => manifest.rewardGrants ?? [],
  );
  const donationContributions = args.manifests.flatMap(
    (manifest) => manifest.donations ?? [],
  );
  const executors = new SectTaskExecutorRegistry(
    contributions.map((create) => create()),
  );
  const settlements = new SectTaskSettlementRegistry(
    settlementContributions.map((create) => create()),
  );
  const progress = new SectTaskProgressRegistry(
    progressContributions.map((create) => create()),
  );
  const rewardGrants = new SectRewardGrantStrategyRegistry(
    rewardContributions.map((create) => create()),
  );
  const donations = new SectDonationSpecificationRegistry(
    donationContributions.map((create) => create()),
  );

  for (const { sectId, organization } of args.organizations) {
    for (const task of allTasks(organization)) {
      const executorKeys = new Set([
        task.executorKey,
        ...(task.availability?.executorKeys ?? []),
      ]);
      for (const key of executorKeys)
        if (!executors.has(key))
          throw new Error(`宗门 ${sectId} 的任务 ${task.id} 缺少执行器：${key}`);
      for (const rule of task.completion)
        if (!settlements.has(rule.strategy))
          throw new Error(
            `宗门 ${sectId} 的任务 ${task.id} 缺少结算策略：${rule.strategy}`,
          );
      if (task.progress && !progress.has(task.progress.strategy))
        throw new Error(
          `宗门 ${sectId} 的任务 ${task.id} 缺少进度策略：${task.progress.strategy}`,
        );
    }
    for (const weekKey of ['validation-even', 'validation-odd'])
      for (const item of organization.economy.shopItems(weekKey))
        if (!rewardGrants.has(item.grant.kind))
          throw new Error(`宗门 ${sectId} 的商品 ${item.id} 缺少奖励策略：${item.grant.kind}`);
    for (const dateKey of ['2026-01-01', '2026-01-02'])
      for (const demand of organization.economy.donationDemands(sectId, dateKey))
        if (!donations.has(demand.kind))
          throw new Error(`宗门 ${sectId} 的需求 ${demand.id} 缺少捐献策略：${demand.kind}`);
    for (const rank of ['registered', 'outer', 'inner', 'true'] as const)
      for (const reward of organization.economy.stipendRewards(rank, 5))
        if (!rewardGrants.has(reward.grant.kind))
          throw new Error(
            `宗门 ${sectId} 的 ${rank} 周俸缺少奖励策略：${reward.grant.kind}`,
          );
  }

  return {
    executors,
    settlements,
    progress,
    rewardGrants,
    donations,
    events: createStandardSectDomainEventDispatcher({
      settlements,
      progress,
      rewards: rewardGrants,
      contributions: args.manifests.flatMap(
        (manifest) => manifest.eventHandlers ?? [],
      ),
    }),
  };
}
