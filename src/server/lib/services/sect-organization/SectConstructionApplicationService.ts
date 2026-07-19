import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import type { SectConstructionData } from '@shared/contracts/sect';
import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
import { isPillSpec } from '@shared/lib/consumables';
import type { SectBenefitService } from './SectBenefitService';
import { getSectDateKey, getSectWeekKey } from './SectOrganizationClock';
import {
  mapFacilities,
  mapProject,
  organizationError,
  organizationFor,
  requireMembership,
  type SectOrganizationContext,
} from './SectOrganizationSupport';

export class SectConstructionApplicationService {
  constructor(
    private readonly context: SectOrganizationContext,
    private readonly benefits: SectBenefitService,
  ) {}

  private async ensureCurrentProject(
    sectId: string,
    q: DbExecutor | DbTransaction,
  ) {
    const repository = this.context.organizationRepository;
    await repository.ensureSectFacilities(sectId, q);
    const active = await repository.findActiveSectProject(sectId, q);
    if (active) return mapProject(active);
    const weekKey = getSectWeekKey();
    const latest = await repository.findLatestCompletedSectProject(sectId, q);
    if (latest?.completedAt && getSectWeekKey(latest.completedAt) === weekKey)
      return null;
    const facilities = await repository.listSectFacilities(sectId, q);
    const levels = new Map(facilities.map((row) => [row.facilityKey, row.level]));
    const policy = organizationFor(this.context, sectId).construction;
    const priority = [...policy.facilityPriority];
    const candidate = priority
      .filter((key) => (levels.get(key) ?? 1) < 5)
      .sort((a, b) => {
        const levelDiff = (levels.get(a) ?? 1) - (levels.get(b) ?? 1);
        return levelDiff || priority.indexOf(a) - priority.indexOf(b);
      })[0];
    if (!candidate) return null;
    const targetLevel = (levels.get(candidate) ?? 1) + 1;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeMembers = Math.max(
      1,
      Math.min(
        100,
        await repository.countRecentlyActiveSectMembers(sectId, since, q),
      ),
    );
    return mapProject(
      await repository.createSectProject(
        {
          sectId,
          facilityKey: candidate,
          targetLevel,
          target: policy.projectBaseTarget(targetLevel) * activeMembers,
          startedWeekKey: weekKey,
        },
        q,
      ),
    );
  }

  async ensureWeeklyProject(
    sectId: string,
    q: DbExecutor = getExecutor(),
  ) {
    return this.ensureCurrentProject(sectId, q);
  }

  async getConstruction(
    cultivatorId: string,
    q: DbExecutor = getExecutor(),
  ): Promise<SectConstructionData> {
    const membership = await requireMembership(this.context, cultivatorId, q);
    this.benefits.assertPermission(membership, 'scene.industries');
    const repository = this.context.organizationRepository;
    return {
      facilities: mapFacilities(
        await repository.listSectFacilities(membership.sectId, q),
      ),
      project: mapProject(
        await repository.findActiveSectProject(membership.sectId, q),
      ),
      demands: [
        ...organizationFor(this.context, membership.sectId).economy.donationDemands(
          membership.sectId,
          getSectDateKey(),
        ),
      ],
      donatedContributionToday:
        await repository.sumSectDonationContributionForDate(
          membership.id,
          getSectDateKey(),
          q,
        ),
      dailyContributionCap: organizationFor(this.context, membership.sectId)
        .economy.donationDailyCap,
      recentActivity: (
        await repository.listRecentSectDonations(membership.sectId, 12, q)
      ).map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    };
  }

