import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import type { addMaterialStackToInventory } from '@server/lib/services/materialInventory';
import type { addConsumableToInventory } from '@server/lib/services/cultivatorService';
import type { SectShopItemData } from '@shared/contracts/sect';
import {
  getSectFacilityBonus,
  hasSectRank,
  type SectDiscipleRank,
} from '@shared/engine/sect';
import type { Material } from '@shared/types/cultivator';
import type { SectBenefitService } from './SectBenefitService';
import { getSectWeekKey } from './SectOrganizationClock';
import {
  mapFacilities,
  organizationError,
  organizationFor,
  requireMembership,
  type SectOrganizationContext,
} from './SectOrganizationSupport';

export interface SectEconomyDependencies extends SectOrganizationContext {
  addMaterial: typeof addMaterialStackToInventory;
  addConsumable: typeof addConsumableToInventory;
  uuid(): string;
}

export class SectEconomyApplicationService {
  constructor(
    private readonly context: SectEconomyDependencies,
    private readonly benefits: SectBenefitService,
  ) {}

  async getShop(cultivatorId: string, q: DbExecutor = getExecutor()) {
    const membership = await requireMembership(this.context, cultivatorId, q);
    this.benefits.assertPermission(membership, 'scene.treasury');
    const rank = membership.discipleRank as SectDiscipleRank;
    const weekKey = getSectWeekKey();
    const items: SectShopItemData[] = [];
    for (const item of organizationFor(
      this.context,
      membership.sectId,
    ).economy.shopItems(weekKey)) {
      if (!hasSectRank(rank, item.requiredRank)) continue;
      const purchased =
        await this.context.organizationRepository.getPurchasedSectShopQuantity(
          membership.id,
          weekKey,
          item.id,
          q,
        );
      items.push({
        id: item.id,
        name: item.grant.name,
        description: item.grant.description,
        requiredRank: item.requiredRank,
        price: item.price,
        stock: item.stock,
        purchased,
        kind: item.grant.kind === 'pill' ? 'pill' : 'material',
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
    tx: DbTransaction,
  ) {
    const membership = await requireMembership(this.context, cultivatorId, tx);
    this.benefits.assertPermission(membership, 'scene.treasury');
    const weekKey = getSectWeekKey();
    const item = organizationFor(this.context, membership.sectId)
      .economy.shopItems(weekKey)
      .find((entry) => entry.id === itemId);
    if (!item) organizationError('本周宝库没有该物品', 400);
    if (!hasSectRank(membership.discipleRank as SectDiscipleRank, item.requiredRank))
      organizationError('弟子职阶不足', 400);
    const purchased =
      await this.context.organizationRepository.getPurchasedSectShopQuantity(
        membership.id,
        weekKey,
        item.id,
        tx,
      );
    if (purchased + quantity > item.stock)
      organizationError('本周个人库存不足', 400);
    const cost = item.price * quantity;
    if (
      (await this.context.organizationRepository.spendSectContribution(
        membership.id,
        cost,
        'sect_shop',
        `${weekKey}:${item.id}`,
        tx,
      )) === null
    )
      organizationError('宗门贡献不足', 400);
    const purchase = await this.context.organizationRepository.addSectShopPurchase(
      membership.id,
      weekKey,
      item.id,
      quantity,
      undefined,
      tx,
    );
    if (!purchase) organizationError('该笔兑换已经处理');
    if (item.grant.kind === 'material') {
      await this.context.addMaterial(
        cultivatorId,
        {
          name: item.grant.name,
          type: item.grant.type,
          rank: item.grant.quality,
          element: item.grant.element as Material['element'],
          description: item.grant.description,
          details: { source: 'sect_shop' },
          quantity,
        },
        tx,
      );
    } else {
      await this.context.addConsumable(
        userId,
        cultivatorId,
        {
          id: this.context.uuid(),
          name: item.grant.name,
          type: '丹药',
          prompt: '宗门宝库制式丹药',
          quality: item.grant.quality,
          description: item.grant.description,
          spec: item.grant.spec,
          quantity,
        },
        tx,
      );
    }
    return this.getShop(cultivatorId, tx);
  }

  async claimStipend(
    userId: string,
    cultivatorId: string,
    tx: DbTransaction,
  ) {
    const membership = await requireMembership(this.context, cultivatorId, tx);
    await this.context.organizationRepository.ensureSectFacilities(
      membership.sectId,
      tx,
    );
    const facilities = mapFacilities(
      await this.context.organizationRepository.listSectFacilities(
        membership.sectId,
        tx,
      ),
    );
    const level = (key: string) =>
      facilities.find((item) => item.key === key)?.level ?? 1;
    const rank = membership.discipleRank as SectDiscipleRank;
    const economy = organizationFor(this.context, membership.sectId).economy;
    const stones = Math.floor(
      economy.stipendBase(rank) *
        (1 + getSectFacilityBonus('spirit_vein', level('spirit_vein'))),
    );
    const rewards = economy.stipendRewards(rank, level('herb_garden'));
    const weekKey = getSectWeekKey();
    const claim = await this.context.organizationRepository.createSectStipendClaim(
      {
        membershipId: membership.id,
        weekKey,
        spiritStones: stones,
        rewards: [
          { kind: 'material', name: rewards.herbName, quantity: rewards.herbQuantity },
        ],
      },
      tx,
    );
    if (!claim) organizationError('本周俸禄已经领取');
    await this.context.organizationRepository.addCultivatorSpiritStones(
      cultivatorId,
      stones,
      tx,
    );
    if (rewards.herbQuantity > 0)
      await this.context.addMaterial(
        cultivatorId,
        {
          name: rewards.herbName,
          type: 'herb',
          rank: rewards.herbQuality,
          element: '木',
          description: '宗门药田按周分发的修行灵草。',
          details: { source: 'sect_stipend' },
          quantity: rewards.herbQuantity,
        },
        tx,
      );
    if (rewards.bonusPill)
      await this.context.addConsumable(
        userId,
        cultivatorId,
        {
          id: this.context.uuid(),
          name: rewards.bonusPill.name,
          type: '丹药',
          prompt: '宗门弟子周俸',
          quality: rewards.bonusPill.quality,
          description: rewards.bonusPill.description,
          spec: rewards.bonusPill.spec,
          quantity: 1,
        },
        tx,
      );
    return {
      weekKey,
      spiritStones: stones,
      herbQuantity: rewards.herbQuantity,
    };
  }
}
