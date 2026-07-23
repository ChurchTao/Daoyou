import type { SectShopItemData } from '@shared/contracts/sect';
import {
  hasSectRank,
  SectMembership,
  SectShopOrder,
  SectStipendClaim,
} from '@shared/engine/sect';
import type { SectBenefitService } from './SectBenefitService';
import type { SectRewardGrantStrategyRegistry } from './EconomyStrategies';
import {
  assertDeclaredRewardKind,
  mapFacilities,
  organizationError,
  organizationFor,
  quoteSectStipend,
  requireMembership,
  stipendRewardView,
} from './applicationSupport';
import type { SectDomainEventDispatcherFactory } from './SectDomainEventDispatcher';
import type {
  SectEconomyCommandContext,
  SectEconomyQueryContext,
  SectMembershipRecord,
} from './ports';

export class SectEconomyApplicationService {
  constructor(
    private readonly benefits: SectBenefitService,
    private readonly rewardStrategies: SectRewardGrantStrategyRegistry,
    private readonly events: SectDomainEventDispatcherFactory,
  ) {}

  async getShop(cultivatorId: string, context: SectEconomyQueryContext) {
    const membership = await requireMembership(cultivatorId, context.memberships);
    this.benefits.assertPermission(membership, 'sect.shop.use', context.modules);
    const weekKey = context.clock.weekKey();
    const items: SectShopItemData[] = [];
    const organization = organizationFor(context.modules, membership.sectId);
    for (const item of organization.economy.shopItems(weekKey)) {
      assertDeclaredRewardKind(organization, item.grant.kind);
      if (!hasSectRank(membership.discipleRank, item.requiredRank)) continue;
      items.push({
        id: item.id,
        name: item.grant.name,
        description: item.grant.description,
        requiredRank: item.requiredRank,
        price: item.price,
        stock: item.stock,
        purchased: await context.economy.purchasedQuantity(
          membership.id,
          weekKey,
          item.id,
        ),
        kind: item.grant.kind,
        rotating: item.rotating,
      });
    }
    return { weekKey, contribution: membership.contribution, items };
  }

  async purchaseShopItem(
    userId: string,
    cultivatorId: string,
    itemId: string,
    quantity: number,
    context: SectEconomyCommandContext,
  ) {
    const membership = await requireMembership(cultivatorId, context.memberships);
    this.benefits.assertPermission(membership, 'sect.shop.use', context.modules);
    const weekKey = context.clock.weekKey();
    const organization = organizationFor(context.modules, membership.sectId);
    const item = organization.economy.shopItems(weekKey)
      .find((entry) => entry.id === itemId);
    if (!item) organizationError('本周宝库没有该物品', 400);
    assertDeclaredRewardKind(organization, item.grant.kind);
    if (!hasSectRank(membership.discipleRank, item.requiredRank))
      organizationError('弟子职阶不足', 400);
    const purchased = await context.economy.purchasedQuantity(
      membership.id,
      weekKey,
      item.id,
    );
    let order: SectShopOrder;
    try {
      order = SectShopOrder.quote({
        itemId: item.id,
        quantity,
        purchased,
        stock: item.stock,
        unitPrice: item.price,
      });
    } catch (error) {
      organizationError(error instanceof Error ? error.message : '兑换请求无效', 400);
    }

    await this.spendContribution(
      membership,
      order.totalCost,
      `${weekKey}:${item.id}`,
      context,
    );
    if (
      !(await context.economy.recordPurchase(
        membership.id,
        weekKey,
        item.id,
        order.quantity,
      ))
    )
      organizationError('该笔兑换已经处理');
    await this.rewardStrategies.require(item.grant.kind).grant({
      userId,
      cultivatorId,
      quantity: order.quantity,
      grant: item.grant,
      rewards: context.rewards,
      ids: context.ids,
      source: 'sect_shop',
    });
    return this.getShop(cultivatorId, context);
  }

  private async spendContribution(
    membership: SectMembershipRecord,
    amount: number,
    referenceId: string,
    context: SectEconomyCommandContext,
  ): Promise<void> {
    const aggregate = SectMembership.rehydrate({
      id: membership.id,
      sectId: membership.sectId,
      rank: membership.discipleRank,
      contribution: membership.contribution,
    });
    try {
      aggregate.spendContribution(amount, 'sect_shop', referenceId);
    } catch {
      organizationError('宗门贡献不足', 400);
    }
    await this.events.forShop(context).dispatch(aggregate.pullEvents());
  }

  async claimStipend(
    userId: string,
    cultivatorId: string,
    context: SectEconomyCommandContext,
  ) {
    const membership = await requireMembership(cultivatorId, context.memberships);
    this.benefits.assertPermission(membership, 'sect.hall.view', context.modules);
    await context.facilities.ensure(membership.sectId);
    const facilities = mapFacilities(await context.facilities.list(membership.sectId));
    const facilityLevels = new Map(
      facilities.map((item) => [item.key as string, item.level]),
    );
    const organization = organizationFor(context.modules, membership.sectId);
    const quote = quoteSectStipend(
      organization,
      membership.discipleRank,
      facilityLevels,
    );
    const weekKey = context.clock.weekKey();
    const claim = SectStipendClaim.rehydrate({
      membershipId: membership.id,
      weekKey,
      claimed: await context.economy.hasClaimedStipend(membership.id, weekKey),
    });
    try {
      claim.claim(weekKey, quote);
    } catch {
      organizationError('本周俸禄已经领取');
    }
    await this.events.forStipend({
      userId,
      cultivatorId,
      command: context,
    }).dispatch(claim.pullEvents());
    return {
      weekKey,
      rewards: quote.rewards.map(stipendRewardView),
    };
  }
}
