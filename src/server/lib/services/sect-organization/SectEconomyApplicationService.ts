import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { SectMembership, SectStipendClaim } from '@shared/engine/sect';
import type { RealmType } from '@shared/types/constants';
import {
  buySectShopItem,
  listSectShopItems,
} from '@server/lib/services/SectShopService';
import type { SectBenefitService } from './SectBenefitService';
import type { SectDomainEventDispatcherFactory } from './SectDomainEventDispatcher';
import {
  mapFacilities,
  organizationError,
  organizationFor,
  quoteSectStipend,
  requireMembership,
} from './applicationSupport';
import type {
  SectEconomyCommandContext,
  SectEconomyQueryContext,
  SectMembershipRecord,
} from './ports';
import {
  emptySectCommandEffects,
  type SectCommandEffects,
} from './SectCommandEffects';

export class SectEconomyApplicationService {
  constructor(
    private readonly benefits: SectBenefitService,
    private readonly events: SectDomainEventDispatcherFactory,
  ) {}

  async getShop(cultivatorId: string, context: SectEconomyQueryContext) {
    const membership = await requireMembership(
      cultivatorId,
      context.memberships,
    );
    this.benefits.assertPermission(
      membership,
      'sect.shop.use',
      context.modules,
    );
    const weekKey = context.clock.weekKey();
    const items = await listSectShopItems({
      cultivatorId,
      purchaseWeek: weekKey,
      userVisibleOnly: true,
      q: context.q,
    });
    return { weekKey, contribution: membership.contribution, items };
  }

  async purchaseShopItem(
    userId: string,
    cultivatorId: string,
    itemId: string,
    context: SectEconomyCommandContext,
  ) {
    const membership = await requireMembership(
      cultivatorId,
      context.memberships,
    );
    this.benefits.assertPermission(
      membership,
      'sect.shop.use',
      context.modules,
    );
    const weekKey = context.clock.weekKey();
    let spentEffects = emptySectCommandEffects();
    const purchase = await buySectShopItem({
      id: itemId,
      userId,
      cultivatorId,
      membershipId: membership.id,
      purchaseWeek: weekKey,
      tx: context.q,
      spendContribution: async (cost) => {
        spentEffects = await this.spendContribution(
          membership,
          cost,
          `${weekKey}:${itemId}`,
          context,
        );
      },
    });
    const result = await this.getShop(cultivatorId, context);
    const resourceChanges: ResourceChangeDescriptor[] = [
      {
        resourceTopic: 'sect.shop',
        eventType: 'sect.shop_purchased',
        operation: 'replace',
        payload: result,
      },
      ...spentEffects.resourceChanges,
    ];
    for (const change of purchase.settlement.inventoryChanges) {
      resourceChanges.push(
        change.operation === 'upsert'
          ? ({
              resourceTopic: `inventory.${change.kind}`,
              eventType: 'inventory.sect_shop.rewarded',
              operation: 'upsert-items',
              payload: { idKey: 'id', items: [change.item] },
            } as ResourceChangeDescriptor)
          : ({
              resourceTopic: `inventory.${change.kind}`,
              eventType: 'inventory.sect_shop.rewarded',
              operation: 'remove-items',
              payload: { idKey: 'id', ids: [change.id] },
            } as ResourceChangeDescriptor),
      );
    }
    return {
      result: {
        purchasedItem: purchase.item,
        contribution: result.contribution,
      },
      resourceChanges,
    };
  }

  private async spendContribution(
    membership: SectMembershipRecord,
    amount: number,
    referenceId: string,
    context: SectEconomyCommandContext,
  ): Promise<SectCommandEffects> {
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
    return this.events.forShop(context).dispatch(aggregate.pullEvents());
  }

  async claimStipend(
    cultivator: { id: string; realm: RealmType },
    context: SectEconomyCommandContext,
  ) {
    const membership = await requireMembership(
      cultivator.id,
      context.memberships,
    );
    this.benefits.assertPermission(
      membership,
      'sect.hall.view',
      context.modules,
    );
    await context.facilities.ensure(membership.sectId);
    const organization = organizationFor(context.modules, membership.sectId);
    const facilities = mapFacilities(
      await context.facilities.list(membership.sectId),
      organization,
    );
    const facilityLevels = new Map(
      facilities.map((item) => [item.key as string, item.level]),
    );
    const quote = quoteSectStipend(
      organization,
      membership.discipleRank,
      cultivator.realm,
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
    const effects = await this.events
      .forStipend({
        cultivatorId: cultivator.id,
        command: context,
      })
      .dispatch(claim.pullEvents());
    const result = {
      weekKey,
      spiritStones: quote.spiritStones,
    };
    return {
      result,
      resourceChanges: [
        ...effects.resourceChanges,
      ] satisfies ResourceChangeDescriptor[],
    };
  }
}
