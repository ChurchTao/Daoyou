import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import type {
  SectMemberData,
  SectContextData,
  SectInfrastructureData,
  SectPromotionEvaluationData,
  SectStipendData,
} from '@shared/contracts/sect';
import {
  PromotionRequirementSpecification,
  SectMembership,
} from '@shared/engine/sect';
import type { Cultivator } from '@shared/types/cultivator';
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
  SectMembershipCommandContext,
  SectMembershipQueryContext,
  SectMembershipRecord,
} from './ports';
import { getOnlineCultivatorIds } from '@server/lib/services/onlinePresenceService';

const SHANGHAI_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function shanghaiDayNumber(date: Date): number {
  const parts = Object.fromEntries(
    SHANGHAI_DATE_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day) / (24 * 60 * 60 * 1000),
  );
}

function resolveActivityState(
  lastActiveAt: Date | null | undefined,
  online: boolean,
  now: Date,
): SectMemberData['activityState'] {
  if (online) return 'online';
  if (!lastActiveAt) return 'inactive';
  const elapsedDays = shanghaiDayNumber(now) - shanghaiDayNumber(lastActiveAt);
  if (elapsedDays <= 0) return 'active_today';
  if (elapsedDays <= 6) return 'active_7d';
  return 'inactive';
}

export class SectMembershipApplicationService {
  constructor(
    private readonly benefits: SectBenefitService,
    private readonly events: SectDomainEventDispatcherFactory,
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
      const tasks = organization.tasks.listByCompletionTag(required.tag);
      let hasCompletedTag = false;
      for (const task of tasks) {
        if (
          await context.memberships.hasCompletedTask(membership.id, task.id)
        ) {
          hasCompletedTag = true;
          break;
        }
      }
      if (hasCompletedTag) completedTaskTags.add(required.tag);
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
          lifetimeContribution: membership.lifetimeContribution,
          dailyCompletions,
          completedTaskTags,
        },
        requirement,
      )
      .map((item) => item.message);
  }

  async getInfrastructureResource(
    cultivatorId: string,
    context: SectMembershipQueryContext,
  ): Promise<SectInfrastructureData> {
    const membership = await requireMembership(
      cultivatorId,
      context.memberships,
    );
    const organization = organizationFor(context.modules, membership.sectId);
    return {
      facilities: mapFacilities(
        await context.facilities.list(membership.sectId),
        organization,
      ),
    };
  }

  async getStipendResource(
    cultivatorId: string,
    context: SectMembershipQueryContext,
  ): Promise<SectStipendData> {
    const membership = await requireMembership(
      cultivatorId,
      context.memberships,
    );
    const organization = organizationFor(context.modules, membership.sectId);
    const facilities = mapFacilities(
      await context.facilities.list(membership.sectId),
      organization,
    );
    const facilityLevels = new Map(
      facilities.map((item) => [item.key as string, item.level]),
    );
    const stipend = quoteSectStipend(
      organization,
      membership.discipleRank,
      facilityLevels,
    );
    const weekKey = context.clock.weekKey();
    return {
      weekKey,
      claimed: await context.economy.hasClaimedStipend(membership.id, weekKey),
      spiritStones: stipend.spiritStones,
    };
  }

  async getPromotionEvaluationResource(
    cultivator: Pick<Cultivator, 'id' | 'realm' | 'realm_stage'>,
    context: SectMembershipQueryContext,
  ): Promise<SectPromotionEvaluationData> {
    const membership = await requireMembership(
      cultivator.id!,
      context.memberships,
    );
    const organization = organizationFor(context.modules, membership.sectId);
    const nextRank = organization.ranks.nextRank(membership.discipleRank);
    const missing = await this.getPromotionMissing(
      membership,
      cultivator.realm,
      cultivator.realm_stage,
      context,
    );
    return {
      nextRank,
      missing,
      allowed: Boolean(nextRank && missing.length === 0),
      contribution: membership.contribution,
      lifetimeContribution: membership.lifetimeContribution,
    };
  }

  async promote(
    cultivator: Pick<Cultivator, 'id' | 'realm' | 'realm_stage'>,
    context: SectMembershipCommandContext,
  ) {
    const membership = await requireMembership(
      cultivator.id!,
      context.memberships,
    );
    this.benefits.assertPermission(
      membership,
      'sect.hall.view',
      context.modules,
    );
    const target = organizationFor(
      context.modules,
      membership.sectId,
    ).ranks.nextRank(membership.discipleRank);
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
    if (!evaluation.allowed)
      organizationError(`尚需：${missing.join('、')}`, 400);
    aggregate.promote(target, evaluation);
    await this.events.forMembership(context).dispatch(aggregate.pullEvents());
    const result = await context.memberships.loadState(cultivator.id!);
    if (!result) organizationError('晋升后的宗门身份不存在', 500);
    const discipleRank = result.discipleRank ?? 'registered';
    const organization = organizationFor(context.modules, result.sectId);
    const membershipResource = {
      sectId: result.sectId,
      membershipId: result.membershipId,
      status: result.status,
      joinedAt: result.joinedAt,
      discipleRank,
      contribution: result.contribution,
      lifetimeContribution:
        result.lifetimeContribution ?? result.contribution,
      office: result.office ?? 'none',
      promotedAt: result.promotedAt,
      permissions: organization.capabilities.snapshot(discipleRank),
      configVersion: result.configVersion,
    } satisfies SectContextData;
    return {
      result,
      resourceChanges: [
        {
          resourceTopic: 'sect.membership',
          eventType: 'sect.promoted',
          operation: 'replace',
          payload: membershipResource,
        },
        {
          scope: { kind: 'sect', id: result.sectId },
          resourceTopic: 'sect.members',
          eventType: 'sect.member_promoted',
          operation: 'invalidate',
        },
      ] satisfies ResourceChangeDescriptor[],
    };
  }

  async listMembers(
    cultivatorId: string,
    page: number,
    pageSize: number,
    context: SectMembershipQueryContext,
  ) {
    const membership = await requireMembership(
      cultivatorId,
      context.memberships,
    );
    this.benefits.assertPermission(
      membership,
      'sect.hall.view',
      context.modules,
    );
    const result = await context.memberships.listMembers(
      membership.sectId,
      page,
      pageSize,
    );
    const onlineIds = await getOnlineCultivatorIds(
      result.rows.map((row) => row.cultivatorId),
    );
    const now = new Date();
    return {
      items: result.rows.map((row): SectMemberData => ({
        cultivatorId: row.cultivatorId,
        name: row.name,
        realm: row.realm,
        realmStage: row.realmStage,
        discipleRank: row.discipleRank,
        office: row.office,
        joinedAt: row.joinedAt?.toISOString(),
        activityState: resolveActivityState(
          row.lastActiveAt,
          onlineIds.has(row.cultivatorId),
          now,
        ),
      })),
      page,
      pageSize,
      total: result.total,
    };
  }
}
