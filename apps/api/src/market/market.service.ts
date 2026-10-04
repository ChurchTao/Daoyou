import type { MarketBuyInput } from '@daoyou/contracts/market';
import type { RecycleRequestSchema } from '@daoyou/contracts/recycle';
import { Inject, Injectable } from '@nestjs/common';
import { CultivatorQueriesService } from '@server/cultivator/cultivator-queries.service.js';
import { InventoryRecycleService } from '@server/inventory/inventory-recycle.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  getMarketListings,
  MarketServiceError,
  resolveLayer,
  resolveNodeId,
} from '@server/market/application/MarketService.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import type { z } from 'zod';
import { MarketPurchaseService } from './application/MarketApplicationService.js';

@Injectable()
export class MarketService {
  constructor(
    @Inject(CultivatorQueriesService)
    private readonly facts: CultivatorQueriesService,
    @Inject(InventoryRecycleService)
    private readonly recycling: InventoryRecycleService,
    @Inject(MarketPurchaseService)
    private readonly purchases: MarketPurchaseService,
  ) {}

  async list(actor: ActiveCultivatorRef, node: string, layerValue?: string) {
    const nodeId = resolveNodeId(node);
    const layer = resolveLayer(layerValue);
    if (layer === 'black')
      throw new MarketServiceError(410, '黑市已经移入暗巷，请从坊市入口前往');
    const [{ realm }, fates] = await Promise.all([
      this.facts.realm(actor.cultivatorId),
      this.facts.preHeavenFates(actor.userId, actor.cultivatorId),
    ]);
    return getMarketListings({
      nodeId,
      layer,
      userId: actor.userId,
      cultivatorRealm: realm,
      fates: fates ?? [],
    });
  }

  async buy(actor: ActiveCultivatorRef, node: string, input: MarketBuyInput) {
    return toPlayerStateMutationResponse(
      await this.purchases.purchase({
        actor,
        nodeId: resolveNodeId(node),
        input,
      }),
    );
  }

  async recycle(
    actor: ActiveCultivatorRef,
    input: z.infer<typeof RecycleRequestSchema>,
  ) {
    if (input.phase === 'preview')
      return {
        success: true,
        data: await this.recycling.preview(actor.cultivatorId, input.items),
      };
    return toPlayerStateMutationResponse(
      await this.recycling.confirm(actor, input.quoteId),
    );
  }
}