  async donate(
    cultivatorId: string,
    input: { demandId: string; itemId?: string; quantity: number },
    tx: DbTransaction,
  ) {
    const membership = await requireMembership(this.context, cultivatorId, tx);
    this.benefits.assertPermission(membership, 'scene.industries');
    const repository = this.context.organizationRepository;
    const project = await this.ensureCurrentProject(membership.sectId, tx);
    if (!project)
      organizationError('本周工程已经完成，请待下周长老议定新工程');
    const economy = organizationFor(this.context, membership.sectId).economy;
    const demand = economy
      .donationDemands(membership.sectId, getSectDateKey())
      .find((item) => item.id === input.demandId);
    if (!demand) organizationError('今日没有这项宗门需求', 400);
    const units = input.quantity;
    const contribution = demand.contribution * units;
    const current = await repository.sumSectDonationContributionForDate(
      membership.id,
      getSectDateKey(),
      tx,
    );
    if (current + contribution > economy.donationDailyCap)
      organizationError(`每日建设贡献上限为 ${economy.donationDailyCap}`, 400);
    let snapshot: Record<string, unknown> = { kind: demand.kind, units };
    if (demand.kind === 'spirit_stones') {
      const amount = demand.quantity * units;
      if (!(await repository.spendCultivatorSpiritStones(cultivatorId, amount, tx)))
        organizationError('灵石不足', 400);
      snapshot = { ...snapshot, amount };
    } else if (demand.kind === 'material') {
      if (!input.itemId) organizationError('请选择要捐献的材料', 400);
      const item = await repository.findOwnedMaterial(cultivatorId, input.itemId, tx);
      if (!item || item.type !== 'herb')
        organizationError('该需求只接收灵草', 400);
      const minQuality = (demand.minQuality ?? '凡品') as Quality;
      if ((QUALITY_ORDER[item.rank as Quality] ?? -1) < QUALITY_ORDER[minQuality])
        organizationError('材料品质不足', 400);
      const amount = demand.quantity * units;
      if (!(await repository.consumeOwnedMaterial(item.id, amount, tx)))
        organizationError('材料数量不足', 400);
      snapshot = { ...snapshot, itemId: item.id, name: item.name, amount };
    } else if (demand.kind === 'pill') {
      if (!input.itemId) organizationError('请选择要捐献的丹药', 400);
      const item = await repository.findOwnedConsumable(
        cultivatorId,
        input.itemId,
        tx,
      );
      if (!item || !isPillSpec(item.spec as never))
        organizationError('该物品不是有效丹药', 400);
      const minQuality = (demand.minQuality ?? '凡品') as Quality;
      if ((QUALITY_ORDER[item.quality as Quality] ?? -1) < QUALITY_ORDER[minQuality])
        organizationError('丹药品质不足', 400);
      if (
        demand.pillFamily &&
        (item.spec as { family?: unknown }).family !== demand.pillFamily
      )
        organizationError('丹药类型不符合长老需求', 400);
      if (!(await repository.consumeOwnedConsumable(item.id, units, tx)))
        organizationError('丹药数量不足', 400);
      snapshot = { ...snapshot, itemId: item.id, name: item.name };
    } else {
      if (!input.itemId || units !== 1)
        organizationError('每次只能捐献一件法宝', 400);
      const item = await repository.findOwnedArtifact(cultivatorId, input.itemId, tx);
      if (!item) organizationError('未找到该法宝', 400);
      if (item.isEquipped) organizationError('已装备法宝不能捐献', 400);
      const minQuality = (demand.minQuality ?? '凡品') as Quality;
      if ((QUALITY_ORDER[item.quality as Quality] ?? -1) < QUALITY_ORDER[minQuality])
        organizationError('法宝品阶不足', 400);
      if (!(await repository.consumeOwnedArtifact(item.id, tx)))
        organizationError('法宝状态已变化，请重试', 400);
      snapshot = {
        ...snapshot,
        itemId: item.id,
        name: item.name,
        quality: item.quality,
      };
    }
    const donation = await repository.insertSectDonation(
      {
        membershipId: membership.id,
        projectId: project.id,
        dateKey: getSectDateKey(),
        demandId: demand.id,
        contribution,
        constructionPoints: demand.constructionPoints * units,
        itemSnapshot: snapshot,
        requestId: undefined,
      },
      tx,
    );
    if (!donation) organizationError('该笔捐献已经处理');
    if (
      !(await repository.advanceSectProject(
        project.id,
        demand.constructionPoints * units,
        tx,
      ))
    )
      organizationError('工程状态已变化，请重试');
    await repository.addSectContribution(
      membership.id,
      contribution,
      'construction_donation',
      donation.id,
      tx,
    );
    return this.getConstruction(cultivatorId, tx);
  }
}
