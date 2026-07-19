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

  const contributions = args.manifests.flatMap((manifest) =>
    (manifest.executors ?? []).map((create) => ({ manifest, value: create() })),
  );
  const settlementContributions = args.manifests.flatMap((manifest) =>
    (manifest.settlements ?? []).map((create) => ({ manifest, value: create() })),
  );
  const progressContributions = args.manifests.flatMap((manifest) =>
    (manifest.progress ?? []).map((create) => ({ manifest, value: create() })),
  );
  const rewardContributions = args.manifests.flatMap((manifest) =>
    (manifest.rewardGrants ?? []).map((create) => ({ manifest, value: create() })),
  );
  const donationContributions = args.manifests.flatMap((manifest) =>
    (manifest.donations ?? []).map((create) => ({ manifest, value: create() })),
  );
  for (const { manifest, value } of [
    ...contributions,
    ...settlementContributions,
    ...progressContributions,
    ...rewardContributions,
    ...donationContributions,
  ])
    assertContributionNamespace(manifest.sectId, value.key, '宗门插件 key');
  const executors = new SectTaskExecutorRegistry(
    contributions.map(({ value }) => value),
  );
  const settlements = new SectTaskSettlementRegistry(
    settlementContributions.map(({ value }) => value),
  );
  const progress = new SectTaskProgressRegistry(
    progressContributions.map(({ value }) => value),
  );
  const rewardGrants = new SectRewardGrantStrategyRegistry(
    rewardContributions.map(({ value }) => value),
  );
  const donations = new SectDonationSpecificationRegistry(
    donationContributions.map(({ value }) => value),
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
    for (const kind of new Set(organization.economy.rewardGrantKinds))
      if (!rewardGrants.has(kind))
        throw new Error(`宗门 ${sectId} 缺少奖励策略：${kind}`);
    for (const kind of new Set(organization.economy.donationKinds))
      if (!donations.has(kind))
        throw new Error(`宗门 ${sectId} 缺少捐献策略：${kind}`);
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
    }),
  };
}
