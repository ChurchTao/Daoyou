import type { ExchangeArtifact } from '@daoyou/contracts/legacy/artifacts';
import type { ExchangeManual } from '@daoyou/contracts/legacy/manuals';
import type { ExchangeSeed } from '@daoyou/contracts/legacy/seeds';
import { Injectable } from '@nestjs/common';
import {
  artifactMigrationAvailability,
  exchangeArtifactMigration,
  readArtifactMigration,
} from '@server/legacy-items/application/ArtifactMigrationService.js';
import {
  exchangeManualMigration,
  manualMigrationAvailability,
  readManualMigration,
} from '@server/legacy-items/application/ManualMigrationService.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  exchangeSeedMigration,
  readSeedMigration,
} from './application/SeedMigrationService.js';

@Injectable()
export class MigrationService {
  async seeds(actor: ActiveCultivatorRef) {
    return { success: true, data: await readSeedMigration(actor) };
  }

  async exchangeSeed(actor: ActiveCultivatorRef, input: ExchangeSeed) {
    return { success: true, ...(await exchangeSeedMigration(actor, input)) };
  }

  async artifactAvailability(actor: ActiveCultivatorRef) {
    return { success: true, data: await artifactMigrationAvailability(actor) };
  }

  async artifacts(actor: ActiveCultivatorRef) {
    return { success: true, data: await readArtifactMigration(actor) };
  }

  async exchangeArtifact(actor: ActiveCultivatorRef, input: ExchangeArtifact) {
    return {
      success: true,
      ...(await exchangeArtifactMigration(actor, input)),
    };
  }

  async manualAvailability(actor: ActiveCultivatorRef) {
    return { success: true, data: await manualMigrationAvailability(actor) };
  }

  async manuals(actor: ActiveCultivatorRef) {
    return { success: true, data: await readManualMigration(actor) };
  }

  async exchangeManual(actor: ActiveCultivatorRef, input: ExchangeManual) {
    return { success: true, ...(await exchangeManualMigration(actor, input)) };
  }
}
