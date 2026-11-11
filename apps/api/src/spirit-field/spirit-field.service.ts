import type {
  SpiritFieldArchiveRequest,
  SpiritFieldBranchBatchRequest,
  SpiritFieldBranchRequest,
  SpiritFieldEvolveRequest,
  SpiritFieldHarvestRequest,
  SpiritFieldMatureBatchRequest,
  SpiritFieldMatureRequest,
  SpiritFieldRestoreRequest,
  SpiritFieldRetireRequest,
  SpiritFieldSowRequest,
  SpiritFieldStarterRequest,
} from '@daoyou/contracts/spirit-field';
import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import {
  archiveSpiritField,
  branchSpiritFieldBatch,
  branchSpiritField,
  claimSpiritFieldStarterSeeds,
  evolveSpiritField,
  getSpiritFieldSnapshot,
  harvestSpiritField,
  matureSpiritFieldBatch,
  matureSpiritField,
  restoreSpiritField,
  retireSpiritField,
  sowSpiritField,
} from './application/SpiritFieldService.js';

@Injectable()
export class SpiritFieldService {
  async read(actor: ActiveCultivatorRef) {
    return { success: true, data: await getSpiritFieldSnapshot(actor) };
  }

  async starter(actor: ActiveCultivatorRef, input: SpiritFieldStarterRequest) {
    return toPlayerStateMutationResponse(
      await claimSpiritFieldStarterSeeds(actor, input),
    );
  }

  async sow(actor: ActiveCultivatorRef, input: SpiritFieldSowRequest) {
    return toPlayerStateMutationResponse(await sowSpiritField(actor, input));
  }

  async harvest(actor: ActiveCultivatorRef, input: SpiritFieldHarvestRequest) {
    return toPlayerStateMutationResponse(
      await harvestSpiritField(actor, input),
    );
  }

  async branch(actor: ActiveCultivatorRef, input: SpiritFieldBranchRequest) {
    return toPlayerStateMutationResponse(await branchSpiritField(actor, input));
  }

  async mature(actor: ActiveCultivatorRef, input: SpiritFieldMatureRequest) {
    return toPlayerStateMutationResponse(await matureSpiritField(actor, input));
  }

  async matureBatch(actor: ActiveCultivatorRef, input: SpiritFieldMatureBatchRequest) {
    return toPlayerStateMutationResponse(
      await matureSpiritFieldBatch(actor, input),
    );
  }

  async branchBatch(actor: ActiveCultivatorRef, input: SpiritFieldBranchBatchRequest) {
    return toPlayerStateMutationResponse(
      await branchSpiritFieldBatch(actor, input),
    );
  }

  async evolve(actor: ActiveCultivatorRef, input: SpiritFieldEvolveRequest) {
    return toPlayerStateMutationResponse(await evolveSpiritField(actor, input));
  }

  async archive(actor: ActiveCultivatorRef, input: SpiritFieldArchiveRequest) {
    return toPlayerStateMutationResponse(
      await archiveSpiritField(actor, input),
    );
  }

  async restore(actor: ActiveCultivatorRef, input: SpiritFieldRestoreRequest) {
    return toPlayerStateMutationResponse(
      await restoreSpiritField(actor, input),
    );
  }

  async retire(actor: ActiveCultivatorRef, input: SpiritFieldRetireRequest) {
    return toPlayerStateMutationResponse(await retireSpiritField(actor, input));
  }
}
