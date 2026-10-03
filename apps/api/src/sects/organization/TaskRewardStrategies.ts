import type { SectTaskRewardSnapshot } from '@daoyou/shared/engine/sect';
import type { Material } from '@daoyou/shared/types/cultivator';
import { organizationError } from '@server/sects/organization/applicationSupport.js';
import type { SectRewardGateway } from '@server/sects/organization/ports.js';
import type { SectCommandEffects } from '@server/sects/organization/SectCommandEffects.js';

type SectTaskItemGrant = SectTaskRewardSnapshot['grants'][number]['grant'];

export interface SectTaskItemRewardGrantContext {
  cultivatorId: string;
  quantity: number;
  grant: SectTaskItemGrant;
  rewards: SectRewardGateway;
  source: 'sect_task';
}

export interface SectTaskItemRewardGrantStrategy {
  readonly key: string;
  grant(
    context: SectTaskItemRewardGrantContext,
  ): Promise<SectCommandEffects>;
}

export class SectTaskItemRewardGrantStrategyRegistry {
  private readonly strategies = new Map<
    string,
    SectTaskItemRewardGrantStrategy
  >();

  constructor(
    strategies: readonly SectTaskItemRewardGrantStrategy[] = [],
  ) {
    for (const strategy of strategies) this.register(strategy);
  }

  register(strategy: SectTaskItemRewardGrantStrategy): void {
    if (this.strategies.has(strategy.key)) {
      throw new Error(`重复的宗门任务道具奖励策略：${strategy.key}`);
    }
    this.strategies.set(strategy.key, strategy);
  }

  require(key: string): SectTaskItemRewardGrantStrategy {
    const strategy = this.strategies.get(key);
    if (!strategy) organizationError(`尚未注册宗门任务道具奖励策略：${key}`, 500);
    return strategy;
  }
}

export class SectTaskMaterialRewardGrantStrategy
  implements SectTaskItemRewardGrantStrategy
{
  readonly key = 'sect.reward.material';

  async grant(
    context: SectTaskItemRewardGrantContext,
  ): Promise<SectCommandEffects> {
    if (
      context.grant.kind !== this.key ||
      !context.grant.type ||
      !context.grant.quality
    ) {
      organizationError('宗门任务材料奖励配置不匹配', 500);
    }
    return context.rewards.grantMaterial(context.cultivatorId, {
      name: context.grant.name,
      type: context.grant.type,
      rank: context.grant.quality,
      element: context.grant.element as Material['element'],
      description: context.grant.description,
      details: { source: context.source },
      quantity: context.quantity,
    });
  }
}
