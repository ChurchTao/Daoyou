import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import type {
  SectMemberData,
  SectOverviewData,
} from '@shared/contracts/sect';
import {
  getEffectiveSectMethodLevelCap,
  getSectFacilityBonus,
  realmMeetsSectRank,
  type SectDiscipleRank,
} from '@shared/engine/sect';
import type { Cultivator } from '@shared/types/cultivator';
import { getSectWeekKey } from './SectOrganizationClock';
import {
  mapFacilities,
  mapProject,
  nextRank,
  organizationError,
  organizationFor,
  requireMembership,
  type SectMembership,
  type SectOrganizationContext,
} from './SectOrganizationSupport';
import type { SectBenefitService } from './SectBenefitService';

export class SectMembershipApplicationService {
  constructor(
    private readonly context: SectOrganizationContext,
    private readonly benefits: SectBenefitService,
  ) {}

  private async getPromotionMissing(
    membership: SectMembership,
    realm: Cultivator['realm'],
    stage: Cultivator['realm_stage'],
    q: DbExecutor | DbTransaction,
  ): Promise<string[]> {
    const target = nextRank(membership.discipleRank as SectDiscipleRank);
    if (!target) return [];
    const organization = organizationFor(this.context, membership.sectId);
    const requirement = organization.ranks.requirement(target);
    const missing: string[] = [];
    if (!realmMeetsSectRank(realm, stage, requirement.minRealm))
      missing.push(`境界达到${requirement.minRealm}`);
    if (membership.contribution < requirement.contribution)
      missing.push(`当前贡献达到${requirement.contribution}`);
    if (requirement.dailyCompletions) {
      const completed =
        await this.context.organizationRepository.countCompletedDailySectTasks(
          membership.id,
          q,
        );
      if (completed < requirement.dailyCompletions)
        missing.push(
          `完成宗门日常 ${completed}/${requirement.dailyCompletions}`,
        );
    }
    const requiredRoles = [
      [requirement.requiresTournament, 'promotion_tournament', '完成一次宗门小比'],
      [requirement.requiresBounty, 'promotion_bounty', '完成一次悬赏令'],
      [requirement.requiresElderTrial, 'promotion_elder_trial', '通过长老试炼'],
    ] as const;
    for (const [required, role, label] of requiredRoles) {
      const task = organization.tasks.findByRole(role);
      if (
        required &&
        task &&
        !(await this.context.organizationRepository.hasCompletedSectTask(
          membership.id,
          task.id,
          q,
        ))
      )
        missing.push(label);
    }
    return missing;
  }

  async getOverview(
    cultivator: Pick<Cultivator, 'id' | 'realm' | 'realm_stage'>,
    realmMethodLevelCap: number,
    q: DbExecutor = getExecutor(),
  ): Promise<SectOverviewData> {
    const membership = await requireMembership(this.context, cultivator.id!, q);
    const sect =
      await this.context.membershipRepository.loadCultivatorSectState(
        cultivator.id!,
        q,
      );
    if (!sect) organizationError('宗门状态不存在');
    const facilities = mapFacilities(
      await this.context.organizationRepository.listSectFacilities(
        membership.sectId,
        q,
      ),
    );
    const project = mapProject(
      await this.context.organizationRepository.findActiveSectProject(
        membership.sectId,
        q,
      ),
    );
    const level = (key: string) =>
      facilities.find((item) => item.key === key)?.level ?? 1;
    const rank = sect.discipleRank ?? 'registered';
    const weekKey = getSectWeekKey();
    const economy = organizationFor(this.context, membership.sectId).economy;
    const stipendRewards = economy.stipendRewards(rank, level('herb_garden'));
    return {
      sect,
      facilities,
      project,
      realmMethodLevelCap,
      methodLevelCap: getEffectiveSectMethodLevelCap({
        realmCap: realmMethodLevelCap,
        rank,
        archiveLevel: level('archive'),
        rankCap: organizationFor(this.context, membership.sectId).ranks.methodLevelCap(
          rank,
        ),
      }),
      stipend: {
        weekKey,
        claimed:
          await this.context.organizationRepository.hasClaimedSectStipend(
            membership.id,
            weekKey,
            q,
          ),
        spiritStones: Math.floor(
          economy.stipendBase(rank) *
            (1 + getSectFacilityBonus('spirit_vein', level('spirit_vein'))),
        ),
        herbQuantity: stipendRewards.herbQuantity,
        bonusRewards: [...stipendRewards.bonusRewards],
      },
      nextRank: nextRank(rank),
      promotionMissing: await this.getPromotionMissing(
        membership,
        cultivator.realm,
        cultivator.realm_stage,
        q,
      ),
      permissions: this.benefits.permissionSnapshot(membership),
    };
  }

  async promote(
    cultivator: Pick<Cultivator, 'id' | 'realm' | 'realm_stage'>,
    tx: DbTransaction,
  ) {
    const membership = await requireMembership(this.context, cultivator.id!, tx);
    const target = nextRank(membership.discipleRank as SectDiscipleRank);
    if (!target) organizationError('已是真传弟子');
    const missing = await this.getPromotionMissing(
      membership,
      cultivator.realm,
      cultivator.realm_stage,
      tx,
    );
    if (missing.length) organizationError(`尚需：${missing.join('、')}`, 400);
    await this.context.organizationRepository.promoteSectMembership(
      membership.id,
      target,
      tx,
    );
    return this.context.membershipRepository.loadCultivatorSectState(
      cultivator.id!,
      tx,
    );
  }

  async listMembers(
    cultivatorId: string,
    page: number,
    pageSize: number,
    q: DbExecutor = getExecutor(),
  ) {
    const membership = await requireMembership(this.context, cultivatorId, q);
    const result = await this.context.organizationRepository.listSectMembers(
      membership.sectId,
      page,
      pageSize,
      q,
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
