import { Injectable } from '@nestjs/common';
import {
  consumeCultivatorConsumable,
  recoverCultivatorAtInn,
} from '@server/cultivator/application/CultivatorConditionApplicationService.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';

@Injectable()
export class ConditionService {
  async consume(
    actor: ActiveCultivatorRef,
    input: { consumableId: string; revision?: number; quantity: number },
  ) {
    return toPlayerStateMutationResponse(
      await consumeCultivatorConsumable({ actor, ...input }),
    );
  }

  async recover(actor: ActiveCultivatorRef) {
    return toPlayerStateMutationResponse(
      await recoverCultivatorAtInn({ actor }),
    );
  }
}
