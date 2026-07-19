import type { SectMemberData, SectOverviewData } from '@shared/contracts/sect';
import {
  getEffectiveSectMethodLevelCap,
  PromotionRequirementSpecification,
  SectMembership,
} from '@shared/engine/sect';
import type { Cultivator } from '@shared/types/cultivator';
import type { SectBenefitService } from './SectBenefitService';
import {
  mapFacilities,
  mapProject,
  organizationError,
  organizationFor,
  quoteSectStipend,
  requireMembership,
  stipendRewardView,
} from './applicationSupport';
import type { SectDomainEventDispatcher } from './SectDomainEventDispatcher';
import type {
  SectMembershipCommandContext,
  SectMembershipQueryContext,
  SectMembershipRecord,
} from './ports';

export class SectMembershipApplicationService {
  constructor(
    private readonly benefits: SectBenefitService,
    private readonly events: SectDomainEventDispatcher,
  ) {}

  private async getPromotionMissing(
    membership: SectMembershipRecord,
    realm: Cultivator['realm'],
    stage: Cultivator['realm_stage'],
    context: SectMembershipQueryContext,
  ): Promise<string[]> {
    const organization = organizationFor(context.modules, membership.sectId);
    const target = organization.ranks.nextRank(membership.discipleRank);
    if (!target || target === 'registered') return [];
    const requirement = organization.ranks.requirement(target);
    const completedTaskTags = new Set<string>();
    for (const required of requirement.requiredTaskTags ?? []) {
      const task = organization.tasks.findByCompletionTag(required.tag);
      if (
        task &&
        (await context.memberships.hasCompletedTask(membership.id, task.id))
      )
        completedTaskTags.add(required.tag);
    }
    const dailyCompletions = requirement.dailyCompletions
      ? await context.memberships.countCompletedDailyTasks(membership.id)
      : 0;
    return new PromotionRequirementSpecification()
      .violations(
        {
          realm,
          stage,
          contribution: membership.contribution,
          dailyCompletions,
          completedTaskTags,
        },
        requirement,
      )
      .map((item) => item.message);
  }

  async getOverview(
    cultivator: Pick<Cultivator, 'id' | 'realm' | 'realm_stage'>,
    realmMethodLevelCap: number,
    context: SectMembershipQueryContext,
  ): Promise<SectOverviewData> {
    const membership = await requireMembership(cultivator.id!, context.memberships);
    const sect = await context.memberships.loadState(cultivator.id!);
    if (!sect) organizationError('宗门状态不存在');
    const facilities = mapFacilities(await context.facilities.list(membership.sectId));
    const project = mapProject(
      await context.construction.findActiveProject(membership.sectId),
    );
    const rank = sect.discipleRank ?? 'registered';
    const weekKey = context.clock.weekKey();
    const organization = organizationFor(context.modules, membership.sectId);
    const facilityLevels = new Map(
      facilities.map((item) => [item.key as string, item.level]),
    );
    const stipend = quoteSectStipend(
      organization,
      rank,
      facilityLevels,
    );
    return {
      sect,
      facilities,
      project,
      realmMethodLevelCap,
      methodLevelCap: getEffectiveSectMethodLevelCap({
        realmCap: realmMethodLevelCap,
        rank,
        facilityCap: organization.benefits.methodLevelCap(facilityLevels),
        rankCap: organization.ranks.methodLevelCap(rank),
      }),
      stipend: {
        weekKey,
        claimed: await context.economy.hasClaimedStipend(membership.id, weekKey),
        spiritStones: stipend.spiritStones,
        rewards: stipend.rewards.map(stipendRewardView),
      },
      nextRank: organization.ranks.nextRank(rank),
      promotionMissing: await this.getPromotionMissing(
        membership,
        cultivator.realm,
        cultivator.realm_stage,
        context,
      ),
      permissions: this.benefits.permissionSnapshot(membership, context.modules),
    };
  }

  async promote(
    cultivator: Pick<Cultivator, 'id' | 'realm' | 'realm_stage'>,
    context: SectMembershipCommandContext,
  ) {
    const membership = await requireMembership(cultivator.id!, context.memberships);
    const target = organizationFor(context.modules, membership.sectId).ranks.nextRank(
      membership.discipleRank,
    );
    if (!target || target === 'registered') organizationError('已是真传弟子');
    const missing = await this.getPromotionMissing(
      membership,
      cultivator.realm,
      cultivator.realm_stage,
      context,
    );
    const aggregate = SectMembership.rehydrate({
      id: membership.id,
      sectId: membership.sectId,
      rank: membership.discipleRank,
      contribution: membership.contribution,
    });
    const evaluation = aggregate.evaluatePromotion(
      missing.map((message) => ({ code: 'promotion_requirement', message })),
    );
    if (!evaluation.allowed) organizationError(`尚需：${missing.join('、')}`, 400);
    aggregate.promote(target, evaluation);
    await this.events.dispatch(aggregate.pullEvents(), {
      scope: 'membership',
      command: context,
    });
    return context.memberships.loadState(cultivator.id!);
  }

  async listMembers(
    cultivatorId: string,
    page: number,
    pageSize: number,
    context: SectMembershipQueryContext,
  ) {
    const membership = await requireMembership(cultivatorId, context.memberships);
    const result = await context.memberships.listMembers(
      membership.sectId,
      page,
      pageSize,
    );
    return {
      items: result.rows.map(
        (row): SectMemberData => ({
          ...row,
          joinedAt: row.joinedAt?.toISOString(),
        }),
      ),
      page,
      pageSize,
      total: result.total,
    };
  }
}
