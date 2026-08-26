import { getSectConstructionDailyStatus } from '@server/lib/redis/sectConstructionDaily';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import type { SectConstructionMemberData } from '@shared/contracts/sect';
import { quoteSectConstructionDonation } from '@shared/engine/sect';
import type { SectBenefitService } from './SectBenefitService';
import {
  organizationError,
  organizationFor,
  requireMembership,
} from './applicationSupport';
import type {
  SectConstructionCommandContext,
  SectConstructionQueryContext,
} from './ports';

export class SectConstructionApplicationService {
  constructor(private readonly benefits: SectBenefitService) {}

  async getConstructionMember(
    userId: string,
    cultivatorId: string,
    context: SectConstructionQueryContext,
  ): Promise<SectConstructionMemberData> {
    const membership = await requireMembership(
      cultivatorId,
      context.memberships,
    );
    this.benefits.assertPermission(
      membership,
      'sect.construction.view',
      context.modules,
    );
    return getSectConstructionDailyStatus(userId, context.clock.dateKey());
  }

  async donate(
    cultivatorId: string,
    input: {
      facilityKey: string;
      spiritStones: number;
      referenceId: string;
      dailyStatus: SectConstructionMemberData;
    },
    context: SectConstructionCommandContext,
  ) {
    const membership = await requireMembership(
      cultivatorId,
      context.memberships,
    );
    this.benefits.assertPermission(
      membership,
      'sect.construction.donate',
      context.modules,
    );
    const organization = organizationFor(context.modules, membership.sectId);
    const definition = organization.construction.facilities.find(
      (facility) => facility.key === input.facilityKey,
    );
    if (!definition || !definition.upgradeable)
      organizationError('该设施不可建设', 400);

    const quote = quoteSectConstructionDonation(input.spiritStones);
    await context.facilities.ensure(membership.sectId);
    const facility = (await context.facilities.list(membership.sectId)).find(
      (candidate) => candidate.facilityKey === input.facilityKey,
    );
    if (!facility) organizationError('宗门设施不存在', 404);
    if (facility.level >= definition.maxLevel)
      organizationError('该设施已满级', 400);

    const spent = await context.economy.spendSpiritStones(
      cultivatorId,
      quote.spiritStones,
    );
    if (!spent.spent || spent.balance === undefined)
      organizationError('灵石不足', 400);

    const contribution = await context.construction.grantContribution(
      membership.id,
      quote.contribution,
      'construction_donation',
      input.referenceId,
    );
    const event = await context.events.create({
      type: 'sect.construction.donated',
      aggregate: { type: 'sect', id: membership.sectId },
      data: {
        cultivatorId,
        sectId: membership.sectId,
        facilityKey: input.facilityKey,
        spiritStones: quote.spiritStones,
        constructionPoints: quote.constructionPoints,
        contribution: quote.contribution,
        referenceId: input.referenceId,
      },
      deduplicationKey: `${cultivatorId}:${input.referenceId}`,
    });
    return {
      result: {
        eventId: event.id,
        member: input.dailyStatus,
      },
      resourceChanges: [
        {
          resourceTopic: 'sect.construction-member',
          eventType: 'sect.construction_daily_changed',
          operation: 'replace',
          payload: input.dailyStatus,
        },
        {
          resourceTopic: 'sect.membership',
          eventType: 'sect.construction_contribution_granted',
          operation: 'merge',
        payload: {
          contribution: contribution.contribution,
          lifetimeContribution: contribution.lifetimeContribution,
        },
        },
        {
          resourceTopic: 'player.currency',
          eventType: 'sect.construction_currency_spent',
          operation: 'merge',
          payload: { spiritStones: spent.balance },
        },
      ] satisfies ResourceChangeDescriptor[],
    };
  }
}
