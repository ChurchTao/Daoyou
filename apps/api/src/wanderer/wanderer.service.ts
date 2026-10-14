import type {
  WandererBeastSale,
  WandererPurchase,
} from '@daoyou/contracts/wanderer';
import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  buyWandererBook,
  buyWandererDew,
  buyWandererIncense,
  readWandererBeasts,
  readWandererState,
  sellWandererBeast,
} from './application/WandererTradeService.js';

@Injectable()
export class WandererService {
  state() {
    return readWandererState().then((data) => ({
      success: true as const,
      data,
    }));
  }

  beasts(actor: ActiveCultivatorRef) {
    return readWandererBeasts(actor.cultivatorId).then((beasts) => ({
      success: true as const,
      data: { beasts },
    }));
  }

  async sellBeast(actor: ActiveCultivatorRef, input: WandererBeastSale) {
    return {
      success: true as const,
      data: await sellWandererBeast(actor, input),
    };
  }

  async buyBook(actor: ActiveCultivatorRef, input: WandererPurchase) {
    return {
      success: true as const,
      data: await buyWandererBook(actor, input),
    };
  }

  async buyDew(actor: ActiveCultivatorRef, input: WandererPurchase) {
    return { success: true as const, data: await buyWandererDew(actor, input) };
  }

  async buyIncense(actor: ActiveCultivatorRef, input: WandererPurchase) {
    return {
      success: true as const,
      data: await buyWandererIncense(actor, input),
    };
  }
}
