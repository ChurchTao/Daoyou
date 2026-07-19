import {
  ArtifactDeliverySpecification,
  MaterialDeliverySpecification,
  PillDeliverySpecification,
  type SectDonationDemandDefinition,
  type SectShopGrant,
} from '@shared/engine/sect';
import type { Material } from '@shared/types/cultivator';
import type { Quality } from '@shared/types/constants';
import { organizationError } from './applicationSupport';
import type {
  IdGenerator,
  SectEconomyRepository,
  SectInventoryGateway,
  SectRewardGateway,
} from './ports';

export interface SectRewardGrantContext {
  userId: string;
  cultivatorId: string;
  quantity: number;
  grant: SectShopGrant;
  rewards: SectRewardGateway;
  ids: IdGenerator;
  source: string;
}

export interface SectRewardGrantStrategy {
  readonly key: string;
  grant(context: SectRewardGrantContext): Promise<void>;
}

export class SectRewardGrantStrategyRegistry {
  private readonly strategies = new Map<string, SectRewardGrantStrategy>();

  constructor(strategies: readonly SectRewardGrantStrategy[] = []) {
    for (const strategy of strategies) this.register(strategy);
  }

  register(strategy: SectRewardGrantStrategy): void {
    if (this.strategies.has(strategy.key))
      throw new Error(`重复的宗门奖励策略：${strategy.key}`);
    this.strategies.set(strategy.key, strategy);
  }

  has(key: string): boolean {
    return this.strategies.has(key);
  }

  require(key: string): SectRewardGrantStrategy {
    const strategy = this.strategies.get(key);
    if (!strategy) organizationError(`尚未注册宗门奖励策略：${key}`, 500);
    return strategy;
  }
}

export class SpiritStoneRewardGrantStrategy implements SectRewardGrantStrategy {
  readonly key = 'spirit_stones';

  async grant(context: SectRewardGrantContext): Promise<void> {
    if (context.grant.kind !== this.key)
      organizationError('宗门灵石奖励配置不匹配', 500);
    await context.rewards.grantSpiritStones(
      context.cultivatorId,
      context.quantity,
    );
  }
}

export class MaterialRewardGrantStrategy implements SectRewardGrantStrategy {
  readonly key = 'material';

  async grant(context: SectRewardGrantContext): Promise<void> {
    if (
      context.grant.kind !== this.key ||
      !context.grant.type ||
      !context.grant.quality
    )
      organizationError('宗门材料奖励配置不匹配', 500);
    await context.rewards.grantMaterial(context.cultivatorId, {
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

export class PillRewardGrantStrategy implements SectRewardGrantStrategy {
  readonly key = 'pill';

  async grant(context: SectRewardGrantContext): Promise<void> {
    if (
      context.grant.kind !== this.key ||
      !context.grant.spec ||
      !context.grant.quality
    )
      organizationError('宗门丹药奖励配置不匹配', 500);
    await context.rewards.grantPill(context.userId, context.cultivatorId, {
      id: context.ids.next(),
      name: context.grant.name,
      quality: context.grant.quality,
      description: context.grant.description,
      prompt: context.source === 'sect_stipend' ? '宗门弟子周俸' : '宗门宝库制式丹药',
      spec: context.grant.spec,
      quantity: context.quantity,
    });
  }
}

export interface SectDonationExecutionContext {
  cultivatorId: string;
  itemId?: string;
  units: number;
  itemQuantity: number;
  demand: SectDonationDemandDefinition;
  inventory: SectInventoryGateway;
  economy: Pick<SectEconomyRepository, 'spendSpiritStones'>;
}

export interface SectDonationSpecification {
  readonly key: string;
  consume(context: SectDonationExecutionContext): Promise<Record<string, unknown>>;
}

export class SectDonationSpecificationRegistry {
  private readonly specifications = new Map<string, SectDonationSpecification>();

  constructor(specifications: readonly SectDonationSpecification[] = []) {
    for (const specification of specifications) this.register(specification);
  }

  register(specification: SectDonationSpecification): void {
    if (this.specifications.has(specification.key))
      throw new Error(`重复的宗门捐献规格：${specification.key}`);
    this.specifications.set(specification.key, specification);
  }

  has(key: string): boolean {
    return this.specifications.has(key);
  }

  require(key: string): SectDonationSpecification {
    const specification = this.specifications.get(key);
    if (!specification) organizationError(`尚未注册宗门捐献规格：${key}`, 500);
    return specification;
  }
}

export class SpiritStoneDonationSpecification implements SectDonationSpecification {
  readonly key = 'spirit_stones';

  async consume(context: SectDonationExecutionContext) {
    const amount = context.itemQuantity;
    if (!(await context.economy.spendSpiritStones(context.cultivatorId, amount)))
      organizationError('灵石不足', 400);
    return { kind: this.key, units: context.units, amount };
  }
}

export class MaterialDonationSpecification implements SectDonationSpecification {
  readonly key = 'material';
  private readonly specification = new MaterialDeliverySpecification();

  async consume(context: SectDonationExecutionContext) {
    if (!context.itemId) organizationError('请选择要捐献的材料', 400);
    const item = await context.inventory.findMaterial(context.cultivatorId, context.itemId);
    if (!item || item.type !== 'herb') organizationError('该需求只接收灵草', 400);
    const amount = context.itemQuantity;
    const violations = this.specification.violations(item, {
      quantity: amount,
      minQuality: (context.demand.minQuality ?? '凡品') as Quality,
    });
    if (violations.length) organizationError(violations[0]!, 400);
    if (!(await context.inventory.consumeMaterial(item.id, amount)))
      organizationError('材料数量不足', 400);
    return { kind: this.key, units: context.units, itemId: item.id, name: item.name, amount };
  }
}

export class PillDonationSpecification implements SectDonationSpecification {
  readonly key = 'pill';
  private readonly specification = new PillDeliverySpecification();

  async consume(context: SectDonationExecutionContext) {
    if (!context.itemId) organizationError('请选择要捐献的丹药', 400);
    const item = await context.inventory.findConsumable(context.cultivatorId, context.itemId);
    if (!item) organizationError('该物品不是有效丹药', 400);
    const amount = context.itemQuantity;
    const violations = this.specification.violations(item, {
      quantity: amount,
      minQuality: (context.demand.minQuality ?? '凡品') as Quality,
      pillFamily: context.demand.pillFamily,
    });
    if (violations.length) organizationError(violations[0]!, 400);
    if (!(await context.inventory.consumeConsumable(item.id, amount)))
      organizationError('丹药数量不足', 400);
    return { kind: this.key, units: context.units, itemId: item.id, name: item.name, amount };
  }
}

export class ArtifactDonationSpecification implements SectDonationSpecification {
  readonly key = 'artifact';
  private readonly specification = new ArtifactDeliverySpecification();

  async consume(context: SectDonationExecutionContext) {
    if (!context.itemId) organizationError('请选择要捐献的法宝', 400);
    const item = await context.inventory.findArtifact(context.cultivatorId, context.itemId);
    if (!item) organizationError('未找到该法宝', 400);
    const amount = context.itemQuantity;
    const violations = this.specification.violations(item, {
      quantity: amount,
      minQuality: (context.demand.minQuality ?? '凡品') as Quality,
    });
    if (violations.length) organizationError(violations[0]!, 400);
    if (!(await context.inventory.consumeArtifact(item.id)))
      organizationError('法宝状态已变化，请重试', 400);
    return {
      kind: this.key,
      units: context.units,
      itemId: item.id,
      name: item.name,
      quality: item.quality,
    };
  }
}
