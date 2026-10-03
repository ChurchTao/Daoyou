import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import {
  claimSpiritFieldStarterSeeds,
  cultivateSpiritField,
  getSpiritFieldSnapshot,
  harvestSpiritField,
  sowSpiritField,
} from '@server/spirit-field/application/SpiritFieldService.js';
import type {
  SpiritFieldCultivateRequest,
  SpiritFieldHarvestRequest,
  SpiritFieldSowRequest,
} from '@daoyou/shared/contracts/spiritField';

@Injectable()
export class SpiritFieldService {
  async read(actor: ActiveCultivatorRef) {
    return { success: true, data: await getSpiritFieldSnapshot(actor) };
  }

  async starter(actor: ActiveCultivatorRef) {
    return toPlayerStateMutationResponse(
      await claimSpiritFieldStarterSeeds(actor),
    );
  }

  async sow(actor: ActiveCultivatorRef, input: SpiritFieldSowRequest) {
    return toPlayerStateMutationResponse(await sowSpiritField(actor, input));
  }

  async cultivate(
    actor: ActiveCultivatorRef,
    input: SpiritFieldCultivateRequest,
    signal: AbortSignal,
  ) {
    return toPlayerStateMutationResponse(
      await cultivateSpiritField(actor, input, signal),
    );
  }

  async harvest(
    actor: ActiveCultivatorRef,
    input: SpiritFieldHarvestRequest,
    signal: AbortSignal,
  ) {
    return toPlayerStateMutationResponse(
      await harvestSpiritField(actor, input, signal),
    );
  }
}
