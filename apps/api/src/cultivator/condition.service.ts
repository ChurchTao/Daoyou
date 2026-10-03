import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  getBodyCultivationBreakthroughPreviewData,
  loadPlayerBodyCultivationFacts,
} from '@server/cultivator/application/BodyCultivationBreakthroughService.js';
import {
  breakthroughBodyCultivation,
  breakthroughCultivatorMarrowWash,
  consumeCultivatorConsumable,
  recoverCultivatorAtInn,
} from '@server/cultivator/application/CultivatorConditionApplicationService.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import type { BodyCultivationBreakthroughReadinessResponse } from '@daoyou/shared/contracts/bodyCultivation';

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

  async readiness(
    actor: ActiveCultivatorRef,
  ): Promise<BodyCultivationBreakthroughReadinessResponse> {
    const facts = await loadPlayerBodyCultivationFacts(
      actor.userId,
      actor.cultivatorId,
    );
    if (!facts)
      throw new HttpException({ success: false, error: '角色不存在' }, 404);
    return {
      success: true,
      data: getBodyCultivationBreakthroughPreviewData(facts),
    };
  }

  async breakthrough(actor: ActiveCultivatorRef) {
    return toPlayerStateMutationResponse(
      await breakthroughBodyCultivation({ actor }),
    );
  }

  async marrowWash(actor: ActiveCultivatorRef) {
    return toPlayerStateMutationResponse(
      await breakthroughCultivatorMarrowWash({ actor }),
    );
  }
}
