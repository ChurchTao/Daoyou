import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
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
import type { ExchangeArtifact } from '@daoyou/shared/contracts/artifactMigration';
import type { ExchangeManual } from '@daoyou/shared/contracts/manualMigration';

@Injectable()
export class MigrationService {
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
